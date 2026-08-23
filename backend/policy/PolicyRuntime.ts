import type {
  AdmissibleActionSetV2,
  DecisionProjectionContextV2,
  DecisionStateV2,
  PolicyDecisionStatus,
  ProjectSspDecisionStrategyV2,
  SspPolicySolutionV2
} from "../../shared/domain/decisionModel.js";
import { resolveAdmissibleActions, resolveAllAdmissibleActions } from "./AdmissibleActionResolver.js";
import { DecisionStateProjectionError, projectDecisionState } from "./DecisionStateProjector.js";
import { solvePolicy } from "./SspPolicySolver.js";

export interface PolicyRuntimeEvaluation {
  state?: DecisionStateV2;
  admissible: AdmissibleActionSetV2;
  status: PolicyDecisionStatus;
  terminal?: "success" | "failure" | "blocked";
  solution?: SspPolicySolutionV2;
  message?: string;
}

export const evaluatePolicyDecision = (input: {
  strategy: ProjectSspDecisionStrategyV2;
  context: DecisionProjectionContextV2;
  snapshotGraphNodeIds: readonly string[];
  modelSha256: string;
}): PolicyRuntimeEvaluation => {
  let state: DecisionStateV2;
  try {
    state = projectDecisionState(input.strategy.model, input.context);
  } catch (error) {
    if (!(error instanceof DecisionStateProjectionError)) throw error;
    return {
      admissible: { actionIds: [], excludedActions: [] },
      status: "decision_state_invalid",
      message: error.message
    };
  }
  const definition = input.strategy.model.states.find(({ id }) => id === state.stateId)!;
  const admissible = resolveAdmissibleActions(input.strategy, state.stateId, input.snapshotGraphNodeIds);
  if (definition.terminal) return { state, admissible, status: "terminal", terminal: definition.terminal };
  const solution = solvePolicy({
    model: input.strategy.model,
    currentStateId: state.stateId,
    admissibleActionsByState: resolveAllAdmissibleActions(input.strategy, input.snapshotGraphNodeIds),
    modelSha256: input.modelSha256
  });
  return { state, admissible, status: solution.status, solution, message: solution.message };
};
