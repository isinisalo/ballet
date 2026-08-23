import type { PolicyPreviewV2, ProjectSspDecisionStrategyV2 } from "@shared/api/workspace-contracts";
import { isProbabilityTotalValid, type DecisionActionView } from "./decisionModelView";

export interface DecisionModelHealthView {
  ready: boolean;
  facts: Array<{ label: string; status: "healthy" | "attention" | "danger" }>;
}

export function projectDecisionModelHealth(input: {
  strategy: ProjectSspDecisionStrategyV2;
  actions: DecisionActionView[];
  issues: Array<{ path: string; message: string }>;
  preview?: PolicyPreviewV2;
}): DecisionModelHealthView {
  const { strategy, actions, issues, preview } = input;
  const validDistributions = strategy.model.stateActions.filter(isProbabilityTotalValid).length;
  const represented = actions.filter((action) => strategy.capabilityModel.actions.some(({ actionId }) => actionId === action.id)).length;
  const ready = issues.length === 0 && preview?.solverStatus === "converged";
  const facts = baseHealthFacts(strategy, actions, represented, validDistributions);
  if (preview) facts.push({ label: solverLabel(preview.solverStatus), status: preview.solverStatus === "converged" || preview.solverStatus === "terminal" ? "healthy" : "danger" });
  facts.push({ label: issues.length ? `${issues.length} readiness issue${issues.length === 1 ? "" : "s"}` : "No readiness issues", status: issues.length ? "danger" : "healthy" });
  return { ready, facts };
}

function baseHealthFacts(strategy: ProjectSspDecisionStrategyV2, actions: DecisionActionView[], represented: number, validDistributions: number): DecisionModelHealthView["facts"] {
  const ruleCount = strategy.model.stateActions.length;
  const successCount = strategy.model.states.filter(({ terminal }) => terminal === "success").length;
  return [
    { label: `${strategy.model.states.length} state${strategy.model.states.length === 1 ? "" : "s"} defined`, status: strategy.model.states.length ? "healthy" : "danger" },
    { label: `${actions.length} configured action${actions.length === 1 ? "" : "s"}; ${represented} represented in the capability model`, status: represented === actions.length ? "healthy" : "danger" },
    { label: `${ruleCount} state/action rule${ruleCount === 1 ? "" : "s"}`, status: ruleCount ? "healthy" : "attention" },
    ruleCount === 0
      ? { label: "No transition distributions defined", status: "attention" }
      : { label: validDistributions === ruleCount ? "All transition distributions total 100%" : `${ruleCount - validDistributions} transition distribution${ruleCount - validDistributions === 1 ? "" : "s"} invalid`, status: validDistributions === ruleCount ? "healthy" : "danger" },
    { label: `${successCount} success goal state${successCount === 1 ? "" : "s"} defined`, status: successCount ? "healthy" : "danger" }
  ];
}

const solverLabel = (status: string) => ({
  converged: "Solver converged; success goal is reachable from modeled nonterminal states",
  terminal: "Preview is already in a terminal state",
  policy_goal_unreachable: "Success goal is unreachable",
  policy_no_proper_policy: "No proper policy exists",
  policy_not_converged: "Solver did not converge",
  policy_model_invalid: "Policy model is invalid",
  decision_state_invalid: "Projected decision state is invalid"
}[status] ?? status.replaceAll("_", " "));
