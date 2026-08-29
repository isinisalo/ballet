export type WorkspaceView =
  | "direction"
  | "use-cases"
  | "environment"
  | "state"
  | "action"
  | "instructions"
  | "skills"
  | "execution-profiles"
  | "critic"
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
  | "products"
  | "product-detail"
  | "invalid";

export interface RouteState {
  view: "orchestration";
  workspaceView: WorkspaceView;
  entityId?: string;
  stateId?: string;
  actionId?: string;
}
