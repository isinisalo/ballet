import type { GraphNodeInvocationDetails } from "../../shared/domain/runtime.js";
import type {
  ExecutionGraphOccurrenceV3,
  PolicyDecisionRecordV2,
  PolicyOptionObservationV3,
  PolicyTelemetryV3,
  ProjectSspDecisionStrategyV2
} from "../../shared/domain/decisionModel.js";

export const reconstructExecutionGraph = (input: {
  strategies: Readonly<Record<string, ProjectSspDecisionStrategyV2>>;
  decisions: PolicyDecisionRecordV2[];
  observations: PolicyOptionObservationV3[];
  invocations: GraphNodeInvocationDetails[];
}): ExecutionGraphOccurrenceV3[] => {
  const observations = new Map(input.observations.map((observation) => [observation.policyDecisionId, observation]));
  const graphInvocations = new Map(input.invocations.flatMap((invocation) =>
    invocation.policyDecisionId ? [[invocation.policyDecisionId, invocation] as const] : []));
  const jobInvocations = new Map(input.invocations.flatMap(({ jobNodeInvocations }) =>
    jobNodeInvocations.flatMap((invocation) =>
      invocation.policyDecisionId ? [[invocation.policyDecisionId, invocation] as const] : [])));
  return [...input.decisions].sort((left, right) => left.createdAt.localeCompare(right.createdAt)
    || left.epoch - right.epoch).flatMap((decision) => {
    if (!decision.selectedActionId) return [];
    const observation = observations.get(decision.policyDecisionId);
    if (!observation) return [];
    const graphInvocation = graphInvocations.get(decision.policyDecisionId);
    const jobInvocation = jobInvocations.get(decision.policyDecisionId);
    const strategy = input.strategies[decision.scopeKey];
    const row = strategy && decision.state ? strategy.model.stateActions.find((candidate) =>
      candidate.stateId === decision.state!.stateId && candidate.actionId === decision.selectedActionId) : undefined;
    return [{
      occurrenceId: observation?.actionInvocationId
        ?? graphInvocation?.graphNodeInvocationId ?? jobInvocation?.jobNodeInvocationId ?? decision.policyDecisionId,
      scope: decision.scope,
      scopeKey: decision.scopeKey,
      epoch: decision.epoch,
      policyDecisionId: decision.policyDecisionId,
      actionInvocationId: observation?.actionInvocationId
        ?? graphInvocation?.graphNodeInvocationId ?? jobInvocation?.jobNodeInvocationId,
      graphNodeInvocationId: observation?.graphNodeInvocationId ?? graphInvocation?.graphNodeInvocationId
        ?? jobInvocation?.graphNodeInvocationId,
      jobNodeInvocationId: observation?.jobNodeInvocationId ?? jobInvocation?.jobNodeInvocationId,
      actionId: decision.selectedActionId,
      status: "observed" as const,
      decisionStateBefore: decision.state,
      expectedRemainingCostMicros: decision.stateValueMicros,
      selectedActionValueMicros: decision.actionValues.find(({ actionId }) =>
        actionId === decision.selectedActionId)?.qMicros,
      configuredExpectedCostMicros: observation?.configuredExpectedCostMicros ?? row?.expectedCostMicros,
      expectedOutcomeDistribution: observation?.expectedOutcomeDistribution ?? row?.successors ?? [],
      observedCost: observation?.observedCost,
      observedOutcomeId: observation?.observedOutcomeId,
      verifiedResult: observation?.verifiedResult,
      actualState: observation?.actualState,
      modelMatch: observation?.modelMatch,
      modelSha256: decision.modelSha256,
      snapshotSha256: decision.snapshotSha256,
      createdAt: decision.createdAt
    }];
  });
};

export const summarizePolicyTelemetry = (observations: PolicyOptionObservationV3[]): PolicyTelemetryV3[] => {
  const groups = new Map<string, PolicyOptionObservationV3[]>();
  for (const observation of observations) {
    const key = `${observation.scopeKey}\u0000${observation.actionId}\u0000${observation.stateBefore.stateId}`;
    groups.set(key, [...(groups.get(key) ?? []), observation]);
  }
  return [...groups.values()].map((entries) => {
    return {
      scope: entries[0]!.scope,
      scopeKey: entries[0]!.scopeKey,
      actionId: entries[0]!.actionId,
      stateId: entries[0]!.stateBefore.stateId,
      observationCount: entries.length,
      resultCounts: counts(entries.map(({ verifiedResult }) => verifiedResult)),
      outcomeCounts: counts(entries.map(({ observedOutcomeId }) => observedOutcomeId)),
      observedNextStateCounts: counts(entries.flatMap(({ actualState }) => actualState ? [actualState.stateId] : [])),
      modelMissCount: entries.filter(({ modelMatch }) => modelMatch !== "match").length,
      meanKnownDurationMillis: entries.reduce((sum, { observedCost }) => {
        const duration = observedCost.dimensions.durationMillis;
        if (duration.status !== "known") throw new Error("Option duration must always be measured.");
        return sum + duration.value;
      }, 0) / entries.length
    };
  }).sort((left, right) => left.scopeKey.localeCompare(right.scopeKey)
    || left.actionId.localeCompare(right.actionId) || left.stateId.localeCompare(right.stateId));
};

const counts = <T extends string>(values: T[]): Record<T, number> => Object.fromEntries(
  [...new Set(values)].sort().map((value) => [value, values.filter((candidate) => candidate === value).length])
) as Record<T, number>;
