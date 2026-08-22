import type { GraphNodeInvocationDetails } from "../../shared/domain/runtime.js";
import type {
  ExecutionGraphOccurrenceV1,
  PolicyDecisionRecordV1,
  PolicyOptionObservationV1,
  PolicyTelemetryV1,
  ProjectSspGraphStrategyV1
} from "../../shared/domain/decisionModel.js";

export const reconstructExecutionGraph = (input: {
  strategy: ProjectSspGraphStrategyV1;
  decisions: PolicyDecisionRecordV1[];
  observations: PolicyOptionObservationV1[];
  invocations: GraphNodeInvocationDetails[];
}): ExecutionGraphOccurrenceV1[] => {
  const observations = new Map(input.observations.map((observation) => [observation.policyDecisionId, observation]));
  const invocations = new Map(input.invocations.flatMap((invocation) =>
    invocation.policyDecisionId ? [[invocation.policyDecisionId, invocation] as const] : []));
  return [...input.decisions].sort((left, right) => left.epoch - right.epoch).flatMap((decision) => {
    if (!decision.selectedGraphNodeId) return [];
    const observation = observations.get(decision.policyDecisionId);
    const invocation = invocations.get(decision.policyDecisionId);
    const row = decision.state ? input.strategy.model.stateActions.find((candidate) =>
      candidate.stateId === decision.state!.stateId && candidate.graphNodeId === decision.selectedGraphNodeId) : undefined;
    const active = invocation && ["queued", "running", "waiting_for_input"].includes(invocation.status);
    return [{
      occurrenceId: observation?.graphNodeInvocationId ?? invocation?.graphNodeInvocationId ?? decision.policyDecisionId,
      epoch: decision.epoch,
      policyDecisionId: decision.policyDecisionId,
      graphNodeInvocationId: observation?.graphNodeInvocationId ?? invocation?.graphNodeInvocationId,
      graphNodeId: decision.selectedGraphNodeId,
      status: observation ? "observed" as const : active ? "running" as const : "selected" as const,
      decisionStateBefore: decision.state,
      expectedRemainingCostMicros: decision.stateValueMicros,
      selectedActionValueMicros: decision.actionValues.find(({ graphNodeId }) => graphNodeId === decision.selectedGraphNodeId)?.qMicros,
      configuredExpectedCostMicros: observation?.configuredExpectedCostMicros ?? row?.expectedCostMicros,
      expectedOutcomeDistribution: row?.successors ?? [],
      actualCostMicros: observation?.actualCostMicros,
      actualOutcome: observation?.verifiedOutcome,
      decisionStateAfter: observation?.stateAfter,
      durationMillis: observation?.durationMillis,
      modelSha256: decision.modelSha256,
      snapshotSha256: decision.snapshotSha256,
      createdAt: decision.createdAt
    }];
  });
};

export const summarizePolicyTelemetry = (observations: PolicyOptionObservationV1[]): PolicyTelemetryV1[] => {
  const groups = new Map<string, PolicyOptionObservationV1[]>();
  for (const observation of observations) {
    const key = `${observation.action}\u0000${observation.stateBefore.stateId}`;
    groups.set(key, [...(groups.get(key) ?? []), observation]);
  }
  return [...groups.values()].map((entries) => {
    const actualCosts = entries.flatMap(({ actualCostMicros }) => actualCostMicros === undefined ? [] : [actualCostMicros]);
    return {
      graphNodeId: entries[0]!.action,
      stateId: entries[0]!.stateBefore.stateId,
      observationCount: entries.length,
      outcomeCounts: Object.fromEntries(["PASS", "FAIL"].map((outcome) => [outcome,
        entries.filter(({ verifiedOutcome }) => verifiedOutcome === outcome).length]).filter(([, count]) => count)) as PolicyTelemetryV1["outcomeCounts"],
      observedNextStateCounts: Object.fromEntries([...new Set(entries.flatMap(({ stateAfter }) => stateAfter ? [stateAfter.stateId] : []))]
        .sort().map((stateId) => [stateId, entries.filter(({ stateAfter }) => stateAfter?.stateId === stateId).length])),
      meanActualCostMicros: actualCosts.length ? actualCosts.reduce((sum, value) => sum + value, 0) / actualCosts.length : undefined,
      meanDurationMillis: entries.reduce((sum, { durationMillis }) => sum + durationMillis, 0) / entries.length
    };
  }).sort((left, right) => left.graphNodeId.localeCompare(right.graphNodeId) || left.stateId.localeCompare(right.stateId));
};
