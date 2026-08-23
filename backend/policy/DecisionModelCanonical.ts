import type { JsonValue } from "../../shared/domain/automation.js";
import type {
  ProjectCapabilityModelV2,
  ProjectSspDecisionModelV2
} from "../../shared/domain/decisionModel.js";
import { jsonSha256 } from "../runtime/state/CanonicalJson.js";

const compareId = <T extends { id: string }>(left: T, right: T) => left.id.localeCompare(right.id);

export const canonicalDecisionModel = (model: ProjectSspDecisionModelV2): ProjectSspDecisionModelV2 => ({
  ...structuredClone(model),
  features: model.features.map((feature) => ({
    ...structuredClone(feature), domain: [...feature.domain].sort()
  })).sort(compareId),
  states: model.states.map((state) => ({
    ...structuredClone(state),
    values: Object.fromEntries(Object.entries(state.values).sort(([left], [right]) => left.localeCompare(right)))
  })).sort(compareId),
  stateActions: model.stateActions.map((row) => ({
    ...structuredClone(row),
    successors: [...row.successors].sort((left, right) =>
      left.outcomeId.localeCompare(right.outcomeId) || left.expectedNextStateId.localeCompare(right.expectedNextStateId))
  })).sort((left, right) => left.stateId.localeCompare(right.stateId)
    || left.actionId.localeCompare(right.actionId)),
  solver: { ...model.solver },
  projection: { ...model.projection }
});

export const canonicalCapabilityModel = (model: ProjectCapabilityModelV2): ProjectCapabilityModelV2 => ({
  version: 2,
  outcomes: model.outcomes.map((outcome) => ({ ...outcome })).sort(compareId),
  actions: model.actions.map((action) => ({
    actionId: action.actionId,
    guards: action.guards.map((guard) => ({
      featureId: guard.featureId,
      allowedValues: [...guard.allowedValues].sort()
    })).sort((left, right) => left.featureId.localeCompare(right.featureId))
  })).sort((left, right) => left.actionId.localeCompare(right.actionId))
});

export const decisionModelSha256 = (model: ProjectSspDecisionModelV2): string =>
  jsonSha256(canonicalDecisionModel(model) as unknown as JsonValue);

export const capabilityModelSha256 = (model: ProjectCapabilityModelV2): string =>
  jsonSha256(canonicalCapabilityModel(model) as unknown as JsonValue);
