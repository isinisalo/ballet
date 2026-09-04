export type WorkspaceView =
  | "goals"
  | "adrs"
  | "constraints"
  | "use-cases"
  | "environment"
  | "state"
  | "action"
  | "instructions"
  | "skills"
  | "agents"
  | "runtimes"
  | "run-list"
  | "run-detail"
  | "run-state"
  | "run-action"
  | "feedback-list"
  | "feedback-detail"
  | "critic-reviews"
  | "critic-proposal"
  | "refinement-reviews"
  | "refinement-proposal"
  | "invalid";

export interface RouteState {
  view: "orchestration";
  workspaceView: WorkspaceView;
  entityId?: string;
  stateId?: string;
  actionId?: string;
  createMode?: "state" | "action";
  agentRole?: "validation" | "work" | "invalid";
}
