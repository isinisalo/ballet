import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type {
  ExecutionGraphOccurrenceV3, PolicyDecisionRecordV2, PolicyProjectionV2, RootRunDetail
} from "@shared/api/workspace-contracts";
import { RunPolicyViews } from "../src/workspace/runs/RunPolicyViews";

describe("Run SSP v2 evidence views", () => {
  it("separates the projected policy from factual repeated execution observations", async () => {
    const user = userEvent.setup();
    render(<RunPolicyViews detail={detail()} />);

    expect(screen.getByText("Current State")).toBeInTheDocument();
    expect(screen.getByText("Current Decision")).toBeInTheDocument();
    expect(screen.getByText("Policy Projection")).toBeInTheDocument();
    expect(screen.getByText("Most Likely Rollout")).toBeInTheDocument();
    expect(screen.getByText("Execution Graph")).toBeInTheDocument();
    expect(screen.getByText(/Expected, not committed\. Re-derived from canonical actual state/)).toBeInTheDocument();
    const repeated = screen.getAllByRole("button", { name: /Execution observation .*intake/ });
    expect(repeated).toHaveLength(2);
    await user.click(repeated[0]!);
    expect(screen.getByRole("complementary", { name: "intake execution evidence inspector" })).toBeInTheDocument();
    expect(screen.getByText("Canonical actual projected state")).toBeInTheDocument();
    expect(screen.getByText("Model support")).toBeInTheDocument();
  });
});

const detail = (): RootRunDetail => ({
  rootRunId: "run", kind: "graph", targetId: "unrelated", source: "manual", status: "running", stateRevision: 2,
  createdAt: "2026-08-22T00:00:00.000Z", updatedAt: "2026-08-22T00:01:00.000Z",
  executionSnapshot: {
    version: 10, policyObservationContractVersion: 3, rootKind: "graph",
    project: { checkoutRoot: "/tmp", headSha: "head", configHash: "config", snapshotHash: "snapshot-hash" },
    issueTracker: {} as RootRunDetail["executionSnapshot"]["issueTracker"],
    graph: {} as RootRunDetail["executionSnapshot"]["graph"],
    graphDecision: {
      strategyKind: "ssp_v2", modelVersion: 2, modelSha256: "model-hash", capabilityModelSha256: "capability-hash"
    },
    graphNodeDecisions: {}, theme: {} as RootRunDetail["executionSnapshot"]["theme"],
    executionProfiles: [], runtimes: [], resources: [], createdAt: "2026-08-22T00:00:00.000Z"
  },
  graphNodeInvocations: [], tasks: [],
  state: { currentRevision: 2, currentStateSha256: "state-hash", revisions: [], totalRevisionCount: 3, historyTruncated: false },
  orchestration: {
    requests: [], decisions: [], policyDecisions: [decision()], policyObservations: [],
    policyProjections: { graph: projection() },
    executionGraph: [occurrence("occurrence-1", 1), occurrence("occurrence-2", 2)],
    policyTelemetry: []
  },
  repair: { requests: [], frames: [], results: [], activeFrames: [] }, controlFlowEvents: []
});

const decision = (): PolicyDecisionRecordV2 => ({
  policyDecisionId: "decision-2", rootRunId: "run", scope: "graph", scopeKey: "graph", epoch: 2,
  epochKind: "continuation", state: state(2), admissibleActionIds: ["intake", "ship"], excludedActions: [],
  selectedActionId: "ship", actionValues: [{ actionId: "ship", qMicros: 1 }, { actionId: "intake", qMicros: 5 }],
  stateValueMicros: 1, tiedActionIds: ["ship"], solverStatus: "converged", solverAlgorithm: "ssp_value_iteration_v2",
  iterations: 2, residual: 0, epsilon: 1e-9, modelVersion: 2, modelSha256: "model-hash",
  policySha256: "policy-hash", snapshotSha256: "snapshot-hash", createdAt: "2026-08-22T00:01:00.000Z"
});

const projection = (): PolicyProjectionV2 => ({
  derived: true, source: "run_snapshot", scope: "graph", sourceDecisionStateId: "open", modelVersion: 2,
  modelSha256: "model-hash", solverStatus: "converged", truncated: false, maxDecisionEpochs: 20,
  maxProjectionNodes: 100, mostLikelyRolloutNodeIds: ["projection-1", "projection-2"],
  nodes: [
    { projectionNodeId: "projection-1", stateId: "open", depth: 0, cumulativeProbabilityPpm: 1_000_000,
      selectedActionId: "ship", expectedRemainingCostMicros: 1, configuredExpectedCostMicros: 1,
      actionValues: [{ actionId: "ship", qMicros: 1 }] },
    { projectionNodeId: "projection-2", stateId: "success", depth: 1, cumulativeProbabilityPpm: 1_000_000,
      terminal: "success", actionValues: [] }
  ],
  edges: [{ fromProjectionNodeId: "projection-1", toProjectionNodeId: "projection-2", outcomeId: "ship-pass",
    probabilityPpm: 1_000_000, cumulativeProbabilityPpm: 1_000_000, configuredPrior: true }]
});

const occurrence = (occurrenceId: string, epoch: number): ExecutionGraphOccurrenceV3 => ({
  occurrenceId, scope: "graph", scopeKey: "graph", epoch, policyDecisionId: `decision-${epoch}`,
  actionInvocationId: `invocation-${epoch}`, graphNodeInvocationId: `invocation-${epoch}`, actionId: "intake",
  status: "observed", decisionStateBefore: state(epoch - 1), expectedRemainingCostMicros: 5,
  selectedActionValueMicros: 5, configuredExpectedCostMicros: 2,
  expectedOutcomeDistribution: [{ outcomeId: "intake-pass", expectedNextStateId: "open", probabilityPpm: 1_000_000 }],
  observedOutcomeId: "intake-pass", verifiedResult: "PASS", actualState: state(epoch), modelMatch: "match",
  observedCost: {
    version: 1,
    attribution: {
      mode: "inclusive_v1", scope: "graph", nodeRunIds: [`node-${epoch}`],
      executionTaskIds: [`task-${epoch}`], childPolicyObservationIds: [`local-observation-${epoch}`]
    },
    dimensions: {
      durationMillis: known(2_000), inputTokens: known(100), outputTokens: known(20), cachedInputTokens: known(40),
      workRetryCount: known(1), repairAttemptCount: known(0),
      monetaryMicros: { status: "unknown", reason: "provider_not_reported", sourceRefs: [] },
      utilityMicros: { status: "unknown", reason: "project_not_configured", sourceRefs: [] }
    }
  },
  modelSha256: "model-hash", snapshotSha256: "snapshot-hash",
  createdAt: `2026-08-22T00:0${epoch}:00.000Z`
});

const state = (revision: number) => ({
  stateId: "open", features: { phase: "open" }, featureVectorSha256: `feature-${revision}`,
  sourceStateRevision: revision, evidenceRefs: [`graph-state:${revision}`]
});
const known = (value: number) => ({ status: "known" as const, value, sourceRefs: [] });
