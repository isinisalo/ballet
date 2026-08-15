import { createHash } from "node:crypto";
import type { ProjectExecutionStep } from "../../shared/domain/automation.js";
import type { ProjectInstruction, ProjectResourceCatalog, Skill } from "../../shared/domain/documents.js";
import type { ExecutionResourceSnapshot } from "../../shared/domain/runtime.js";
import { loadProjectResources } from "../documents/projectResourceCatalog.js";
import { ExecutionCompositionError } from "./ExecutionCompositionError.js";
import {
  SYSTEM_EXECUTION_INSTRUCTION,
  SYSTEM_EXECUTION_INSTRUCTION_ID
} from "./SystemExecutionContract.js";

export const MAX_PRIMARY_INSTRUCTION_BYTES = 128 * 1024;
export const MAX_SKILL_BYTES = 128 * 1024;

export const resolveExecutionResources = async (
  root: string,
  steps: readonly ProjectExecutionStep[]
): Promise<ExecutionResourceSnapshot[]> => {
  const catalog = await loadProjectResources(root);
  return resolveExecutionResourcesFromCatalog(catalog, steps);
};

export const resolveExecutionResourcesFromCatalog = (
  catalog: ProjectResourceCatalog,
  steps: readonly ProjectExecutionStep[]
): ExecutionResourceSnapshot[] => {
  if (catalog.issues.length > 0) {
    const issue = [...catalog.issues].sort(compareIssues)[0]!;
    throw new ExecutionCompositionError(
      "invalid_resource",
      `Project resource catalog is invalid at ${issue.relativePath}: ${issue.message}`
    );
  }

  const instructions = new Map(catalog.instructions
    .filter(hasResourceId)
    .map((instruction) => [instruction.id, instruction]));
  const skills = new Map(catalog.skills.map((skill) => [skill.id, skill]));
  const selected = new Map<string, ExecutionResourceSnapshot>();
  const system = systemExecutionResourceSnapshot();
  selected.set(resourceKey(system), system);

  for (const step of steps) {
    const primary = instructions.get(step.primaryInstructionId);
    if (!primary?.valid) {
      throw new ExecutionCompositionError(
        "missing_resource",
        `Step ${step.id} references missing primary instruction ${step.primaryInstructionId}.`
      );
    }
    addSelected(selected, primarySnapshot(primary));

    if (new Set(step.skillIds).size !== step.skillIds.length) {
      throw new ExecutionCompositionError("invalid_resource", `Step ${step.id} contains duplicate skill ids.`);
    }
    for (const skillId of sortedIds(step.skillIds)) {
      const skill = skills.get(skillId);
      if (!skill?.valid) {
        throw new ExecutionCompositionError(
          "missing_resource",
          `Step ${step.id} references missing skill ${skillId}.`
        );
      }
      addSelected(selected, skillSnapshot(skill));
    }
  }
  return [...selected.values()].sort(compareResources);
};

const primarySnapshot = (instruction: ProjectInstruction & { id: string }): ExecutionResourceSnapshot => {
  assertResourceSize(
    instruction.sizeBytes,
    MAX_PRIMARY_INSTRUCTION_BYTES,
    `Primary instruction ${instruction.relativePath}`
  );
  return {
    kind: "primary",
    origin: instruction.origin,
    id: instruction.id,
    relativePath: instruction.relativePath,
    sourceSha256: instruction.sourceSha256,
    content: instruction.body
  };
};

const skillSnapshot = (skill: Skill): ExecutionResourceSnapshot => {
  assertResourceSize(skill.sizeBytes, MAX_SKILL_BYTES, `Skill ${skill.relativePath}`);
  return {
    kind: "skill",
    origin: skill.origin,
    id: skill.id,
    relativePath: skill.relativePath,
    sourceSha256: skill.sourceSha256,
    content: skill.body
  };
};

export const systemExecutionResourceSnapshot = (): ExecutionResourceSnapshot => ({
  kind: "system",
  origin: "system",
  id: SYSTEM_EXECUTION_INSTRUCTION_ID,
  sourceSha256: sha256(SYSTEM_EXECUTION_INSTRUCTION),
  content: SYSTEM_EXECUTION_INSTRUCTION
});

const addSelected = (
  selected: Map<string, ExecutionResourceSnapshot>,
  resource: ExecutionResourceSnapshot
): void => {
  selected.set(resourceKey(resource), resource);
};

const assertResourceSize = (bytes: number, maximum: number, label: string): void => {
  if (bytes > maximum) {
    throw new ExecutionCompositionError(
      "resource_too_large",
      `${label} is ${bytes} bytes; the maximum is ${maximum} bytes.`
    );
  }
};

const hasResourceId = (instruction: ProjectInstruction): instruction is ProjectInstruction & { id: string } =>
  typeof instruction.id === "string";
const sortedIds = (ids: readonly string[]): string[] => [...ids].sort(compareText);
const resourceKey = (resource: ExecutionResourceSnapshot): string => `${resource.kind}\0${resource.id}`;
const compareResources = (left: ExecutionResourceSnapshot, right: ExecutionResourceSnapshot): number =>
  compareText(resourceKey(left), resourceKey(right));
const compareIssues = (
  left: { relativePath: string; kind: string; code: string },
  right: { relativePath: string; kind: string; code: string }
): number => compareText(
  `${left.relativePath}\0${left.kind}\0${left.code}`,
  `${right.relativePath}\0${right.kind}\0${right.code}`
);
const compareText = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const sha256 = (value: string): string => createHash("sha256").update(value, "utf8").digest("hex");
