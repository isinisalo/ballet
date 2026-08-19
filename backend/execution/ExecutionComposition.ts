import { createHash } from "node:crypto";
import {
  nodeOutcomeJsonSchemaForRole, nodeOutcomeSchemaIds
} from "../../shared/api/runtime-schemas.js";
import {
  isProjectAgentValidationNode,
  isProjectProviderWorkNode,
  type JsonValue,
  type ProjectExecutionComposition
} from "../../shared/domain/automation.js";
import type {
  ExecutionPromptEvidence, ExecutionResourceEvidence, ExecutionResourceSnapshot,
  NodeRunRole, RootExecutionSnapshot
} from "../../shared/domain/runtime.js";
import type { TaskEnvelopeV4 } from "../../shared/domain/taskEnvelope.js";
import { serializeTaskEnvelopeV4 } from "../integration/TaskEnvelopeV4.js";
import { canonicalJson } from "../runtime/state/CanonicalJson.js";
import { ExecutionCompositionError } from "./ExecutionCompositionError.js";
import { SYSTEM_EXECUTION_INSTRUCTION_ID } from "./SystemExecutionContract.js";

export { ExecutionCompositionError } from "./ExecutionCompositionError.js";
export {
  MAX_PRIMARY_INSTRUCTION_BYTES, MAX_SKILL_BYTES, resolveExecutionResources,
  resolveExecutionResourcesFromCatalog, systemExecutionResourceSnapshot
} from "./ExecutionResourceCatalog.js";
export { SYSTEM_EXECUTION_INSTRUCTION, SYSTEM_EXECUTION_INSTRUCTION_ID } from "./SystemExecutionContract.js";

export const EXECUTION_COMPOSITION_VERSION = 5 as const;
export const NODE_OUTCOME_SCHEMA_VERSION = 4 as const;
export const MAX_EXECUTION_PROMPT_BYTES = 512 * 1024;

export const NODE_OUTCOME_SCHEMA_IDS = nodeOutcomeSchemaIds;

export const NODE_OUTCOME_SCHEMA_SHA256: Readonly<Record<NodeRunRole, string>> = {
  work: schemaHash("work"),
  validation: schemaHash("validation"),
  orchestrator: schemaHash("orchestrator")
};

