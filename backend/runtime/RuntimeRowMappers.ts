import type { ProjectLoop } from "../../shared/domain/automation.js";
import type { EventRecord, RuntimeEvent } from "../../shared/domain/events.js";
import type {
  AgentOutcome,
  ExecutionRuntimeSnapshot,
  LoopExecutionPlan,
  LoopRun,
  StepRun
} from "../../shared/domain/runtime.js";
import { parseJsonArray, parseJsonObject } from "./RuntimeJson.js";
import type {
  EventRow,
  LoopRunRow,
  StepRunRow
} from "./RuntimeDbTypes.js";

export const toRuntimeEvent = (row: EventRow): RuntimeEvent => ({
  seq: row.seq,
  eventId: row.event_id,
  type: row.type,
  source: row.source,
  subject: row.subject,
  correlationId: row.correlation_id,
  causationId: row.causation_id ?? undefined,
  dedupeKey: row.dedupe_key ?? undefined,
  correlationDepth: row.correlation_depth,
  occurredAt: row.occurred_at,
  projectId: row.project_id,
  tags: parseJsonArray(row.tags_json),
  status: row.status,
  handlingResult: row.handling_result ?? undefined,
  payload: parseJsonObject(row.payload_json)
});

export const runtimeEventToEventRecord = (event: RuntimeEvent): EventRecord => ({
  id: event.eventId,
  eventId: event.eventId,
  projectId: event.projectId,
  source: event.source,
  type: event.type,
  eventType: event.type,
  subject: event.subject,
  correlationId: event.correlationId,
  causationId: event.causationId,
  dedupeKey: event.dedupeKey,
  correlationDepth: event.correlationDepth,
  occurredAt: event.occurredAt,
  tags: event.tags,
  payload: event.payload,
  status: event.status,
  handlingResult: event.handlingResult,
  createdAt: event.occurredAt
});

export const toEventRecord = (row: EventRow): EventRecord =>
  runtimeEventToEventRecord(toRuntimeEvent(row));

export const toLoopRun = (row: LoopRunRow): LoopRun => ({
  runId: row.run_id,
  loopId: row.loop_id,
  rootRunId: row.root_run_id,
  parentRunId: row.parent_run_id ?? undefined,
  parentStepRunId: row.parent_step_run_id ?? undefined,
  source: row.source,
  status: row.status,
  runtimeDeviceId: row.runtime_device_id ?? undefined,
  executionPlan: row.execution_plan_json ? JSON.parse(row.execution_plan_json) as LoopExecutionPlan : undefined,
  input: row.input ?? undefined,
  snapshot: JSON.parse(row.snapshot_json) as ProjectLoop,
  transitionCount: row.transition_count,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  completedAt: row.completed_at ?? undefined
});

export const toStepRun = (row: StepRunRow): StepRun => ({
  stepRunId: row.step_run_id,
  runId: row.run_id,
  loopId: row.loop_id,
  stepId: row.step_id,
  type: row.step_type,
  agentId: row.agent_id ?? undefined,
  executionTaskId: row.execution_task_id ?? undefined,
  execution: row.execution_snapshot_json ? JSON.parse(row.execution_snapshot_json) as ExecutionRuntimeSnapshot : undefined,
  status: row.status,
  input: row.input ?? undefined,
  responseInput: row.response_input ?? undefined,
  result: row.result ?? undefined,
  outcome: row.outcome_json ? JSON.parse(row.outcome_json) as AgentOutcome : undefined,
  error: row.error ?? undefined,
  attempt: row.attempt,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  completedAt: row.completed_at ?? undefined
});
