import { createHash } from "node:crypto";
import { nodeOutcomeJsonSchema } from "../../shared/api/runtime-schemas.js";
import {
  isProjectAgentValidationNode,
  isProjectProviderWorkNode,
  type ProjectExecutionComposition
} from "../../shared/domain/automation.js";
import type {
  ExecutionPromptEvidence, ExecutionResourceEvidence, ExecutionResourceSnapshot,
  NodeRunRole, RootExecutionSnapshot
} from "../../shared/domain/runtime.js";
import { canonicalJson } from "../runtime/state/CanonicalJson.js";
import { ExecutionCompositionError } from "./ExecutionCompositionError.js";
import { SYSTEM_EXECUTION_INSTRUCTION_ID } from "./SystemExecutionContract.js";

export { ExecutionCompositionError } from "./ExecutionCompositionError.js";
export {
  MAX_PRIMARY_INSTRUCTION_BYTES, MAX_SKILL_BYTES, resolveExecutionResources,
  resolveExecutionResourcesFromCatalog, systemExecutionResourceSnapshot
} from "./ExecutionResourceCatalog.js";
export { SYSTEM_EXECUTION_INSTRUCTION, SYSTEM_EXECUTION_INSTRUCTION_ID } from "./SystemExecutionContract.js";

export const EXECUTION_COMPOSITION_VERSION = 2 as const;
export const NODE_OUTCOME_SCHEMA_VERSION = 2 as const;
export const MAX_EXECUTION_PROMPT_BYTES = 512 * 1024;

export const composeExecutionPrompt = (
  snapshot: RootExecutionSnapshot,
  loopId: string,
  workLoopNodeId: string | undefined,
  nodeRole: NodeRunRole,
  taskEnvelope: string
): ExecutionPromptEvidence => {
  const composition = resolveComposition(snapshot, loopId, workLoopNodeId, nodeRole);
  const profile = snapshot.executionProfiles.find((candidate) => candidate.id === composition.executionProfileId);
  if (!profile) throw new ExecutionCompositionError(
    "missing_resource",
    `Root execution snapshot is missing execution profile ${composition.executionProfileId}.`
  );
  const system = requireResource(snapshot, "system", SYSTEM_EXECUTION_INSTRUCTION_ID);
  const primary = requireResource(snapshot, "primary", composition.primaryInstructionId);
  const skills = sortedIds(composition.skillIds).map((id) => requireResource(snapshot, "skill", id));
  const outputSchema = nodeOutcomeJsonSchema;
  const outputSchemaJson = canonicalJson(outputSchema);
  const prompt = [
    section("SYSTEM", system.id, system.content),
    section("PRIMARY", primary.id, primary.content),
    ...skills.map((skill) => section("SKILL", skill.id, skill.content)),
    section("TASK-ENVELOPE", "v2", taskEnvelope),
    section("OUTPUT-SCHEMA", "v2", outputSchemaJson)
  ].join("\n\n");
  const promptBytes = Buffer.byteLength(prompt, "utf8");
  if (promptBytes > MAX_EXECUTION_PROMPT_BYTES) throw new ExecutionCompositionError(
    "prompt_too_large",
    `Execution prompt for ${loopId}:${workLoopNodeId ?? "orchestrator"}:${nodeRole} is ${promptBytes} bytes; the maximum is ${MAX_EXECUTION_PROMPT_BYTES} bytes.`
  );
  return {
    compositionVersion: EXECUTION_COMPOSITION_VERSION,
    loopId,
    workLoopNodeId,
    nodeRole,
    nodeDefinitionId: `${loopId}:${workLoopNodeId ?? "root"}:${nodeRole}`,
    executionProfile: profile,
    resources: [system, primary, ...skills].map(resourceEvidence),
    prompt,
    promptSha256: sha256(prompt),
    outputSchemaVersion: NODE_OUTCOME_SCHEMA_VERSION,
    outputSchema,
    outputSchemaSha256: sha256(outputSchemaJson)
  };
};

export const runtimeForNode = (snapshot: RootExecutionSnapshot, executionProfileId: string) => {
  const binding = snapshot.runtimes.find((candidate) => candidate.executionProfileId === executionProfileId);
  if (!binding) throw new ExecutionCompositionError(
    "missing_resource",
    `Root execution snapshot is missing runtime binding for ${executionProfileId}.`
  );
  return binding.runtime;
};

const resolveComposition = (
  snapshot: RootExecutionSnapshot,
  loopId: string,
  workLoopNodeId: string | undefined,
  role: NodeRunRole
): ProjectExecutionComposition => {
  if (role === "orchestrator") return snapshot.orchestrator;
  const loop = snapshot.loops.find((candidate) => candidate.id === loopId);
  const node = loop?.nodes.find((candidate) => candidate.id === workLoopNodeId);
  if (role === "work" && node && isProjectProviderWorkNode(node.work)) return node.work;
  if (role === "validation" && node && isProjectAgentValidationNode(node.validation)) return node.validation;
  throw new ExecutionCompositionError(
    "missing_resource",
    `Root execution snapshot has no executable ${role} composition for ${loopId}:${workLoopNodeId ?? "missing"}.`
  );
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
  kind: resource.kind, origin: resource.origin, id: resource.id,
  relativePath: resource.relativePath, sourceSha256: resource.sourceSha256
});
const section = (kind: string, id: string, content: string): string =>
  `<<< BALLET EXECUTION COMPOSITION V2 · ${kind} · ${id} >>>\n${content}\n<<< END BALLET ${kind} >>>`;
const sortedIds = (ids: readonly string[]): string[] => [...ids].sort();
const sha256 = (value: string): string => createHash("sha256").update(value, "utf8").digest("hex");
