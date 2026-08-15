import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { defaultTerminalNodes, type ProjectAgentStep } from "../../shared/domain/automation.js";
import { defaultLoopTheme } from "../../shared/domain/loopThemes.js";
import type { ExecutionProfile } from "../../shared/domain/projectConfig.js";
import type { ExecutionResourceSnapshot, RootExecutionSnapshot } from "../../shared/domain/runtime.js";
import {
  composeExecutionPrompt,
  ExecutionCompositionError,
  MAX_EXECUTION_PROMPT_BYTES,
  MAX_PRIMARY_INSTRUCTION_BYTES,
  MAX_SKILL_BYTES,
  resolveExecutionResources
} from "./ExecutionComposition.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const projectRoot = async (): Promise<string> => {
  const root = await mkdtemp(path.join(tmpdir(), "ballet-execution-composition-"));
  roots.push(root);
  return root;
};

const writeInstruction = async (
  root: string,
  file: string,
  id: string,
  body = "Follow the primary instruction."
): Promise<void> => {
  const directory = path.join(root, ".ballet/instructions");
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, file), `---\nid: ${id}\ntitle: Primary\n---\n${body}`, "utf8");
};

const writeSkill = async (root: string, id: string, body = `Apply ${id}.`): Promise<void> => {
  const directory = path.join(root, ".agents/skills", ...id.split("/"));
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "SKILL.md"), `---\nname: ${id}\ndescription: Test skill\n---\n${body}`, "utf8");
};

const profile: ExecutionProfile = {
  id: "primary",
  name: "Primary",
  provider: "codex",
  model: "gpt-5",
  reasoningEffort: "medium",
  networkAccess: false
};

const step = (overrides: Partial<ProjectAgentStep> = {}): ProjectAgentStep => ({
  id: "work",
  type: "agent",
  executionProfileId: profile.id,
  primaryInstructionId: "project:primary",
  skillIds: [],
  description: "Complete the task.",
  nodeStyle: "terra",
  nodeSize: "medium",
  on: { approved: "completed", rejected: "blocked" },
  ...overrides
});

const snapshot = (
  work: ProjectAgentStep,
  resources: ExecutionResourceSnapshot[]
): RootExecutionSnapshot => ({
  version: 1,
  rootLoopId: "delivery",
  project: {
    checkoutRoot: "/tmp/checkout",
    headSha: "head",
    configHash: "config",
    snapshotHash: "snapshot"
  },
  loops: [{ id: "delivery", start: work.id, nodes: [work, ...defaultTerminalNodes()] }],
  theme: defaultLoopTheme,
  executionProfiles: [profile],
  runtimes: [{
    executionProfileId: profile.id,
    runtime: {
      hostname: "host",
      provider: "codex",
      cliVersion: "1.0.0",
      model: profile.model,
      reasoning: profile.reasoningEffort,
      policy: { network: profile.networkAccess, readOnlyRoots: [] },
      capabilityHash: "capabilities"
    }
  }],
  resources,
  createdAt: "2026-07-19T00:00:00.000Z"
});

const expectCompositionError = async (
  operation: () => Promise<unknown> | unknown,
  code: ExecutionCompositionError["code"]
): Promise<void> => {
  try {
    await operation();
    throw new Error("Expected execution composition to fail.");
  } catch (error) {
    expect(error).toBeInstanceOf(ExecutionCompositionError);
    expect((error as ExecutionCompositionError).code).toBe(code);
  }
};

