import { createHash } from "node:crypto";
import { nodeOutcomeJsonSchemaForRole, nodeOutcomeSchemaIds } from "../../shared/api/runtime-schemas.js";
import {
  isProjectAgentValidationNode,
  isProjectAgentWorkNode,
  type JsonValue,
  type ProjectExecutionComposition,
  type ProjectGraphNode
} from "../../shared/domain/automation.js";
import type {
  ExecutionPromptEvidence,
  ExecutionResourceEvidence,
  ExecutionResourceSnapshot,
  NodeRunRole,
  RootExecutionSnapshot
} from "../../shared/domain/runtime.js";
import type { TaskEnvelopeV9 } from "../../shared/domain/taskEnvelope.js";
import { serializeTaskEnvelopeV9 } from "../integration/TaskEnvelopeV9.js";
import { canonicalJson } from "../runtime/state/CanonicalJson.js";
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
export { SYSTEM_EXECUTION_INSTRUCTION, SYSTEM_EXECUTION_INSTRUCTION_ID } from "./SystemExecutionContract.js";

export const EXECUTION_COMPOSITION_VERSION = 10 as const;
export const NODE_OUTCOME_SCHEMA_VERSION = 9 as const;
export const MAX_EXECUTION_PROMPT_BYTES = 512 * 1024;
export const NODE_OUTCOME_SCHEMA_IDS = nodeOutcomeSchemaIds;
export const NODE_OUTCOME_SCHEMA_SHA256: Readonly<Record<NodeRunRole, string>> = {
  work: schemaHash("work"),
  validation: schemaHash("validation")
};

export function composeExecutionPrompt(
  snapshot: RootExecutionSnapshot,
  envelopeInput: TaskEnvelopeV9
): ExecutionPromptEvidence {
  assertEnvelopeSnapshot(snapshot, envelopeInput);
  const envelope = serializeTaskEnvelopeV9(envelopeInput);
  const composition = resolveComposition(snapshot, envelope.envelope);
  const profile = snapshot.executionProfiles.find(({ id }) => id === composition.executionProfileId);
  if (!profile) throw new ExecutionCompositionError(
    "missing_resource", `Root snapshot is missing execution profile ${composition.executionProfileId}.`
  );
  const system = requireResource(snapshot, "system", SYSTEM_EXECUTION_INSTRUCTION_ID);
  const primary = requireResource(snapshot, "primary", composition.primaryInstructionId);
  const skills = sortedIds(composition.skillIds).map((id) => requireResource(snapshot, "skill", id));
  const outputSchema = constrainOutcomeSchema(
    nodeOutcomeJsonSchemaForRole(envelope.envelope.role),
    envelope.envelope.role === "validation" ? envelope.envelope.allowedOutcomes.map(({ outcomeId }) => outcomeId) : []
  );
  const outputSchemaJson = canonicalJson(outputSchema);
  const prompt = [
    section("SYSTEM", system.id, system.content),
    section("PRIMARY", primary.id, primary.content),
    ...skills.map((skill) => section("SKILL", skill.id, skill.content)),
    section("TASK-ENVELOPE", "v9", envelope.serialized),
    section("OUTPUT-SCHEMA", "v9", outputSchemaJson)
  ].join("\n\n");
  if (Buffer.byteLength(prompt, "utf8") > MAX_EXECUTION_PROMPT_BYTES) throw new ExecutionCompositionError(
    "prompt_too_large", `Execution prompt for ${envelope.envelope.run.nodeRunId} exceeds the byte limit.`
  );
  return {
    compositionVersion: 10,
    graphNodeId: envelope.envelope.graphNode.id,
    actionNodeId: envelope.envelope.actionNode.id,
    nodeRole: envelope.envelope.role,
    nodeDefinitionId: composition.id,
    executionProfile: profile,
    resources: [system, primary, ...skills].map(resourceEvidence),
    prompt,
    promptSha256: sha256(prompt),
    taskEnvelopeVersion: 9,
    taskEnvelopeSha256: envelope.sha256,
    outputSchemaVersion: 9,
    outputSchemaId: NODE_OUTCOME_SCHEMA_IDS[envelope.envelope.role],
    outputSchema,
    outputSchemaSha256: sha256(outputSchemaJson)
  };
}

export function runtimeForNode(snapshot: RootExecutionSnapshot, executionProfileId: string) {
  const binding = snapshot.runtimes.find((candidate) => candidate.executionProfileId === executionProfileId);
  if (!binding) throw new ExecutionCompositionError(
    "missing_resource", `Root snapshot is missing runtime binding for ${executionProfileId}.`
  );
  return binding.runtime;
}

