import type {
  AgentOutcome,
  AgentRun,
  ExecutionEvent,
  ExecutionProjectSnapshot,
  ExecutionRuntimeSnapshot,
  ExecutionSpec,
  ExecutionTask,
  ExecutionTaskKind,
  ExecutionTaskStatus
} from "../../shared/domain/runtime.js";
import { parseObject } from "./json.js";

export interface ExecutionTaskRow {
  task_id: string;
  project_id: string;
  runtime_backend_id: string;
  device_id: string;
  kind: ExecutionTaskKind;
  root_run_id: string;
  status: ExecutionTaskStatus;
  spec_json: string;
  fencing: number;
  lease_until: string | null;
  claimed_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancel_requested_at: string | null;
  error_code: string | null;
  error_message: string | null;
  outcome_json: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentRunRow {
  run_id: string;
  project_id: string;
  agent_id: string;
  root_run_id: string;
  task_id: string;
  status: ExecutionTaskStatus;
  input: string | null;
  runtime_snapshot_json: string;
  project_snapshot_json: string;
  outcome_json: string | null;
  branch: string | null;
  worktree_path: string | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface ExecutionEventRow {
  id: number;
  task_id: string;
  sequence: number;
  source: ExecutionEvent["source"];
  kind: ExecutionEvent["kind"];
  level: ExecutionEvent["level"];
  phase: ExecutionEvent["phase"];
  item_id: string | null;
  message: string;
  data_json: string | null;
  content_bytes: number;
  terminal: 0 | 1;
  created_at: string;
}

export const toExecutionTask = (row: ExecutionTaskRow): ExecutionTask => ({
  id: row.task_id,
  projectId: row.project_id,
  runtimeBackendId: row.runtime_backend_id,
  deviceId: row.device_id,
  kind: row.kind,
  rootRunId: row.root_run_id,
  status: row.status,
  spec: JSON.parse(row.spec_json) as ExecutionSpec,
  fencing: row.fencing,
  leaseUntil: row.lease_until ?? undefined,
  claimedAt: row.claimed_at ?? undefined,
  startedAt: row.started_at ?? undefined,
  completedAt: row.completed_at ?? undefined,
  cancelRequestedAt: row.cancel_requested_at ?? undefined,
  errorCode: row.error_code ?? undefined,
  errorMessage: row.error_message ?? undefined,
  outcome: row.outcome_json ? JSON.parse(row.outcome_json) as AgentOutcome : undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export const toAgentRun = (row: AgentRunRow): AgentRun => ({
  id: row.run_id,
  projectId: row.project_id,
  agentId: row.agent_id,
  rootRunId: row.root_run_id,
  taskId: row.task_id,
  status: row.status,
  input: row.input ?? undefined,
  runtime: JSON.parse(row.runtime_snapshot_json) as ExecutionRuntimeSnapshot,
  project: JSON.parse(row.project_snapshot_json) as ExecutionProjectSnapshot,
  outcome: row.outcome_json ? JSON.parse(row.outcome_json) as AgentOutcome : undefined,
  branch: row.branch ?? undefined,
  worktreePath: row.worktree_path ?? undefined,
  errorCode: row.error_code ?? undefined,
  errorMessage: row.error_message ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  completedAt: row.completed_at ?? undefined
});

export const toExecutionEvent = (row: ExecutionEventRow): ExecutionEvent => ({
  id: row.id,
  taskId: row.task_id,
  sequence: row.sequence,
  source: row.source,
  kind: row.kind,
  level: row.level,
  phase: row.phase,
  itemId: row.item_id ?? undefined,
  message: row.message,
  data: parseObject(row.data_json),
  contentBytes: row.content_bytes,
  terminal: Boolean(row.terminal),
  createdAt: row.created_at
});
