import type { JsonValue } from "./automation.js";
import type { CanonicalNodeOutcome } from "./runtime.js";

export type RepairRequestStatus = "pending" | "routed" | "repaired" | "failed" | "cancelled";

export interface RepairRequest {
  repairRequestId: string;
  rootRunId: string;
  requesterLoopRunId: string;
  requesterJobRunId: string;
  requesterValidationNodeRunId: string;
  attempt: number;
  validationSummary: string;
  requestedCapability?: string;
  requestedOutcome?: JsonValue;
  reason: string;
  evidence?: JsonValue;
  stateRevisionAtRequest: number;
  orchestratorNodeRunId?: string;
  routedLoopEdgeId?: string;
  routedTargetLoopId?: string;
  status: RepairRequestStatus;
  returnLoopId: string;
  returnJobNodeId: string;
  returnValidationNodeDefinitionId: string;
  nestingDepth: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export type OrchestrationRequestKind = "repair";
export type OrchestrationRequestStatus =
  | "pending" | "waiting_for_input" | "routed" | "dispatched" | "failed" | "cancelled";

export interface OrchestrationRequest {
  orchestrationRequestId: string;
  rootRunId: string;
  kind: OrchestrationRequestKind;
  sourceLoopRunId: string;
  sourceLoopId: string;
  sourceNodeRunId: string;
  stateRevisionAtRequest: number;
  completionSummary: string;
  completionEvidence: JsonValue;
  requestedCapability?: string;
  expectedOutcome?: JsonValue;
  repairRequestId?: string;
  orchestratorNodeRunId?: string;
  routedLoopEdgeId?: string;
  routedTargetLoopId?: string;
  targetLoopRunId?: string;
  status: OrchestrationRequestStatus;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface OrchestratorRoute {
  routeId: string;
  rootRunId: string;
  orchestrationRequestId: string;
  kind: OrchestrationRequestKind;
  repairRequestId?: string;
  orchestratorNodeRunId: string;
  loopEdgeId: string;
  sourceLoopId: string;
  targetLoopId: string;
  evidence?: JsonValue;
  createdAt: string;
}

export type OrchestrationFrameStatus = "open" | "returned" | "failed" | "cancelled";

export interface OrchestrationFrame {
  frameId: string;
  rootRunId: string;
  repairRequestId: string;
  routeId: string;
  callerLoopRunId: string;
  calleeLoopRunId: string;
  parentFrameId?: string;
  returnLoopId: string;
  returnJobNodeId: string;
  returnValidationNodeDefinitionId: string;
  stateRevisionAtCall: number;
  nestingDepth: number;
  status: OrchestrationFrameStatus;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export type RepairResultStatus = "repaired" | "blocked" | "failed" | "cancelled";

export interface RepairResult {
  repairResultId: string;
  rootRunId: string;
  repairRequestId: string;
  orchestrationFrameId: string;
  targetLoopRunId: string;
  targetLoopId: string;
  status: RepairResultStatus;
  stateRevision: number;
  outcome?: CanonicalNodeOutcome;
  summary: string;
  createdAt: string;
}

export type ControlFlowEventKind =
  | "job_completed" | "job_needs_input" | "job_terminal"
  | "validation_pass" | "validation_fail_retry" | "validation_fail_escalated" | "validation_terminal"
  | "repair_call" | "repair_return" | "repair_terminal" | "graph_transition"
  | "orchestrator_terminal" | "root_cancelled" | "root_terminal" | "execution_interrupted";

export interface ControlFlowEvent {
  id: number;
  rootRunId: string;
  sequence: number;
  kind: ControlFlowEventKind;
  stateRevision: number;
  sourceLoopRunId?: string;
  sourceJobRunId?: string;
  sourceNodeRunId?: string;
  targetLoopRunId?: string;
  targetJobRunId?: string;
  orchestrationRequestId?: string;
  repairRequestId?: string;
  orchestrationFrameId?: string;
  createdAt: string;
}
