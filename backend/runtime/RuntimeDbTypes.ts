import { z } from "zod";

const nullableString = z.string().nullable();
const nullableInteger = z.number().int().nullable();

export const loopRunRowSchema = z.object({
  loop_run_id: z.string(), root_run_id: z.string(), loop_id: z.string(), parent_loop_run_id: nullableString,
  source: z.enum(["manual", "flow", "repair", "schedule"]),
  status: z.enum(["queued", "running", "waiting_for_input", "completed", "blocked", "failed", "cancelled"]),
  input_json: nullableString, orchestration_request_id: nullableString,
  repair_request_id: nullableString, orchestration_frame_id: nullableString,
  schedule_job_node_id: nullableString, scheduled_for: nullableString,
  entry_state_revision: z.number().int(), completion_state_revision: nullableInteger,
  nesting_depth: z.number().int(), created_at: z.string(), updated_at: z.string(), completed_at: nullableString
}).strict();

export const jobRunRowSchema = z.object({
  job_run_id: z.string(), root_run_id: z.string(), loop_run_id: z.string(), loop_id: z.string(),
  job_node_id: z.string(), job_attempt: z.number().int(),
  status: z.enum(["queued", "running", "waiting_for_input", "completed", "blocked", "failed", "cancelled"]),
  state_revision_before: z.number().int(), state_revision_after: nullableInteger, active_node_run_id: nullableString,
  terminal: z.enum(["completed", "blocked", "failed", "cancelled"]).nullable(),
  error_code: nullableString, error_message: nullableString, created_at: z.string(), updated_at: z.string(),
  completed_at: nullableString
}).strict();

export const nodeRunRowSchema = z.object({
  node_run_id: z.string(), root_run_id: z.string(), loop_run_id: z.string(), job_run_id: nullableString,
  role: z.enum(["job", "validation", "orchestrator"]), loop_id: z.string(), job_node_id: nullableString,
  workflow_node_id: nullableString,
  node_definition_id: z.string(), execution_task_id: nullableString, input_json: nullableString,
  context_json: nullableString, outcome_json: nullableString,
  status: z.enum(["queued", "running", "waiting_for_input", "completed", "blocked", "failed", "cancelled", "interrupted"]),
  attempt: z.number().int(), state_revision_before: z.number().int(), state_revision_after: nullableInteger,
  patch_json: nullableString, patch_hash: nullableString, error_code: nullableString, error_message: nullableString,
  created_at: z.string(), started_at: nullableString, updated_at: z.string(), completed_at: nullableString
}).strict();

export const stateRevisionRowSchema = z.object({
  root_run_id: z.string(), revision: z.number().int(), parent_revision: nullableInteger,
  state_json: z.string(), state_hash: z.string(), patch_json: nullableString, patch_hash: nullableString,
  source_node_run_id: nullableString, outcome_json: nullableString, created_at: z.string()
}).strict();

export const repairRequestRowSchema = z.object({
  repair_request_id: z.string(), root_run_id: z.string(), requester_loop_run_id: z.string(),
  requester_job_run_id: z.string(), requester_validation_node_run_id: z.string(),
  attempt: z.number().int(), validation_summary: z.string(),
  requested_capability: nullableString, requested_outcome_json: nullableString, reason: z.string(),
  evidence_json: nullableString, state_revision_at_request: z.number().int(), orchestrator_node_run_id: nullableString,
  routed_loop_edge_id: nullableString,
  routed_target_loop_id: nullableString,
  status: z.enum(["pending", "routed", "repaired", "failed", "cancelled"]),
  return_loop_id: z.string(), return_job_node_id: z.string(), return_validation_node_definition_id: z.string(),
  nesting_depth: z.number().int(), created_at: z.string(), updated_at: z.string(), completed_at: nullableString
}).strict();

