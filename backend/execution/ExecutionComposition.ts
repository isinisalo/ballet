import { createHash } from "node:crypto";
import {
  nodeOutcomeJsonSchemaForRole, nodeOutcomeSchemaIds
} from "../../shared/api/runtime-schemas.js";
import {
  isProjectAgentValidationNode,
  isProjectProviderJobNode,
  type JsonValue,
  type ProjectExecutionComposition
} from "../../shared/domain/automation.js";
import type {
  ExecutionPromptEvidence, ExecutionResourceEvidence, ExecutionResourceSnapshot,
  NodeRunRole, RootExecutionSnapshot
} from "../../shared/domain/runtime.js";
import type { TaskEnvelopeV6 } from "../../shared/domain/taskEnvelope.js";
import { serializeTaskEnvelopeV6 } from "../integration/TaskEnvelopeV6.js";
import { canonicalJson } from "../runtime/state/CanonicalJson.js";
import { ExecutionCompositionError } from "./ExecutionCompositionError.js";
import { SYSTEM_EXECUTION_INSTRUCTION_ID } from "./SystemExecutionContract.js";

export { ExecutionCompositionError } from "./ExecutionCompositionError.js";
export {
  MAX_PRIMARY_INSTRUCTION_BYTES, MAX_SKILL_BYTES, resolveExecutionResources,
  resolveExecutionResourcesFromCatalog, systemExecutionResourceSnapshot
} from "./ExecutionResourceCatalog.js";
export { SYSTEM_EXECUTION_INSTRUCTION, SYSTEM_EXECUTION_INSTRUCTION_ID } from "./SystemExecutionContract.js";

export const EXECUTION_COMPOSITION_VERSION = 7 as const;
export const NODE_OUTCOME_SCHEMA_VERSION = 6 as const;
export const MAX_EXECUTION_PROMPT_BYTES = 512 * 1024;

export const NODE_OUTCOME_SCHEMA_IDS = nodeOutcomeSchemaIds;

export const NODE_OUTCOME_SCHEMA_SHA256: Readonly<Record<NodeRunRole, string>> = {
  job: schemaHash("job"),
  validation: schemaHash("validation"),
  orchestrator: schemaHash("orchestrator")
};

