import {
  canonicalNodeOutcomeSchema, parseNodeOutcomeForRole
} from "../../shared/api/runtime-schemas.js";
import type { ProjectLoop } from "../../shared/domain/automation.js";
import type { LoopTheme } from "../../shared/domain/loopThemes.js";
import type {
  CanonicalNodeOutcome, ControlFlowEvent, LoopRun, LoopStateRevision, NodeRun,
  OrchestrationFrame, OrchestrationRequest, OrchestratorRoute, RepairRequest, RepairResult, StatePatch, JobRun
} from "../../shared/domain/runtime.js";
import type {
  ControlFlowEventRow, LoopRunRow, NodeRunRow, OrchestrationFrameRow, OrchestrationRequestRow,
  OrchestratorRouteRow, RepairRequestRow, RepairResultRow, StateRevisionRow, JobRunRow
} from "./RuntimeDbTypes.js";
import { parseJsonValue } from "./state/CanonicalJson.js";
import { statePatchSha256, validateStatePatch } from "./state/StatePatch.js";

export const toLoopRun = (row: LoopRunRow, loop: ProjectLoop, theme: LoopTheme): LoopRun => ({
  loopRunId: row.loop_run_id,
  loopId: row.loop_id,
  rootRunId: row.root_run_id,
  parentLoopRunId: row.parent_loop_run_id ?? undefined,
  source: row.source,
  status: row.status,
  input: row.input_json ? parseJsonValue(row.input_json, `Loop Run ${row.loop_run_id} input`) : undefined,
  orchestrationRequestId: row.orchestration_request_id ?? undefined,
  repairRequestId: row.repair_request_id ?? undefined,
  orchestrationFrameId: row.orchestration_frame_id ?? undefined,
  snapshot: loop,
  themeSnapshot: theme,
  schedule: row.schedule_job_node_id && row.scheduled_for
    ? { jobNodeId: row.schedule_job_node_id, scheduledFor: row.scheduled_for }
    : undefined,
  entryStateRevision: row.entry_state_revision,
  completionStateRevision: row.completion_state_revision ?? undefined,
  nestingDepth: row.nesting_depth,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  completedAt: row.completed_at ?? undefined
});

export const toJobRun = (row: JobRunRow): JobRun => ({
  jobRunId: row.job_run_id,
  rootRunId: row.root_run_id,
  loopRunId: row.loop_run_id,
  loopId: row.loop_id,
  jobNodeId: row.job_node_id,
  jobAttempt: row.job_attempt,
  status: row.status,
  stateRevisionBefore: row.state_revision_before,
  stateRevisionAfter: row.state_revision_after ?? undefined,
  activeNodeRunId: row.active_node_run_id ?? undefined,
  terminal: row.terminal ?? undefined,
  errorCode: row.error_code ?? undefined,
  errorMessage: row.error_message ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  completedAt: row.completed_at ?? undefined
});

export const toNodeRun = (row: NodeRunRow): NodeRun => ({
  nodeRunId: row.node_run_id,
  rootRunId: row.root_run_id,
  loopRunId: row.loop_run_id,
  jobRunId: row.job_run_id ?? undefined,
  role: row.role,
  loopId: row.loop_id,
  jobNodeId: row.job_node_id ?? undefined,
  workflowNodeId: row.workflow_node_id ?? undefined,
  nodeDefinitionId: row.node_definition_id,
  executionTaskId: row.execution_task_id ?? undefined,
  input: row.input_json ? parseJsonValue(row.input_json, `Node Run ${row.node_run_id} input`) : undefined,
  context: row.context_json ? parseJsonValue(row.context_json, `Node Run ${row.node_run_id} context`) : undefined,
  outcome: row.outcome_json ? parseRoleOutcome(row.outcome_json, row.node_run_id, row.role) : undefined,
  status: row.status,
  attempt: row.attempt,
  stateRevisionBefore: row.state_revision_before,
  stateRevisionAfter: row.state_revision_after ?? undefined,
  patch: row.patch_json && row.patch_hash
    ? parsePatchEvidence(row.patch_json, row.patch_hash, row.node_run_id)
    : undefined,
  errorCode: row.error_code ?? undefined,
  errorMessage: row.error_message ?? undefined,
  createdAt: row.created_at,
  startedAt: row.started_at ?? undefined,
  updatedAt: row.updated_at,
  completedAt: row.completed_at ?? undefined
});

