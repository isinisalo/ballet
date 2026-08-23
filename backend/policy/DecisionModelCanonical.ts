import type { JsonValue } from "../../shared/domain/automation.js";
import type {
  ProjectCapabilityModelV3,
  ProjectRewardDecisionModelV3
} from "../../shared/domain/decisionModel.js";
import { jsonSha256 } from "../runtime/state/CanonicalJson.js";

const byId = <T extends { id: string }>(left: T, right: T) => left.id.localeCompare(right.id);

export const canonicalDecisionModel = (model: ProjectRewardDecisionModelV3): ProjectRewardDecisionModelV3 => ({
  ...structuredClone(model),
  acceptance: {
    version: 1,
    obligations: model.acceptance.obligations.map((obligation) => ({ ...obligation }))
      .sort((left, right) => left.obligationId.localeCompare(right.obligationId))
  },
  reward: {
    ...model.reward,
    outcomePenaltyMicros: { ...model.reward.outcomePenaltyMicros }
  },
  features: model.features.map((feature) => ({
    ...structuredClone(feature), domain: [...feature.domain].sort()
  })).sort(byId),
  states: model.states.map((state) => ({
    ...structuredClone(state),
    values: Object.fromEntries(Object.entries(state.values).sort(([left], [right]) => left.localeCompare(right))),
    verifiedObligationIds: [...state.verifiedObligationIds].sort(),
    invalidatedObligationIds: [...state.invalidatedObligationIds].sort()
  })).sort(byId),
  stateActions: model.stateActions.map((row) => ({
    ...structuredClone(row),
    successors: [...row.successors].sort((left, right) => left.outcomeId.localeCompare(right.outcomeId)
      || left.nextStateId.localeCompare(right.nextStateId))
  })).sort((left, right) => left.stateId.localeCompare(right.stateId)
    || left.actionId.localeCompare(right.actionId)),
  solver: { ...model.solver }
});

export const canonicalCapabilityModel = (model: ProjectCapabilityModelV3): ProjectCapabilityModelV3 => ({
  version: 3,
  outcomes: model.outcomes.map((outcome) => ({ ...outcome })).sort(byId),
  actions: model.actions.map((action) => ({
    actionId: action.actionId,
    guards: action.guards.map((guard) => ({
      featureId: guard.featureId,
      allowedValues: [...guard.allowedValues].sort()
    })).sort((left, right) => left.featureId.localeCompare(right.featureId))
  })).sort((left, right) => left.actionId.localeCompare(right.actionId))
});

export const decisionModelSha256 = (model: ProjectRewardDecisionModelV3): string =>
  jsonSha256(canonicalDecisionModel(model) as unknown as JsonValue);

export const capabilityModelSha256 = (model: ProjectCapabilityModelV3): string =>
  jsonSha256(canonicalCapabilityModel(model) as unknown as JsonValue);
