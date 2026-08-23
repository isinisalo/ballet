import { createHash } from "node:crypto";
import { nodeOutcomeJsonSchemaForRole, nodeOutcomeSchemaIds } from "../../shared/api/runtime-schemas.js";
import {
  isProjectAgentValidationNode, isProjectAgentWorkNode, routeTargetKey,
  type JsonValue, type ProjectExecutionComposition, type ProjectGraphNode
} from "../../shared/domain/automation.js";
import type {
  ExecutionPromptEvidence, ExecutionResourceEvidence, ExecutionResourceSnapshot,
  NodeRunRole, RootExecutionSnapshot
} from "../../shared/domain/runtime.js";
import type { TaskEnvelopeV8 } from "../../shared/domain/taskEnvelope.js";
import { serializeTaskEnvelopeV8 } from "../integration/TaskEnvelopeV8.js";
import { canonicalJson } from "../runtime/state/CanonicalJson.js";
import { ExecutionCompositionError } from "./ExecutionCompositionError.js";
import { SYSTEM_EXECUTION_INSTRUCTION_ID } from "./SystemExecutionContract.js";

export { ExecutionCompositionError } from "./ExecutionCompositionError.js";
export {
  MAX_PRIMARY_INSTRUCTION_BYTES, MAX_SKILL_BYTES, resolveExecutionResources,
  resolveExecutionResourcesFromCatalog, systemExecutionResourceSnapshot
} from "./ExecutionResourceCatalog.js";
export { SYSTEM_EXECUTION_INSTRUCTION, SYSTEM_EXECUTION_INSTRUCTION_ID } from "./SystemExecutionContract.js";

export const EXECUTION_COMPOSITION_VERSION = 9 as const;
export const NODE_OUTCOME_SCHEMA_VERSION = 8 as const;
export const MAX_EXECUTION_PROMPT_BYTES = 512 * 1024;
export const NODE_OUTCOME_SCHEMA_IDS = nodeOutcomeSchemaIds;
export const NODE_OUTCOME_SCHEMA_SHA256: Readonly<Record<NodeRunRole, string>> = {
  work: schemaHash("work"),
  validation: schemaHash("validation"),
  orchestrator: schemaHash("orchestrator"),
  repair: schemaHash("repair")
};