export const toStateRevision = (row: StateRevisionRow): LoopStateRevision => ({
  rootRunId: row.root_run_id,
  revision: row.revision,
  parentRevision: row.parent_revision ?? undefined,
  state: parseJsonValue(row.state_json, `Root Run ${row.root_run_id} state revision ${row.revision}`),
  stateSha256: row.state_hash,
  patch: row.patch_json && row.patch_hash
    ? { patch: parsePatch(row.patch_json, `${row.root_run_id}:${row.revision}`), patchSha256: row.patch_hash }
    : undefined,
  sourceNodeRunId: row.source_node_run_id ?? undefined,
  outcome: row.outcome_json ? parseOutcome(row.outcome_json, `${row.root_run_id}:${row.revision}`) : undefined,
  createdAt: row.created_at
});

export const toRepairRequest = (row: RepairRequestRow): RepairRequest => ({
  repairRequestId: row.repair_request_id, rootRunId: row.root_run_id,
  requesterLoopRunId: row.requester_loop_run_id,
  requesterJobRunId: row.requester_job_run_id,
  requesterValidationNodeRunId: row.requester_validation_node_run_id,
  attempt: row.attempt,
  validationSummary: row.validation_summary,
  requestedCapability: row.requested_capability ?? undefined,
  requestedOutcome: row.requested_outcome_json
    ? parseJsonValue(row.requested_outcome_json, `Repair Request ${row.repair_request_id} outcome`) : undefined,
  reason: row.reason,
  evidence: row.evidence_json ? parseJsonValue(row.evidence_json, `Repair Request ${row.repair_request_id} evidence`) : undefined,
  stateRevisionAtRequest: row.state_revision_at_request,
  orchestratorNodeRunId: row.orchestrator_node_run_id ?? undefined,
  routedLoopEdgeId: row.routed_loop_edge_id ?? undefined,
  routedTargetLoopId: row.routed_target_loop_id ?? undefined,
  status: row.status,
  returnLoopId: row.return_loop_id,
  returnJobNodeId: row.return_job_node_id,
  returnValidationNodeDefinitionId: row.return_validation_node_definition_id,
  nestingDepth: row.nesting_depth,
  createdAt: row.created_at, updatedAt: row.updated_at, completedAt: row.completed_at ?? undefined
});

export const toOrchestrationRequest = (row: OrchestrationRequestRow): OrchestrationRequest => ({
  orchestrationRequestId: row.orchestration_request_id,
  rootRunId: row.root_run_id,
  kind: row.kind,
  sourceLoopRunId: row.source_loop_run_id,
  sourceLoopId: row.source_loop_id,
  sourceNodeRunId: row.source_node_run_id,
  stateRevisionAtRequest: row.state_revision_at_request,
  completionSummary: row.completion_summary,
  completionEvidence: parseJsonValue(
    row.completion_evidence_json,
    `Orchestration Request ${row.orchestration_request_id} completion evidence`
  ),
  requestedCapability: row.requested_capability ?? undefined,
  expectedOutcome: row.expected_outcome_json
    ? parseJsonValue(row.expected_outcome_json, `Orchestration Request ${row.orchestration_request_id} expected outcome`)
    : undefined,
  repairRequestId: row.repair_request_id ?? undefined,
  orchestratorNodeRunId: row.orchestrator_node_run_id ?? undefined,
  routedLoopEdgeId: row.routed_loop_edge_id ?? undefined,
  routedTargetLoopId: row.routed_target_loop_id ?? undefined,
  targetLoopRunId: row.target_loop_run_id ?? undefined,
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  completedAt: row.completed_at ?? undefined
});