export const orchestrationRequestRowSchema = z.object({
  orchestration_request_id: z.string(), root_run_id: z.string(), kind: z.enum(["flow", "repair"]),
  source_loop_run_id: z.string(), source_loop_id: z.string(), source_node_run_id: z.string(),
  state_revision_at_request: z.number().int(), completion_summary: z.string(),
  completion_evidence_json: z.string(), requested_capability: nullableString,
  expected_outcome_json: nullableString, repair_request_id: nullableString,
  orchestrator_node_run_id: nullableString, routed_loop_edge_id: nullableString,
  routed_target_loop_id: nullableString, target_loop_run_id: nullableString,
  status: z.enum(["pending", "waiting_for_input", "routed", "dispatched", "failed", "cancelled"]),
  created_at: z.string(), updated_at: z.string(), completed_at: nullableString
}).strict();

export const orchestrationFrameRowSchema = z.object({
  frame_id: z.string(), root_run_id: z.string(), repair_request_id: z.string(), route_id: z.string(),
  caller_loop_run_id: z.string(),
  callee_loop_run_id: z.string(), parent_frame_id: nullableString, return_loop_id: z.string(),
  return_job_node_id: z.string(), return_validation_node_definition_id: z.string(),
  state_revision_at_call: z.number().int(), nesting_depth: z.number().int(),
  status: z.enum(["open", "returned", "failed", "cancelled"]), created_at: z.string(),
  updated_at: z.string(), completed_at: nullableString
}).strict();

export const repairResultRowSchema = z.object({
  repair_result_id: z.string(), root_run_id: z.string(), repair_request_id: z.string(),
  orchestration_frame_id: z.string(), target_loop_run_id: z.string(), target_loop_id: z.string(),
  status: z.enum(["repaired", "blocked", "failed", "cancelled"]), state_revision: z.number().int(),
  outcome_json: nullableString, summary: z.string(), created_at: z.string()
}).strict();

export const orchestratorRouteRowSchema = z.object({
  route_id: z.string(), root_run_id: z.string(), orchestration_request_id: z.string(),
  kind: z.enum(["flow", "repair"]), repair_request_id: nullableString,
  orchestrator_node_run_id: z.string(), loop_edge_id: z.string(), source_loop_id: z.string(),
  target_loop_id: z.string(), route_evidence_json: nullableString, created_at: z.string()
}).strict();

export const controlFlowEventRowSchema = z.object({
  id: z.number().int(), root_run_id: z.string(), sequence: z.number().int(),
  kind: z.enum([
    "job_completed", "job_needs_input", "job_terminal", "validation_pass",
    "validation_fail_retry", "validation_fail_escalated", "validation_terminal", "repair_call",
    "repair_return", "repair_terminal", "flow_transition", "orchestrator_terminal",
    "root_cancelled", "root_terminal", "execution_interrupted"
  ]),
  state_revision: z.number().int(), source_loop_run_id: nullableString,
  source_job_run_id: nullableString, source_node_run_id: nullableString,
  target_loop_run_id: nullableString, target_job_run_id: nullableString,
  orchestration_request_id: nullableString,
  repair_request_id: nullableString, orchestration_frame_id: nullableString, created_at: z.string()
}).strict();

export const loopScheduleStateRowSchema = z.object({
  loop_id: z.string(), job_node_id: z.string(), definition_hash: z.string(), next_run_at: nullableString,
  last_scheduled_at: nullableString, last_status: z.enum(["started", "skipped", "missed"]).nullable(),
  last_loop_run_id: nullableString, last_error: nullableString, updated_at: z.string()
}).strict();

export type LoopRunRow = z.infer<typeof loopRunRowSchema>;
export type JobRunRow = z.infer<typeof jobRunRowSchema>;
export type NodeRunRow = z.infer<typeof nodeRunRowSchema>;
export type StateRevisionRow = z.infer<typeof stateRevisionRowSchema>;
export type RepairRequestRow = z.infer<typeof repairRequestRowSchema>;
export type OrchestrationRequestRow = z.infer<typeof orchestrationRequestRowSchema>;
export type OrchestrationFrameRow = z.infer<typeof orchestrationFrameRowSchema>;
export type OrchestratorRouteRow = z.infer<typeof orchestratorRouteRowSchema>;
export type RepairResultRow = z.infer<typeof repairResultRowSchema>;
export type ControlFlowEventRow = z.infer<typeof controlFlowEventRowSchema>;
export type LoopScheduleStateRow = z.infer<typeof loopScheduleStateRowSchema>;

export const now = (): string => new Date().toISOString();