export const composeExecutionPrompt = (
  snapshot: RootExecutionSnapshot,
  envelopeInput: TaskEnvelopeV8
): ExecutionPromptEvidence => {
  assertEnvelopeSnapshot(snapshot, envelopeInput);
  const envelope = serializeTaskEnvelopeV8(envelopeInput);
  const composition = resolveComposition(snapshot, envelope.envelope);
  const profile = snapshot.executionProfiles.find((candidate) => candidate.id === composition.executionProfileId);
  if (!profile) throw new ExecutionCompositionError(
    "missing_resource",
    `Root execution snapshot is missing execution profile ${composition.executionProfileId}.`
  );
  const system = requireResource(snapshot, "system", SYSTEM_EXECUTION_INSTRUCTION_ID);
  const primary = requireResource(snapshot, "primary", composition.primaryInstructionId);
  const skills = sortedIds(composition.skillIds).map((id) => requireResource(snapshot, "skill", id));
  const outputSchema = constrainRouteTargetSchema(
    nodeOutcomeJsonSchemaForRole(envelope.envelope.role),
    envelope.envelope.role === "orchestrator" || envelope.envelope.role === "repair"
      ? envelope.envelope.allowedCandidates.map(({ key }) => key)
      : [],
    envelope.envelope.role === "validation" || envelope.envelope.role === "orchestrator"
      ? envelope.envelope.allowedOutcomes.map(({ outcomeId }) => outcomeId) : []
  );
  const outputSchemaJson = canonicalJson(outputSchema);
  const prompt = [
    section("SYSTEM", system.id, system.content),
    section("PRIMARY", primary.id, primary.content),
    ...skills.map((skill) => section("SKILL", skill.id, skill.content)),
    section("TASK-ENVELOPE", "v8", envelope.serialized),
    section("OUTPUT-SCHEMA", "v8", outputSchemaJson)
  ].join("\n\n");
  const promptBytes = Buffer.byteLength(prompt, "utf8");
  if (promptBytes > MAX_EXECUTION_PROMPT_BYTES) throw new ExecutionCompositionError(
    "prompt_too_large",
    `Execution prompt for ${envelope.envelope.run.nodeRunId} is ${promptBytes} bytes; the maximum is ${MAX_EXECUTION_PROMPT_BYTES} bytes.`
  );
  const graphNodeId = "graphNode" in envelope.envelope ? envelope.envelope.graphNode?.id : undefined;
  const jobNodeId = "jobNode" in envelope.envelope ? envelope.envelope.jobNode.id : undefined;
  return {
    compositionVersion: 9,
    graphNodeId,
    jobNodeId,
    nodeRole: envelope.envelope.role,
    orchestrationScope: envelope.envelope.role === "orchestrator" || envelope.envelope.role === "repair"
      ? envelope.envelope.scope : undefined,
    nodeDefinitionId: composition.id,
    executionProfile: profile,
    resources: [system, primary, ...skills].map(resourceEvidence),
    prompt,
    promptSha256: sha256(prompt),
    taskEnvelopeVersion: 8,
    taskEnvelopeSha256: envelope.sha256,
    outputSchemaVersion: 8,
    outputSchemaId: NODE_OUTCOME_SCHEMA_IDS[envelope.envelope.role],
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
  envelope: TaskEnvelopeV8
): ProjectExecutionComposition & { id: string } => {
  const graphNode = resolveGraphNode(snapshot, envelope);
  if (envelope.role === "orchestrator") {
    if (envelope.scope === "graph") {
      if (snapshot.graph.strategy.kind !== "agent_v1") throw new ExecutionCompositionError(
        "missing_resource", "SSP Graph scope has no agent orchestrator composition."
      );
      return snapshot.graph.strategy.orchestrator;
    }
    const strategy = requireGraphNode(graphNode).strategy;
    if (strategy.kind !== "agent_v1") throw new ExecutionCompositionError(
      "missing_resource", "SSP Graph Node scope has no agent orchestrator composition."
    );
    return strategy.orchestrator;
  }
  if (envelope.role === "repair") {
    const repair = envelope.scope === "graph" ? snapshot.graph.repairNode : requireGraphNode(graphNode).repairNode;
    if (repair) return repair;
  }
  if (envelope.role === "work") {
    const work = findJob(requireGraphNode(graphNode), envelope.jobNode.id)?.workNode;
    if (work && isProjectAgentWorkNode(work)) return work;
  }
  if (envelope.role === "validation") {
    const validation = findJob(requireGraphNode(graphNode), envelope.jobNode.id)?.validationNode;
    if (validation && isProjectAgentValidationNode(validation)) return validation;
  }
  throw new ExecutionCompositionError(
    "missing_resource",
    `Root execution snapshot has no executable ${envelope.role} composition for ${envelope.run.nodeRunId}.`
  );
};

const assertEnvelopeSnapshot = (snapshot: RootExecutionSnapshot, envelope: TaskEnvelopeV8): void => {
  if (envelope.run.rootRunId.length === 0) throw new ExecutionCompositionError("missing_resource", "Task Envelope has no Root Run.");
  const graphNode = resolveGraphNode(snapshot, envelope);
  if ("graphNode" in envelope && envelope.graphNode) {
    if (!graphNode || graphNode.description !== envelope.graphNode.description) {
      throw new ExecutionCompositionError("missing_resource", `Task Envelope Graph Node ${envelope.graphNode.id} is outside the snapshot.`);
    }
  }
  if (envelope.role === "work" || envelope.role === "validation") {
    const job = findJob(requireGraphNode(graphNode), envelope.jobNode.id);
    const node = envelope.role === "work" ? job?.workNode : job?.validationNode;
    const identity = envelope.role === "work" ? envelope.workNode : envelope.validationNode;
    if (!job || job.description !== envelope.jobNode.description || !node
      || node.id !== identity.id || node.description !== identity.description || node.task !== envelope.task) {
      throw new ExecutionCompositionError("missing_resource", `Task Envelope ${envelope.role} Node is outside the snapshot.`);
    }
    if (envelope.role === "validation" && canonicalJson(envelope.allowedOutcomes as unknown as JsonValue)
      !== canonicalJson(job.outcomes as unknown as JsonValue)) {
      throw new ExecutionCompositionError("missing_resource", "Validation outcome enum differs from the immutable Job Node contract.");
    }
  }
  if (envelope.role === "orchestrator") {
    assertCandidateSet(snapshot, graphNode, envelope);
    const expectedOutcomes = envelope.scope === "graph_node" ? graphNode?.outcomes ?? [] : [];
    if (canonicalJson(envelope.allowedOutcomes as unknown as JsonValue)
      !== canonicalJson(expectedOutcomes as unknown as JsonValue)) {
      throw new ExecutionCompositionError("missing_resource", "Orchestrator outcome enum differs from the immutable Graph Node contract.");
    }
  }
  if (envelope.role === "repair") {
    const repair = envelope.scope === "graph" ? snapshot.graph.repairNode : graphNode?.repairNode;
    if (!repair || repair.task !== envelope.task) {
      throw new ExecutionCompositionError("missing_resource", "Task Envelope Repair Node is outside the snapshot.");
    }
  }
};

const assertCandidateSet = (
  snapshot: RootExecutionSnapshot,
  graphNode: ProjectGraphNode | undefined,
  envelope: Extract<TaskEnvelopeV8, { role: "orchestrator" }>
): void => {
  const localGraphNode = envelope.scope === "graph_node" ? requireGraphNode(graphNode) : undefined;
  const routing = envelope.scope === "graph"
    ? snapshot.graph.strategy.kind === "agent_v1" ? snapshot.graph.strategy.orchestrator.routing
      : undefined
    : localGraphNode?.strategy.kind === "agent_v1"
      ? localGraphNode.strategy.orchestrator.routing : undefined;
  if (!routing) throw new ExecutionCompositionError("missing_resource", "SSP Graph scope cannot produce an agent routing envelope.");
  const rule = envelope.request.kind === "start"
    ? routing.start
    : envelope.request.kind === "continuation"
      ? routing.continuation.find((candidate) =>
        candidate.sourceId === envelope.request.sourceChildId && candidate.result === envelope.request.result)
      : routing.repair.find((candidate) =>
        candidate.sourceId === envelope.request.sourceChildId
        && candidate.capability === envelope.request.requestedCapability);
  const expected = rule?.candidates ?? [];
  const actualKeys = envelope.allowedCandidates.map(({ key }) => key);
  const expectedKeys = expected.map(({ target }) => routeTargetKey(target));
  if (canonicalJson(actualKeys) !== canonicalJson(expectedKeys)) {
    throw new ExecutionCompositionError("missing_resource", "Task Envelope candidates differ from the immutable authored rule.");
  }
};

const resolveGraphNode = (snapshot: RootExecutionSnapshot, envelope: TaskEnvelopeV8): ProjectGraphNode | undefined => {
  const id = "graphNode" in envelope ? envelope.graphNode?.id : undefined;
  return id ? snapshot.graph.graphNodes.find((candidate) => candidate.id === id) : undefined;
};
const requireGraphNode = (value: ProjectGraphNode | undefined): ProjectGraphNode => {
  if (!value) throw new ExecutionCompositionError("missing_resource", "Task Envelope has no in-snapshot Graph Node.");
  return value;
};
const findJob = (graphNode: ProjectGraphNode, id: string) =>
  graphNode.jobNodes.find((candidate) => candidate.id === id);
const requireResource = (
  snapshot: RootExecutionSnapshot,
  kind: ExecutionResourceSnapshot["kind"],
  id: string
): ExecutionResourceSnapshot => {
  const resource = snapshot.resources.find((candidate) => candidate.kind === kind && candidate.id === id);
  if (!resource) throw new ExecutionCompositionError("missing_resource", `Root snapshot is missing ${kind} resource ${id}.`);
  return resource;
};
const resourceEvidence = (resource: ExecutionResourceSnapshot): ExecutionResourceEvidence => ({
  kind: resource.kind, origin: resource.origin, id: resource.id,
  relativePath: resource.relativePath, sourceSha256: resource.sourceSha256
});
const section = (kind: string, id: string, content: string): string =>
  `<<< BALLET EXECUTION COMPOSITION V9 · ${kind} · ${id} >>>\n${content}\n<<< END BALLET ${kind} >>>`;
const sortedIds = (ids: readonly string[]): string[] => [...ids].sort(compareUtf8);
const compareUtf8 = (left: string, right: string): number => Buffer.compare(Buffer.from(left), Buffer.from(right));
function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
function schemaHash(role: NodeRunRole): string {
  return sha256(canonicalJson(nodeOutcomeJsonSchemaForRole(role)));
}

export const constrainRouteTargetSchema = (
  source: Record<string, JsonValue>,
  allowedTargets: readonly string[],
  allowedOutcomes: readonly string[] = []
): Record<string, JsonValue> => constrainSchemaValue(source, allowedTargets, allowedOutcomes) as Record<string, JsonValue>;

const constrainSchemaValue = (value: JsonValue, allowedTargets: readonly string[], allowedOutcomes: readonly string[]): JsonValue => {
  if (Array.isArray(value)) return value.map((entry) => constrainSchemaValue(entry, allowedTargets, allowedOutcomes));
  if (!value || typeof value !== "object") return value;
  const result = Object.fromEntries(Object.entries(value)
    .map(([key, entry]) => [key, constrainSchemaValue(entry, allowedTargets, allowedOutcomes)])) as Record<string, JsonValue>;
  if (result.properties && !Array.isArray(result.properties) && typeof result.properties === "object") {
    const properties = result.properties as Record<string, JsonValue>;
    if (allowedTargets.length > 0 && properties.target && typeof properties.target === "object" && !Array.isArray(properties.target)) {
      properties.target = { ...(properties.target as Record<string, JsonValue>), enum: [...allowedTargets] };
    }
    if (allowedOutcomes.length > 0 && properties.outcomeId && typeof properties.outcomeId === "object"
      && !Array.isArray(properties.outcomeId)) {
      properties.outcomeId = { ...(properties.outcomeId as Record<string, JsonValue>), enum: [...allowedOutcomes] };
      const required = Array.isArray(result.required) ? result.required.filter((entry): entry is string => typeof entry === "string") : [];
      result.required = [...new Set([...required, "outcomeId"])];
    }
  }
  return result;
};
