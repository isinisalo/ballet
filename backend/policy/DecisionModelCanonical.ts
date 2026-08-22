import type { JsonValue } from "../../shared/domain/automation.js";
import type {
  ProjectCapabilityGraphV1,
  ProjectSspDecisionModelV1
} from "../../shared/domain/decisionModel.js";
import { jsonSha256 } from "../runtime/state/CanonicalJson.js";

const compareId = <T extends { id: string }>(left: T, right: T) => left.id.localeCompare(right.id);

export const canonicalDecisionModel = (model: ProjectSspDecisionModelV1): ProjectSspDecisionModelV1 => ({
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
    successors: [...row.successors].sort((left, right) => left.nextStateId.localeCompare(right.nextStateId))
  })).sort((left, right) => left.stateId.localeCompare(right.stateId)
    || left.graphNodeId.localeCompare(right.graphNodeId)),
  solver: { ...model.solver },
  projection: { ...model.projection }
});

export const canonicalCapabilityGraph = (graph: ProjectCapabilityGraphV1): ProjectCapabilityGraphV1 => ({
  version: 1,
  actions: graph.actions.map((action) => ({
    graphNodeId: action.graphNodeId,
    guards: action.guards.map((guard) => ({
      featureId: guard.featureId,
      allowedValues: [...guard.allowedValues].sort()
    })).sort((left, right) => left.featureId.localeCompare(right.featureId))
  })).sort((left, right) => left.graphNodeId.localeCompare(right.graphNodeId))
});

export const decisionModelSha256 = (model: ProjectSspDecisionModelV1): string =>
  jsonSha256(canonicalDecisionModel(model) as unknown as JsonValue);

export const capabilityGraphSha256 = (graph: ProjectCapabilityGraphV1): string =>
  jsonSha256(canonicalCapabilityGraph(graph) as unknown as JsonValue);