describe("execution resource resolution", () => {
  it("fails closed for a missing primary instruction", async () => {
    const root = await projectRoot();
    await expectCompositionError(() => resolveExecutionResources(root, [step()]), "missing_resource");
  });

  it("rejects duplicate and invalid primary instruction ids", async () => {
    const duplicateRoot = await projectRoot();
    await writeInstruction(duplicateRoot, "first.md", "primary");
    await writeInstruction(duplicateRoot, "second.md", "primary");
    await expectCompositionError(() => resolveExecutionResources(duplicateRoot, [step()]), "invalid_resource");

    const invalidRoot = await projectRoot();
    await writeInstruction(invalidRoot, "invalid.md", "Not-Canonical");
    await expectCompositionError(() => resolveExecutionResources(invalidRoot, [step()]), "invalid_resource");
  });

  it("fails closed for missing, duplicate, and invalid skills", async () => {
    const missingRoot = await projectRoot();
    await writeInstruction(missingRoot, "primary.md", "primary");
    await expectCompositionError(
      () => resolveExecutionResources(missingRoot, [step({ skillIds: ["project:missing"] })]),
      "missing_resource"
    );

    const duplicateRoot = await projectRoot();
    await writeInstruction(duplicateRoot, "primary.md", "primary");
    await writeSkill(duplicateRoot, "checks");
    await expectCompositionError(
      () => resolveExecutionResources(duplicateRoot, [step({ skillIds: ["project:checks", "project:checks"] })]),
      "invalid_resource"
    );

    const invalidRoot = await projectRoot();
    await writeInstruction(invalidRoot, "primary.md", "primary");
    await writeSkill(invalidRoot, "Not-Canonical");
    await expectCompositionError(() => resolveExecutionResources(invalidRoot, [step()]), "invalid_resource");
  });

  it("snapshots selected skills in canonical id order", async () => {
    const root = await projectRoot();
    await writeInstruction(root, "primary.md", "primary");
    await writeSkill(root, "zeta");
    await writeSkill(root, "alpha/nested");
    const resources = await resolveExecutionResources(root, [step({
      skillIds: ["project:zeta", "project:alpha/nested"]
    })]);

    expect(resources.map((resource) => [resource.kind, resource.id])).toEqual([
      ["primary", "project:primary"],
      ["skill", "project:alpha/nested"],
      ["skill", "project:zeta"],
      ["system", "system:execution-contract-v1"]
    ]);
  });

  it("accepts exactly 128 KiB and rejects the next UTF-8 byte per resource", async () => {
    const exactPrimary = "é".repeat(MAX_PRIMARY_INSTRUCTION_BYTES / 2);
    const primaryRoot = await projectRoot();
    await writeInstruction(primaryRoot, "primary.md", "primary", exactPrimary);
    const primaryResources = await resolveExecutionResources(primaryRoot, [step()]);
    expect(Buffer.byteLength(primaryResources.find((item) => item.kind === "primary")!.content, "utf8"))
      .toBe(MAX_PRIMARY_INSTRUCTION_BYTES);
    await writeInstruction(primaryRoot, "primary.md", "primary", `${exactPrimary}x`);
    await expectCompositionError(() => resolveExecutionResources(primaryRoot, [step()]), "resource_too_large");

    const exactSkill = "é".repeat(MAX_SKILL_BYTES / 2);
    const skillRoot = await projectRoot();
    await writeInstruction(skillRoot, "primary.md", "primary");
    await writeSkill(skillRoot, "checks", exactSkill);
    const selected = step({ skillIds: ["project:checks"] });
    const skillResources = await resolveExecutionResources(skillRoot, [selected]);
    expect(Buffer.byteLength(skillResources.find((item) => item.kind === "skill")!.content, "utf8"))
      .toBe(MAX_SKILL_BYTES);
    await writeSkill(skillRoot, "checks", `${exactSkill}x`);
    await expectCompositionError(() => resolveExecutionResources(skillRoot, [selected]), "resource_too_large");
  });
});

describe("execution prompt composition", () => {
  it("is deterministic, canonically ordered, and uses only snapshotted resource content", async () => {
    const root = await projectRoot();
    await writeInstruction(root, "primary.md", "primary", "SNAPSHOTTED PRIMARY");
    await writeSkill(root, "zeta", "SNAPSHOTTED ZETA");
    await writeSkill(root, "alpha", "SNAPSHOTTED ALPHA");
    const work = step({ skillIds: ["project:zeta", "project:alpha"] });
    const resources = await resolveExecutionResources(root, [work]);

    await writeInstruction(root, "primary.md", "primary", "MUTATED PRIMARY");
    await writeSkill(root, "alpha", "MUTATED ALPHA");

    const first = composeExecutionPrompt(snapshot(work, resources), "delivery", work.id, "TASK INPUT");
    const second = composeExecutionPrompt(snapshot(work, resources), "delivery", work.id, "TASK INPUT");
    expect(second).toEqual(first);
    expect(first.prompt).toContain("SNAPSHOTTED PRIMARY");
    expect(first.prompt).toContain("SNAPSHOTTED ALPHA");
    expect(first.prompt).not.toContain("MUTATED PRIMARY");
    expect(first.prompt).not.toContain("MUTATED ALPHA");
    expect(first.prompt.indexOf("project:alpha")).toBeLessThan(first.prompt.indexOf("project:zeta"));
    expect(first.resources.map((resource) => resource.id)).toEqual([
      "system:execution-contract-v1",
      "project:primary",
      "project:alpha",
      "project:zeta"
    ]);
    expect(first.resources.every((resource) => !("content" in resource))).toBe(true);
    expect(first.promptSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(first.outputSchemaSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("enforces the composed prompt byte limit", async () => {
    const root = await projectRoot();
    await writeInstruction(root, "primary.md", "primary", "p".repeat(MAX_PRIMARY_INSTRUCTION_BYTES));
    const skillIds = ["alpha", "beta", "gamma", "omega"];
    for (const skillId of skillIds) await writeSkill(root, skillId, "s".repeat(MAX_SKILL_BYTES));
    const work = step({ skillIds: skillIds.map((id) => `project:${id}`) });
    const resources = await resolveExecutionResources(root, [work]);

    await expectCompositionError(
      () => composeExecutionPrompt(snapshot(work, resources), "delivery", work.id, "TASK"),
      "prompt_too_large"
    );
    expect(MAX_EXECUTION_PROMPT_BYTES).toBeLessThan(
      MAX_PRIMARY_INSTRUCTION_BYTES + (skillIds.length * MAX_SKILL_BYTES)
    );
  });
});