export const toOrchestrationFrame = (row: OrchestrationFrameRow): OrchestrationFrame => ({
  frameId: row.frame_id, rootRunId: row.root_run_id, repairRequestId: row.repair_request_id,
  routeId: row.route_id,
  callerLoopRunId: row.caller_loop_run_id, calleeLoopRunId: row.callee_loop_run_id,
  parentFrameId: row.parent_frame_id ?? undefined, returnLoopId: row.return_loop_id,
  returnJobNodeId: row.return_job_node_id,
  returnValidationNodeDefinitionId: row.return_validation_node_definition_id,
  stateRevisionAtCall: row.state_revision_at_call, nestingDepth: row.nesting_depth,
  status: row.status, createdAt: row.created_at, updatedAt: row.updated_at,
  completedAt: row.completed_at ?? undefined
});

export const toRepairResult = (row: RepairResultRow): RepairResult => ({
  repairResultId: row.repair_result_id, rootRunId: row.root_run_id,
  repairRequestId: row.repair_request_id, orchestrationFrameId: row.orchestration_frame_id,
  targetLoopRunId: row.target_loop_run_id, targetLoopId: row.target_loop_id,
  status: row.status, stateRevision: row.state_revision,
  outcome: row.outcome_json ? parseOutcome(row.outcome_json, `Repair Result ${row.repair_result_id}`) : undefined,
  summary: row.summary, createdAt: row.created_at
});

export const toOrchestratorRoute = (row: OrchestratorRouteRow): OrchestratorRoute => ({
  routeId: row.route_id, rootRunId: row.root_run_id,
  orchestrationRequestId: row.orchestration_request_id, kind: row.kind,
  repairRequestId: row.repair_request_id ?? undefined,
  orchestratorNodeRunId: row.orchestrator_node_run_id, loopEdgeId: row.loop_edge_id,
  sourceLoopId: row.source_loop_id, targetLoopId: row.target_loop_id,
  evidence: row.route_evidence_json
    ? parseJsonValue(row.route_evidence_json, `Orchestrator Route ${row.route_id} evidence`) : undefined,
  createdAt: row.created_at
});

export const toControlFlowEvent = (row: ControlFlowEventRow): ControlFlowEvent => ({
  id: row.id, rootRunId: row.root_run_id, sequence: row.sequence, kind: row.kind,
  stateRevision: row.state_revision, sourceLoopRunId: row.source_loop_run_id ?? undefined,
  sourceJobRunId: row.source_job_run_id ?? undefined,
  sourceNodeRunId: row.source_node_run_id ?? undefined,
  targetLoopRunId: row.target_loop_run_id ?? undefined,
  targetJobRunId: row.target_job_run_id ?? undefined,
  orchestrationRequestId: row.orchestration_request_id ?? undefined,
  repairRequestId: row.repair_request_id ?? undefined,
  orchestrationFrameId: row.orchestration_frame_id ?? undefined, createdAt: row.created_at
});

const parsePatch = (source: string, owner: string): StatePatch => {
  let value: unknown;
  try { value = JSON.parse(source); } catch { throw new Error(`Persisted state patch for ${owner} is invalid JSON.`); }
  return validateStatePatch(value);
};

const parsePatchEvidence = (source: string, hash: string, owner: string) => {
  const patch = parsePatch(source, owner);
  if (statePatchSha256(patch) !== hash) throw new Error(`Persisted state patch for ${owner} has invalid hash evidence.`);
  return { patch, patchSha256: hash };
};

const parseOutcome = (source: string, owner: string): CanonicalNodeOutcome => {
  let value: unknown;
  try { value = JSON.parse(source); } catch { throw new Error(`Persisted node outcome for ${owner} is invalid JSON.`); }
  const parsed = canonicalNodeOutcomeSchema.safeParse(value);
  if (!parsed.success) throw new Error(`Persisted node outcome for ${owner} is invalid.`);
  return parsed.data;
};

const parseRoleOutcome = (
  source: string,
  owner: string,
  role: NodeRun["role"]
): CanonicalNodeOutcome => {
  let value: unknown;
  try { value = JSON.parse(source); } catch { throw new Error(`Persisted node outcome for ${owner} is invalid JSON.`); }
  try { return parseNodeOutcomeForRole(role, value); }
  catch { throw new Error(`Persisted ${role} outcome for ${owner} is invalid.`); }
};
