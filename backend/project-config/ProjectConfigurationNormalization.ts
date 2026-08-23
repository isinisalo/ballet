import type { ProjectRewardDecisionStrategyV3 } from "../../shared/domain/decisionModel.js";

export function normalizeGraphStrategy(strategy: ProjectRewardDecisionStrategyV3): ProjectRewardDecisionStrategyV3 {
  return {
    ...structuredClone(strategy),
    capabilityModel: {
      version: 3,
      outcomes: [...strategy.capabilityModel.outcomes].sort((left, right) => compareIds(left.id, right.id)),
      actions: strategy.capabilityModel.actions.map((action) => ({
        actionId: action.actionId,
        guards: action.guards.map((guard) => ({
          featureId: guard.featureId,
          allowedValues: [...guard.allowedValues].sort(compareIds)
        })).sort((left, right) => compareIds(left.featureId, right.featureId))
      })).sort((left, right) => compareIds(left.actionId, right.actionId))
    },
    model: {
      ...structuredClone(strategy.model),
      acceptance: {
        version: 1,
        obligations: [...strategy.model.acceptance.obligations]
          .sort((left, right) => compareIds(left.obligationId, right.obligationId))
      },
      features: strategy.model.features.map((feature) => ({
        ...structuredClone(feature), domain: [...feature.domain].sort(compareIds)
      })).sort((left, right) => compareIds(left.id, right.id)),
      states: strategy.model.states.map((state) => ({
        ...structuredClone(state),
        values: Object.fromEntries(Object.entries(state.values).sort(([left], [right]) => compareIds(left, right))),
        verifiedObligationIds: [...state.verifiedObligationIds].sort(compareIds),
        invalidatedObligationIds: [...state.invalidatedObligationIds].sort(compareIds)
      })).sort((left, right) => compareIds(left.id, right.id)),
      stateActions: strategy.model.stateActions.map((row) => ({
        ...structuredClone(row),
        successors: [...row.successors].sort((left, right) => compareIds(left.outcomeId, right.outcomeId)
          || compareIds(left.nextStateId, right.nextStateId))
      })).sort((left, right) => compareIds(left.stateId, right.stateId) || compareIds(left.actionId, right.actionId))
    }
  };
}

const compareIds = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
