export type {
  PolicyDecisionRecordV5,
  PolicyOptionObservationV5
} from "./decisionModel.js";

export type ControlFlowEventKind =
  | "policy_decided" | "policy_invalid" | "policy_observed"
  | "policy_terminal" | "acceptance_mismatch"
  | "graph_node_dispatched" | "action_node_dispatched" | "work_completed"
  | "validation_pass" | "validation_fail_retry" | "validation_fail_escalate"
  | "root_needs_input" | "root_cancelled" | "root_terminal" | "execution_interrupted";

export interface ControlFlowEvent {
  id: number;
  rootRunId: string;
  sequence: number;
  kind: ControlFlowEventKind;
  stateRevision: number;
  graphNodeInvocationId?: string;
  actionNodeInvocationId?: string;
  sourceNodeRunId?: string;
  targetNodeRunId?: string;
  policyDecisionId?: string;
  createdAt: string;
}
