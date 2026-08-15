import { createHash } from "node:crypto";
import {
  nodeOutcomeJsonSchemaForRole, nodeOutcomeSchemaIds, parseNodeOutcomeForRole
} from "../../shared/api/runtime-schemas.js";
import type {
  CanonicalNodeOutcome, ExecutionEvent, ExecutionSpec, ExecutionTask
} from "../../shared/domain/runtime.js";
import { parseSerializedTaskEnvelopeV2 } from "../integration/TaskEnvelopeV2.js";
import { canonicalJson } from "../runtime/state/CanonicalJson.js";
import type { ExecutionEventRow, ExecutionTaskRow } from "./ExecutionDbTypes.js";
import { executionSpecSchema } from "./ExecutionSpecSchema.js";

export const toExecutionTask = (row: ExecutionTaskRow): ExecutionTask => {
  if (sha256(row.spec_json) !== row.spec_hash) {
    throw new Error(`Execution task ${row.task_id} has invalid persisted specification evidence.`);
  }
  const spec = executionSpecSchema.parse(JSON.parse(row.spec_json));
  assertExecutionSpecEvidence(spec);
  if (spec.taskId !== row.task_id || spec.rootRunId !== row.root_run_id
    || spec.nodeRunId !== row.node_run_id || spec.kind !== row.kind) {
    throw new Error(`Execution task ${row.task_id} has inconsistent persisted specification identity.`);
  }
  return {
    id: row.task_id, kind: row.kind, rootRunId: row.root_run_id, status: row.status,
    spec, startedAt: row.started_at ?? undefined, completedAt: row.completed_at ?? undefined,
    cancelRequestedAt: row.cancel_requested_at ?? undefined, errorCode: row.error_code ?? undefined,
    errorMessage: row.error_message ?? undefined,
    outcome: row.outcome_json ? parseOutcome(row.outcome_json, row.task_id, spec.evidence.nodeRole) : undefined,
    createdAt: row.created_at, updatedAt: row.updated_at
  };
};

export const assertExecutionSpecEvidence = (spec: ExecutionSpec): void => {
  executionSpecSchema.parse(spec);
  if (sha256(spec.evidence.prompt) !== spec.evidence.promptSha256) {
    throw new Error(`Execution task ${spec.taskId} has invalid prompt evidence.`);
  }
  const taskEnvelope = parseSerializedTaskEnvelopeV2(promptSection(
    spec.evidence.prompt, "TASK-ENVELOPE", "v2", spec.taskId
  ));
  if (taskEnvelope.sha256 !== spec.evidence.taskEnvelopeSha256
    || taskEnvelope.envelope.role !== spec.evidence.nodeRole
    || taskEnvelope.envelope.run.rootRunId !== spec.rootRunId
    || taskEnvelope.envelope.run.loopRunId !== spec.loopRunId
    || taskEnvelope.envelope.run.nodeRunId !== spec.nodeRunId
    || taskEnvelope.envelope.loop.id !== spec.evidence.loopId
    || (taskEnvelope.envelope.role !== "orchestrator"
      && (taskEnvelope.envelope.run.workLoopNodeRunId !== spec.workLoopNodeRunId
        || taskEnvelope.envelope.workLoopNode.id !== spec.evidence.workLoopNodeId))) {
    throw new Error(`Execution task ${spec.taskId} has invalid Task Envelope evidence.`);
  }
  const schemaJson = canonicalJson(spec.evidence.outputSchema);
  const expectedSchema = canonicalJson(nodeOutcomeJsonSchemaForRole(spec.evidence.nodeRole));
  if (spec.evidence.outputSchemaSha256 !== sha256(schemaJson)
    || schemaJson !== expectedSchema
    || promptSection(spec.evidence.prompt, "OUTPUT-SCHEMA", "v3", spec.taskId) !== schemaJson
    || spec.evidence.outputSchemaId !== nodeOutcomeSchemaIds[spec.evidence.nodeRole]) {
    throw new Error(`Execution task ${spec.taskId} has invalid output schema evidence.`);
  }
  if (spec.evidence.executionProfile.provider !== spec.runtime.provider
    || spec.evidence.executionProfile.model !== spec.runtime.model
    || spec.evidence.executionProfile.reasoningEffort !== spec.runtime.reasoning
    || spec.evidence.executionProfile.networkAccess !== spec.runtime.policy.network) {
    throw new Error(`Execution task ${spec.taskId} has inconsistent profile and runtime evidence.`);
  }
};

export const toExecutionEvent = (row: ExecutionEventRow): ExecutionEvent => ({
  id: row.id, taskId: row.task_id, sequence: row.sequence, source: row.source, kind: row.kind,
  level: row.level, phase: row.phase, itemId: row.item_id ?? undefined, message: row.message,
  data: row.data_json ? parseEventData(row.data_json, row.task_id) : undefined,
  contentBytes: row.content_bytes, terminal: Boolean(row.terminal), createdAt: row.created_at
});

const parseOutcome = (
  source: string,
  taskId: string,
  role: ExecutionSpec["evidence"]["nodeRole"]
): CanonicalNodeOutcome => {
  try {
    return parseNodeOutcomeForRole(role, JSON.parse(source));
  } catch {
    throw new Error(`Execution task ${taskId} has an invalid persisted ${role} outcome.`);
  }
};

const parseEventData = (source: string, taskId: string): Record<string, unknown> => {
  const value: unknown = JSON.parse(source);
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Execution task ${taskId} has invalid persisted event data.`);
  }
  return Object.fromEntries(Object.entries(value));
};

const sha256 = (value: string): string => createHash("sha256").update(value, "utf8").digest("hex");

const promptSection = (prompt: string, kind: string, id: string, taskId: string): string => {
  const opening = `<<< BALLET EXECUTION COMPOSITION V3 · ${kind} · ${id} >>>\n`;
  const closing = `\n<<< END BALLET ${kind} >>>`;
  const start = prompt.indexOf(opening);
  if (start < 0 || prompt.indexOf(opening, start + opening.length) >= 0) {
    throw new Error(`Execution task ${taskId} has invalid ${kind} prompt evidence.`);
  }
  const contentStart = start + opening.length;
  const end = prompt.indexOf(closing, contentStart);
  if (end < 0 || prompt.indexOf(closing, end + closing.length) >= 0) {
    throw new Error(`Execution task ${taskId} has invalid ${kind} prompt evidence.`);
  }
  return prompt.slice(contentStart, end);
};
