import type { JsonValue } from "../../shared/domain/automation.js";
import type { ProjectScopedRewardDecisionModelV4 } from "../../shared/domain/decisionModel.js";
import { jsonSha256 } from "../runtime/state/CanonicalJson.js";

export const canonicalDecisionModel = (
  model: ProjectScopedRewardDecisionModelV4
): ProjectScopedRewardDecisionModelV4 => ({
  ...structuredClone(model),
  reward: {
    ...model.reward,
    outcomePenaltyMicros: { ...model.reward.outcomePenaltyMicros }
  },
  stateActions: model.stateActions.map((row) => ({
    ...structuredClone(row),
    guards: [...row.guards].map((guard) => ({
      ...structuredClone(guard),
      allowedValues: [...guard.allowedValues].sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))
    })).sort((left, right) => JSON.stringify(left.source).localeCompare(JSON.stringify(right.source))),
    successors: [...row.successors].sort((left, right) => left.outcomeId.localeCompare(right.outcomeId)
      || JSON.stringify(left.target).localeCompare(JSON.stringify(right.target)))
  })).sort((left, right) => left.stateId.localeCompare(right.stateId)
    || left.actionId.localeCompare(right.actionId)),
  solver: { ...model.solver }
});

export const decisionModelSha256 = (model: ProjectScopedRewardDecisionModelV4): string =>
  jsonSha256(canonicalDecisionModel(model) as unknown as JsonValue);