export const composeExecutionPrompt = (
  snapshot: RootExecutionSnapshot,
  envelopeInput: TaskEnvelopeV4
): ExecutionPromptEvidence => {
  assertEnvelopeSnapshot(snapshot, envelopeInput);
  const envelope = serializeTaskEnvelopeV4(envelopeInput);
  const { role, loop } = envelope.envelope;
  const workLoopNodeId = role === "orchestrator" ? undefined : envelope.envelope.workLoopNode.id;
  const composition = resolveComposition(snapshot, loop.id, workLoopNodeId, role);
  const profile = snapshot.executionProfiles.find((candidate) => candidate.id === composition.executionProfileId);
  if (!profile) throw new ExecutionCompositionError(
    "missing_resource",
    `Root execution snapshot is missing execution profile ${composition.executionProfileId}.`
  );
  const system = requireResource(snapshot, "system", SYSTEM_EXECUTION_INSTRUCTION_ID);
  const primary = requireResource(snapshot, "primary", composition.primaryInstructionId);
  const skills = sortedIds(composition.skillIds).map((id) => requireResource(snapshot, "skill", id));
  const outputSchema = nodeOutcomeJsonSchemaForRole(role);
  const outputSchemaJson = canonicalJson(outputSchema);
  const prompt = [
    section("SYSTEM", system.id, system.content),
    section("PRIMARY", primary.id, primary.content),
    ...skills.map((skill) => section("SKILL", skill.id, skill.content)),
    section("TASK-ENVELOPE", "v4", envelope.serialized),
    section("OUTPUT-SCHEMA", "v4", outputSchemaJson)
  ].join("\n\n");
  const promptBytes = Buffer.byteLength(prompt, "utf8");
  if (promptBytes > MAX_EXECUTION_PROMPT_BYTES) throw new ExecutionCompositionError(
    "prompt_too_large",
    `Execution prompt for ${loop.id}:${workLoopNodeId ?? "orchestrator"}:${role} is ${promptBytes} bytes; the maximum is ${MAX_EXECUTION_PROMPT_BYTES} bytes.`
  );
  return {
    compositionVersion: EXECUTION_COMPOSITION_VERSION,
    loopId: loop.id,
    workLoopNodeId,
    nodeRole: role,
    nodeDefinitionId: `${loop.id}:${workLoopNodeId ?? "root"}:${role}`,
    executionProfile: profile,
    resources: [system, primary, ...skills].map(resourceEvidence),
    prompt,
    promptSha256: sha256(prompt),
    taskEnvelopeVersion: 4,
    taskEnvelopeSha256: envelope.sha256,
    outputSchemaVersion: NODE_OUTCOME_SCHEMA_VERSION,
    outputSchemaId: NODE_OUTCOME_SCHEMA_IDS[role],
    outputSchema,
    outputSchemaSha256: NODE_OUTCOME_SCHEMA_SHA256[role]
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

const assertEnvelopeSnapshot = (snapshot: RootExecutionSnapshot, envelope: TaskEnvelopeV4): void => {
  const loop = snapshot.loops.find((candidate) => candidate.id === envelope.loop.id);
  if (!loop || loop.description !== envelope.loop.description) throw new ExecutionCompositionError(
    "missing_resource",
    `Task Envelope Loop ${envelope.loop.id} does not match the immutable Root execution snapshot.`
  );
  if (envelope.role === "orchestrator") {
    const request = envelope.orchestrationRequest;
    if (request.sourceLoopId !== loop.id || request.sourceLoopRunId !== envelope.run.loopRunId) {
      throw new ExecutionCompositionError(
        "missing_resource",
        `Task Envelope Orchestration Request source does not match ${loop.id}.`
      );
    }
    const expectedTargets = snapshot.graph.loopEdges
      .filter((edge) => edge.kind === request.kind && edge.source === loop.id)
      .filter((edge) => request.kind !== "repair" || !request.requestedCapability
        || edge.capability === request.requestedCapability)
      .flatMap((edge) => {
        const target = snapshot.loops.find((candidate) => candidate.id === edge.target);
        if (!target) return [];
        const compatible = edge.kind === "repair"
          ? target.capabilities.provides.includes(edge.capability)
          : target.capabilities.accepts.includes(edge.capability);
        return compatible ? [{
          id: target.id,
          description: target.description,
          capabilities: target.capabilities,
          route: { kind: edge.kind, capability: edge.capability, description: edge.description }
        }] : [];
      });
    const actual = canonicalJson(sortedTargets(envelope.allowedCandidates) as unknown as JsonValue);
    const expected = canonicalJson(sortedTargets(expectedTargets) as unknown as JsonValue);
    if (actual !== expected) {
      throw new ExecutionCompositionError(
        "missing_resource",
        `Task Envelope allowed candidates do not match the ${request.kind} allowlist for ${loop.id}.`
      );
    }
    return;
  }
  const node = loop.nodes.find((candidate) => candidate.id === envelope.workLoopNode.id);
  const definition = envelope.role === "work" ? node?.work : node?.validation;
  if (!node || node.description !== envelope.workLoopNode.description || definition?.task !== envelope.task) {
    throw new ExecutionCompositionError(
      "missing_resource",
      `Task Envelope ${envelope.role} Node does not match ${loop.id}:${envelope.workLoopNode.id} in the immutable snapshot.`
    );
  }
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
  `<<< BALLET EXECUTION COMPOSITION V5 · ${kind} · ${id} >>>\n${content}\n<<< END BALLET ${kind} >>>`;
const compareUtf8 = (left: string, right: string): number => Buffer.compare(Buffer.from(left), Buffer.from(right));
const sortedIds = (ids: readonly string[]): string[] => [...ids].sort(compareUtf8);
const sortedTargets = <T extends { id: string; route: { capability: string } }>(targets: readonly T[]): T[] =>
  [...targets].sort((left, right) => compareUtf8(left.id, right.id)
    || compareUtf8(left.route.capability, right.route.capability));
function schemaHash(role: NodeRunRole): string {
  return sha256(canonicalJson(nodeOutcomeJsonSchemaForRole(role)));
}
function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
