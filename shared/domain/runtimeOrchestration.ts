import type { JsonValue, NodeResult } from "./automation.js";
import type { CanonicalNodeOutcome, OrchestrationScope } from "./runtime.js";

export type RoutingRequestKind = "start" | "continuation" | "repair";
export type RoutingRequestStatus = "pending" | "waiting_for_input" | "decided" | "dispatched" | "failed" | "cancelled";
export interface RoutingRequest {
  routingRequestId: string;
  rootRunId: string;
  scope: OrchestrationScope;
  kind: RoutingRequestKind;
  graphNodeId?: string;
  sourceChildId?: string;
  sourceNodeRunId?: string;
  result?: NodeResult;
  requestedCapability?: string;
  stateRevision: number;
  evidence: JsonValue;
  candidateKeys: string[];
  attempt: number;
  status: RoutingRequestStatus;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface RoutingDecision {
  routingDecisionId: string;
  routingRequestId: string;
  rootRunId: string;
  orchestratorNodeRunId: string;
  action: "dispatch" | "complete" | "delegate_repair" | "needs_input";
  selectedTarget?: string;
  result?: NodeResult;
  reason: string;
  valid: boolean;
  createdAt: string;
}

export interface RepairRequest {
  repairRequestId: string;
  rootRunId: string;
  scope: OrchestrationScope;
  graphNodeId?: string;
  requesterNodeRunId: string;
  requesterJobNodeInvocationId?: string;
  returnValidationNodeId: string;
  attempt: number;
  depth: number;
  reason: string;
  requestedCapability?: string;
  evidence: JsonValue;
  stateRevision: number;
  candidateKeys: string[];
  status: "pending" | "running" | "repaired" | "escalated" | "needs_input" | "failed" | "cancelled";
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface RepairFrame {
  repairFrameId: string;
  rootRunId: string;
  repairRequestId: string;
  parentFrameId?: string;
  returnGraphNodeInvocationId: string;
  returnJobNodeInvocationId: string;
  returnValidationNodeId: string;
  stateRevisionAtCall: number;
  depth: number;
  status: "open" | "returned" | "escalated" | "failed" | "cancelled";
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface RepairResult {
  repairResultId: string;
  rootRunId: string;
  repairRequestId: string;
  repairFrameId: string;
  stateRevision: number;
  outcome: CanonicalNodeOutcome;
  summary: string;
  createdAt: string;
}

export type ControlFlowEventKind =
  | "orchestrator_requested" | "orchestrator_decided" | "orchestrator_invalid"
  | "graph_node_dispatched" | "job_node_dispatched" | "work_completed"
  | "validation_pass" | "validation_fail_retry" | "validation_fail_repair"
  | "repair_dispatched" | "repair_return" | "repair_escalated"
  | "root_needs_input" | "root_cancelled" | "root_terminal" | "execution_interrupted";
export interface ControlFlowEvent {
  id: number;
  rootRunId: string;
  sequence: number;
  kind: ControlFlowEventKind;
  stateRevision: number;
  graphNodeInvocationId?: string;
  jobNodeInvocationId?: string;
  sourceNodeRunId?: string;
  targetNodeRunId?: string;
  routingRequestId?: string;
  repairRequestId?: string;
  repairFrameId?: string;
  createdAt: string;
}
