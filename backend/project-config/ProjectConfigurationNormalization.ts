import type { ProjectScopedRewardDecisionStrategyV4 } from "../../shared/domain/decisionModel.js";
import { canonicalDecisionModel } from "../policy/DecisionModelCanonical.js";

export function normalizeGraphStrategy(
  strategy: ProjectScopedRewardDecisionStrategyV4
): ProjectScopedRewardDecisionStrategyV4 {
  return {
    kind: "reward_mdp_v4",
    id: strategy.id,
    description: strategy.description,
    model: canonicalDecisionModel(strategy.model)
  };
}
