import { createHash } from "node:crypto";
import { stepOutcomeJsonSchema } from "../../shared/api/runtime-schemas.js";
import type {
  ExecutionPromptEvidence,
  ExecutionResourceEvidence,
  ExecutionResourceSnapshot,
  RootExecutionSnapshot
} from "../../shared/domain/runtime.js";
import { ExecutionCompositionError } from "./ExecutionCompositionError.js";
import { SYSTEM_EXECUTION_INSTRUCTION_ID } from "./SystemExecutionContract.js";

export { ExecutionCompositionError } from "./ExecutionCompositionError.js";
export {
  MAX_PRIMARY_INSTRUCTION_BYTES,
  MAX_SKILL_BYTES,
  resolveExecutionResources,
  resolveExecutionResourcesFromCatalog,
  systemExecutionResourceSnapshot
} from "./ExecutionResourceCatalog.js";
export {
  SYSTEM_EXECUTION_INSTRUCTION,
  SYSTEM_EXECUTION_INSTRUCTION_ID
} from "./SystemExecutionContract.js";

export const EXECUTION_COMPOSITION_VERSION = 1 as const;
export const STEP_OUTCOME_SCHEMA_VERSION = 1 as const;
export const MAX_EXECUTION_PROMPT_BYTES = 512 * 1024;

export const composeExecutionPrompt = (
  snapshot: RootExecutionSnapshot,
  loopId: string,
  stepId: string,
  taskEnvelope: string
): ExecutionPromptEvidence => {
  const loop = snapshot.loops.find((candidate) => candidate.id === loopId);
  const step = loop?.nodes.find((candidate) => candidate.id === stepId);
  if (!step || (step.type !== "agent" && step.type !== "scheduled")) {
    throw new ExecutionCompositionError(
      "missing_resource",
      `Root execution snapshot has no executable composition for ${loopId}:${stepId}.`
    );
  }
  const profile = snapshot.executionProfiles.find((candidate) => candidate.id === step.executionProfileId);
  if (!profile) {
    throw new ExecutionCompositionError(
      "missing_resource",
      `Root execution snapshot is missing execution profile ${step.executionProfileId}.`
    );
  }

  const system = requireResource(snapshot, "system", SYSTEM_EXECUTION_INSTRUCTION_ID);
  const primary = requireResource(snapshot, "primary", step.primaryInstructionId);
  const skills = sortedIds(step.skillIds).map((id) => requireResource(snapshot, "skill", id));
  const outputSchema = JSON.stringify(stepOutcomeJsonSchema);
  const prompt = [
    section("SYSTEM", system.id, system.content),
    section("PRIMARY", primary.id, primary.content),
    ...skills.map((skill) => section("SKILL", skill.id, skill.content)),
    section("TASK-ENVELOPE", "v1", taskEnvelope),
    section("OUTPUT-SCHEMA", "v1", outputSchema)
  ].join("\n\n");
  const promptBytes = Buffer.byteLength(prompt, "utf8");
  if (promptBytes > MAX_EXECUTION_PROMPT_BYTES) {
    throw new ExecutionCompositionError(
      "prompt_too_large",
      `Execution prompt for ${loopId}:${stepId} is ${promptBytes} bytes; the maximum is ${MAX_EXECUTION_PROMPT_BYTES} bytes.`
    );
  }
  return {
    compositionVersion: EXECUTION_COMPOSITION_VERSION,
    loopId,
    stepId,
    executionProfile: profile,
    resources: [system, primary, ...skills].map(resourceEvidence),
    prompt,
    promptSha256: sha256(Buffer.from(prompt, "utf8")),
    outputSchemaVersion: STEP_OUTCOME_SCHEMA_VERSION,
    outputSchemaSha256: sha256(Buffer.from(outputSchema, "utf8"))
  };
};

export const runtimeForStep = (
  snapshot: RootExecutionSnapshot,
  executionProfileId: string
) => {
  const binding = snapshot.runtimes.find((candidate) => candidate.executionProfileId === executionProfileId);
  if (!binding) {
    throw new ExecutionCompositionError(
      "missing_resource",
      `Root execution snapshot is missing runtime binding for ${executionProfileId}.`
    );
  }
  return binding.runtime;
};

const requireResource = (
  snapshot: RootExecutionSnapshot,
  kind: ExecutionResourceSnapshot["kind"],
  id: string
): ExecutionResourceSnapshot => {
  const resource = snapshot.resources.find((candidate) => candidate.kind === kind && candidate.id === id);
  if (!resource) throw new ExecutionCompositionError("missing_resource", `Root execution snapshot is missing ${kind} resource ${id}.`);
  return resource;
};

const resourceEvidence = (resource: ExecutionResourceSnapshot): ExecutionResourceEvidence => ({
  kind: resource.kind,
  origin: resource.origin,
  id: resource.id,
  relativePath: resource.relativePath,
  sourceSha256: resource.sourceSha256
});
const section = (kind: string, id: string, content: string): string =>
  `<<< BALLET EXECUTION COMPOSITION V1 · ${kind} · ${id} >>>\n${content}\n<<< END BALLET ${kind} >>>`;
const compareIds = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
const sortedIds = (ids: readonly string[]): string[] => [...ids].sort(compareIds);
const sha256 = (value: Buffer): string => createHash("sha256").update(value).digest("hex");
