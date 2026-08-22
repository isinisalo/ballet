import type {
  AdmissibleActionSetV1,
  DecisionProjectionContextV1,
  DecisionStateV1,
  PolicyDecisionStatus,
  ProjectSspGraphStrategyV1,
  SspPolicySolutionV1
} from "../../shared/domain/decisionModel.js";
import { resolveAdmissibleActions, resolveAllAdmissibleActions } from "./AdmissibleActionResolver.js";
import { DecisionStateProjectionError, projectDecisionState } from "./DecisionStateProjector.js";
import { solvePolicy } from "./SspPolicySolver.js";

export interface PolicyRuntimeEvaluation {
  state?: DecisionStateV1;
  admissible: AdmissibleActionSetV1;
  status: PolicyDecisionStatus;
  terminal?: "success" | "failure" | "blocked";
  solution?: SspPolicySolutionV1;
  message?: string;
}

export const evaluatePolicyDecision = (input: {
  strategy: ProjectSspGraphStrategyV1;
  context: DecisionProjectionContextV1;
  snapshotGraphNodeIds: readonly string[];
  modelSha256: string;
}): PolicyRuntimeEvaluation => {
  let state: DecisionStateV1;
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