function resolveComposition(
  snapshot: RootExecutionSnapshot,
  envelope: TaskEnvelopeV9
): ProjectExecutionComposition & { id: string } {
  const graphNode = resolveGraphNode(snapshot, envelope.graphNode.id);
  const action = graphNode.actionNodes.find(({ id }) => id === envelope.actionNode.id);
  const composition = envelope.role === "work" ? action?.workNode : action?.validationNode;
  const valid = envelope.role === "work"
    ? composition && isProjectAgentWorkNode(composition)
    : composition && isProjectAgentValidationNode(composition);
  if (!valid) throw new ExecutionCompositionError(
    "missing_resource", `Root snapshot has no executable ${envelope.role} composition for ${envelope.run.nodeRunId}.`
  );
  return composition as ProjectExecutionComposition & { id: string };
}

function assertEnvelopeSnapshot(snapshot: RootExecutionSnapshot, envelope: TaskEnvelopeV9): void {
  const graphNode = resolveGraphNode(snapshot, envelope.graphNode.id);
  const action = graphNode.actionNodes.find(({ id }) => id === envelope.actionNode.id);
  const node = envelope.role === "work" ? action?.workNode : action?.validationNode;
  const identity = envelope.role === "work" ? envelope.workNode : envelope.validationNode;
  if (!action || action.description !== envelope.actionNode.description || !node || node.id !== identity.id
    || node.description !== identity.description || node.task !== envelope.task) {
    throw new ExecutionCompositionError("missing_resource", `Task Envelope ${envelope.role} Node is outside the snapshot.`);
  }
  if (envelope.role === "validation" && canonicalJson(envelope.allowedOutcomes as unknown as JsonValue)
    !== canonicalJson(action.outcomes as unknown as JsonValue)) {
    throw new ExecutionCompositionError("missing_resource", "Validation outcome enum differs from the Action Node contract.");
  }
  const immutableLedger = snapshot.acceptanceLedger.entries.map(({ obligationId, weight }) => ({ obligationId, weight }));
  const currentLedger = envelope.acceptanceLedger.entries.map(({ obligationId, weight }) => ({ obligationId, weight }));
  if (canonicalJson(immutableLedger) !== canonicalJson(currentLedger)) throw new ExecutionCompositionError(
    "missing_resource", "Acceptance ledger identities or weights differ from the immutable Root snapshot."
  );
}

function resolveGraphNode(snapshot: RootExecutionSnapshot, id: string): ProjectGraphNode {
  const graphNode = snapshot.graph.graphNodes.find((candidate) => candidate.id === id);
  if (!graphNode) throw new ExecutionCompositionError("missing_resource", `Graph Node ${id} is outside the snapshot.`);
  return graphNode;
}
function requireResource(snapshot: RootExecutionSnapshot, kind: ExecutionResourceSnapshot["kind"], id: string) {
  const resource = snapshot.resources.find((candidate) => candidate.kind === kind && candidate.id === id);
  if (!resource) throw new ExecutionCompositionError("missing_resource", `Root snapshot is missing ${kind} resource ${id}.`);
  return resource;
}
const resourceEvidence = (resource: ExecutionResourceSnapshot): ExecutionResourceEvidence => ({
  kind: resource.kind, origin: resource.origin, id: resource.id,
  relativePath: resource.relativePath, sourceSha256: resource.sourceSha256
});
const section = (kind: string, id: string, content: string): string =>
  `<<< BALLET EXECUTION COMPOSITION V10 · ${kind} · ${id} >>>\n${content}\n<<< END BALLET ${kind} >>>`;
const sortedIds = (ids: readonly string[]): string[] => [...ids].sort(compareUtf8);
const compareUtf8 = (left: string, right: string): number => Buffer.compare(Buffer.from(left), Buffer.from(right));
function sha256(value: string): string { return createHash("sha256").update(value, "utf8").digest("hex"); }
function schemaHash(role: NodeRunRole): string { return sha256(canonicalJson(nodeOutcomeJsonSchemaForRole(role))); }

export function constrainOutcomeSchema(
  source: Record<string, JsonValue>,
  allowedOutcomes: readonly string[]
): Record<string, JsonValue> {
  return constrainSchemaValue(source, allowedOutcomes) as Record<string, JsonValue>;
}
function constrainSchemaValue(value: JsonValue, allowedOutcomes: readonly string[]): JsonValue {
  if (Array.isArray(value)) return value.map((entry) => constrainSchemaValue(entry, allowedOutcomes));
  if (!value || typeof value !== "object") return value;
  const result = Object.fromEntries(Object.entries(value)
    .map(([key, entry]) => [key, constrainSchemaValue(entry, allowedOutcomes)])) as Record<string, JsonValue>;
  if (allowedOutcomes.length === 0 || !result.properties || Array.isArray(result.properties)
    || typeof result.properties !== "object") return result;
  const properties = result.properties as Record<string, JsonValue>;
  if (properties.outcomeId && typeof properties.outcomeId === "object" && !Array.isArray(properties.outcomeId)) {
    properties.outcomeId = { ...(properties.outcomeId as Record<string, JsonValue>), enum: [...allowedOutcomes] };
  }
  return result;
}