export const composeExecutionPrompt = (
  snapshot: RootExecutionSnapshot,
  envelopeInput: TaskEnvelopeV6
): ExecutionPromptEvidence => {
  assertEnvelopeSnapshot(snapshot, envelopeInput);
  const envelope = serializeTaskEnvelopeV6(envelopeInput);
  const { role, loop } = envelope.envelope;
  const workflowNodeId = role === "orchestrator"
    ? undefined
    : role === "job" ? envelope.envelope.jobNode.id : envelope.envelope.validationNode.id;
  const jobNodeId = role === "orchestrator" ? undefined : envelope.envelope.jobNode.id;
  const composition = resolveComposition(snapshot, loop.id, workflowNodeId, role);
  const profile = snapshot.executionProfiles.find((candidate) => candidate.id === composition.executionProfileId);
  if (!profile) throw new ExecutionCompositionError(
    "missing_resource",
    `Root execution snapshot is missing execution profile ${composition.executionProfileId}.`
  );
  const system = requireResource(snapshot, "system", SYSTEM_EXECUTION_INSTRUCTION_ID);
  const primary = requireResource(snapshot, "primary", composition.primaryInstructionId);
  const skills = sortedIds(composition.skillIds).map((id) => requireResource(snapshot, "skill", id));
  const outputSchema = role === "validation"
    ? constrainValidationTransitionSchema(
      nodeOutcomeJsonSchemaForRole(role),
      envelope.envelope.role === "validation" ? envelope.envelope.allowedTransitions : []
    )
    : nodeOutcomeJsonSchemaForRole(role);
  const outputSchemaJson = canonicalJson(outputSchema);
  const prompt = [
    section("SYSTEM", system.id, system.content),
    section("PRIMARY", primary.id, primary.content),
    ...skills.map((skill) => section("SKILL", skill.id, skill.content)),
    section("TASK-ENVELOPE", "v6", envelope.serialized),
    section("OUTPUT-SCHEMA", "v6", outputSchemaJson)
  ].join("\n\n");
  const promptBytes = Buffer.byteLength(prompt, "utf8");
  if (promptBytes > MAX_EXECUTION_PROMPT_BYTES) throw new ExecutionCompositionError(
    "prompt_too_large",
    `Execution prompt for ${loop.id}:${jobNodeId ?? "orchestrator"}:${role} is ${promptBytes} bytes; the maximum is ${MAX_EXECUTION_PROMPT_BYTES} bytes.`
  );
  return {
    compositionVersion: EXECUTION_COMPOSITION_VERSION,
    loopId: loop.id,
    jobNodeId,
    workflowNodeId,
    nodeRole: role,
    nodeDefinitionId: `${loop.id}:${workflowNodeId ?? "root"}:${role}`,
    executionProfile: profile,
    resources: [system, primary, ...skills].map(resourceEvidence),
    prompt,
    promptSha256: sha256(prompt),
    taskEnvelopeVersion: 6,
    taskEnvelopeSha256: envelope.sha256,
    outputSchemaVersion: NODE_OUTCOME_SCHEMA_VERSION,
    outputSchemaId: NODE_OUTCOME_SCHEMA_IDS[role],
    outputSchema,
    outputSchemaSha256: schemaValueHash(outputSchema)
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

const assertEnvelopeSnapshot = (snapshot: RootExecutionSnapshot, envelope: TaskEnvelopeV6): void => {
  const loop = snapshot.loops.find((candidate) => candidate.id === envelope.loop.id);
  if (!loop || loop.description !== envelope.loop.description) throw new ExecutionCompositionError(
    "missing_resource",
    `Task Envelope Loop ${envelope.loop.id} does not match the immutable Root execution snapshot.`
  );
  if (envelope.role === "orchestrator") {
    assertOrchestrationEnvelope(snapshot, loop, envelope);
    return;
  }
  assertWorkflowEnvelope(loop, envelope);
  if (envelope.role === "validation") assertAllowedTransitions(snapshot, loop, envelope);
};

type SnapshotLoop = RootExecutionSnapshot["loops"][number];
type WorkflowEnvelope = Exclude<TaskEnvelopeV6, { role: "orchestrator" }>;
type OrchestratorEnvelope = Extract<TaskEnvelopeV6, { role: "orchestrator" }>;
type ValidationEnvelope = Extract<TaskEnvelopeV6, { role: "validation" }>;

const assertWorkflowEnvelope = (loop: SnapshotLoop, envelope: WorkflowEnvelope): void => {
  const job = loop.workflow.jobNodes.find((candidate) => candidate.id === envelope.jobNode.id);
  const definition = envelope.role === "job"
    ? job
    : loop.workflow.validationNodes.find((candidate) => candidate.id === envelope.validationNode.id);
  const identity = envelope.role === "job" ? envelope.jobNode : envelope.validationNode;
  if (!job || job.description !== envelope.jobNode.description
    || job.validationNodeId !== (envelope.role === "validation" ? envelope.validationNode.id : job.validationNodeId)
    || !definition || definition.description !== identity.description || definition.task !== envelope.task) {
    throw new ExecutionCompositionError(
      "missing_resource",
      `Task Envelope ${envelope.role} Node does not match ${loop.id}:${identity.id} in the immutable snapshot.`
    );
  }
};

const assertOrchestrationEnvelope = (
  snapshot: RootExecutionSnapshot,
  loop: SnapshotLoop,
  envelope: OrchestratorEnvelope
): void => {
  const request = envelope.orchestrationRequest;
  if (request.sourceLoopId !== loop.id || request.sourceLoopRunId !== envelope.run.loopRunId) {
    throw new ExecutionCompositionError(
      "missing_resource",
      `Task Envelope Orchestration Request source does not match ${loop.id}.`
    );
  }
  const expectedTargets = snapshot.graph.repairEdges
    .filter((edge) => edge.source === loop.id)
    .filter((edge) => !request.requestedCapability || edge.capability === request.requestedCapability)
    .flatMap((edge) => repairTarget(snapshot, edge));
  const actual = canonicalJson(sortedTargets(envelope.allowedCandidates) as unknown as JsonValue);
  const expected = canonicalJson(sortedTargets(expectedTargets) as unknown as JsonValue);
  if (actual !== expected) {
    throw new ExecutionCompositionError(
      "missing_resource",
      `Task Envelope allowed candidates do not match the ${request.kind} allowlist for ${loop.id}.`
    );
  }
};

const repairTarget = (
  snapshot: RootExecutionSnapshot,
  edge: RootExecutionSnapshot["graph"]["repairEdges"][number]
) => {
  const target = snapshot.loops.find((candidate) => candidate.id === edge.target);
  if (!target || !target.capabilities.provides.includes(edge.capability)) return [];
  return [{
    id: target.id,
    description: target.description,
    capabilities: target.capabilities,
    route: { kind: "repair" as const, capability: edge.capability, description: edge.description }
  }];
};

const assertAllowedTransitions = (
  snapshot: RootExecutionSnapshot,
  loop: SnapshotLoop,
  envelope: ValidationEnvelope
): void => {
  const passEdge = loop.workflow.passEdges.find((edge) => edge.sourceValidationNodeId === envelope.validationNode.id);
  const expected = snapshot.rootKind === "graph" && passEdge && "workflowResult" in passEdge.target
    ? snapshot.graph.transitions.filter((transition) => transition.source === loop.id)
      .sort((left, right) => compareUtf8(left.id, right.id))
    : [];
  if (canonicalJson(envelope.allowedTransitions as unknown as JsonValue)
    !== canonicalJson(expected as unknown as JsonValue)) {
    throw new ExecutionCompositionError(
      "missing_resource",
      `Task Envelope allowed transitions do not match the immutable RunBook for ${loop.id}.`
    );
  }
};

const resolveComposition = (
  snapshot: RootExecutionSnapshot,
  loopId: string,
  workflowNodeId: string | undefined,
  role: NodeRunRole
): ProjectExecutionComposition => {
  if (role === "orchestrator" && snapshot.orchestrator.repairRouter) return snapshot.orchestrator.repairRouter;
  const loop = snapshot.loops.find((candidate) => candidate.id === loopId);
  const job = loop?.workflow.jobNodes.find((candidate) => candidate.id === workflowNodeId);
  const validation = loop?.workflow.validationNodes.find((candidate) => candidate.id === workflowNodeId);
  if (role === "job" && job && isProjectProviderJobNode(job)) return job;
  if (role === "validation" && validation && isProjectAgentValidationNode(validation)) return validation;
  throw new ExecutionCompositionError(
    "missing_resource",
    `Root execution snapshot has no executable ${role} composition for ${loopId}:${workflowNodeId ?? "missing"}.`
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
  `<<< BALLET EXECUTION COMPOSITION V7 · ${kind} · ${id} >>>\n${content}\n<<< END BALLET ${kind} >>>`;
const compareUtf8 = (left: string, right: string): number => Buffer.compare(Buffer.from(left), Buffer.from(right));
const sortedIds = (ids: readonly string[]): string[] => [...ids].sort(compareUtf8);
const sortedTargets = <T extends { id: string; route: { capability: string } }>(targets: readonly T[]): T[] =>
  [...targets].sort((left, right) => compareUtf8(left.id, right.id)
    || compareUtf8(left.route.capability, right.route.capability));
function schemaHash(role: NodeRunRole): string {
  return sha256(canonicalJson(nodeOutcomeJsonSchemaForRole(role)));
}
function schemaValueHash(value: Record<string, JsonValue>): string {
  return sha256(canonicalJson(value));
}

export const constrainValidationTransitionSchema = (
  source: Record<string, JsonValue>,
  allowed: ReadonlyArray<{ decision: "PASS" | "FAIL"; outcome: string }>
): Record<string, JsonValue> => constrainSchemaValue(source, allowed) as Record<string, JsonValue>;

const constrainSchemaValue = (
  value: JsonValue,
  allowed: ReadonlyArray<{ decision: "PASS" | "FAIL"; outcome: string }>
): JsonValue => {
  if (Array.isArray(value)) return value.map((entry) => constrainSchemaValue(entry, allowed));
  if (!value || typeof value !== "object") return value;
  const result = Object.fromEntries(Object.entries(value)
    .map(([key, entry]) => [key, constrainSchemaValue(entry, allowed)])) as Record<string, JsonValue>;
  const properties = result.properties;
  if (properties && typeof properties === "object" && !Array.isArray(properties)) {
    const decision = properties.decision;
    const transition = properties.transitionOutcome;
    if (transition && typeof transition === "object" && !Array.isArray(transition)
      && decision && typeof decision === "object" && !Array.isArray(decision)) {
      const selectedDecision = typeof decision.const === "string" ? decision.const : undefined;
      if (selectedDecision === "PASS" || selectedDecision === "FAIL") {
        const outcomes = [...new Set(allowed.filter((candidate) => candidate.decision === selectedDecision)
          .map((candidate) => candidate.outcome))].sort(compareUtf8);
        properties.transitionOutcome = outcomes.length > 0
          ? { type: "string", enum: outcomes }
          : { not: {} };
      }
    }
  }
  return result;
};
function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
