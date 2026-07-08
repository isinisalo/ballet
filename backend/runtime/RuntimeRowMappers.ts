import type { EventRecord, RuntimeEvent } from "../../shared/domain/events.js";
import type { AgentOutcome, AgentRun, AgentRunLog } from "../../shared/domain/runtime.js";
import { parseJsonArray, parseJsonObject, parseRoutingSummary } from "./RuntimeJson.js";
import type { AgentRunLogRow, AgentRunRow, EventRow } from "./RuntimeDbTypes.js";

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
  payload: parseJsonObject(row.payload_json),
  status: row.status,
  matchedPolicyId: row.matched_policy_id ?? undefined,
  assignedAgentId: row.assigned_agent_id ?? undefined,
  routing: parseRoutingSummary(row.routing_json),
  handlingResult: row.handling_result ?? undefined
});

export const runtimeEventToEventRecord = (event: RuntimeEvent): EventRecord => ({
  seq: event.seq,
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
  matchedPolicyId: event.matchedPolicyId,
  assignedAgentId: event.assignedAgentId,
  routing: event.routing,
  handlingResult: event.handlingResult,
  createdAt: event.occurredAt
});

export const toEventRecord = (row: EventRow): EventRecord =>
  runtimeEventToEventRecord(toRuntimeEvent(row));

export const toAgentRun = (row: AgentRunRow): AgentRun => ({
  runId: row.run_id,
  inputEventId: row.input_event_id,
  inputEventSeq: row.input_event_seq ?? undefined,
  policyId: row.policy_id,
  policyVersion: row.policy_version,
  agentRole: row.agent_role,
  status: row.status,
  attempt: row.attempt,
  leaseOwner: row.lease_owner ?? undefined,
  leaseUntil: row.lease_until ?? undefined,
  threadId: row.thread_id ?? undefined,
  turnId: row.turn_id ?? undefined,
  outcome: row.outcome_json ? JSON.parse(row.outcome_json) as AgentOutcome : undefined,
  error: row.error ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  completedAt: row.completed_at ?? undefined
});

export const toAgentRunLog = (row: AgentRunLogRow): AgentRunLog => ({
  id: row.id,
  runId: row.run_id,
  level: row.level,
  message: row.message,
  data: row.data_json ? parseJsonObject(row.data_json) : undefined,
  createdAt: row.created_at
});
