import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { RootRunDetail } from "@shared/api/workspace-contracts";
import { RunPolicyViews } from "../src/workspace/runs/RunPolicyViews";

describe("Run SSP evidence views", () => {
  it("separates capability, expected projection, and factual repeated execution occurrences", async () => {
    const user = userEvent.setup();
    render(<RunPolicyViews detail={detail()} />);

    expect(screen.getByText("Capability Graph")).toBeInTheDocument();
    expect(screen.getByText("Policy Projection")).toBeInTheDocument();
    expect(screen.getByText("Execution Graph")).toBeInTheDocument();
    expect(screen.getByText("Expected, not committed. Re-derived at every decision epoch. Branch percentages are configured priors.")).toBeInTheDocument();
    const repeated = screen.getAllByRole("button", { name: /Execution occurrence .*intake/ });
    expect(repeated).toHaveLength(2);
    await user.click(repeated[0]!);
    expect(screen.getByRole("complementary", { name: "intake execution evidence inspector" })).toBeInTheDocument();
    expect(screen.getByText("Actual bounded outcome")).toBeInTheDocument();
  });
});

const detail = (): RootRunDetail => ({
  rootRunId: "run", kind: "graph", targetId: "unrelated", source: "manual", status: "running", stateRevision: 2,
  createdAt: "2026-08-22T00:00:00.000Z", updatedAt: "2026-08-22T00:01:00.000Z",
  executionSnapshot: {
    version: 8, rootKind: "graph", project: { checkoutRoot: "/tmp", headSha: "head", configHash: "config", snapshotHash: "snapshot-hash" },
    issueTracker: {} as RootRunDetail["executionSnapshot"]["issueTracker"],
    graph: {
      id: "unrelated", name: "Unrelated", state: { description: "Bounded", initial: {} }, graphNodes: [],
      strategy: {
        kind: "ssp_v1", id: "policy", description: "Policy", nodeStyle: "luna", nodeSize: "medium",
        capabilityGraph: { version: 1, actions: [{ graphNodeId: "intake", guards: [] }, { graphNodeId: "ship", guards: [] }] },
        model: { version: 1, features: [], states: [], stateActions: [], solver: { algorithm: "ssp_value_iteration_v1", epsilon: 1e-9, maxIterations: 10_000, maxSolveMillis: 2_000 }, projection: { maxDecisionEpochs: 20, maxProjectionNodes: 100 } }
      }
    },
    graphDecision: { strategyKind: "ssp_v1", modelVersion: 1, modelSha256: "model-hash", capabilityGraphSha256: "capability-hash" },
    theme: {} as RootRunDetail["executionSnapshot"]["theme"], executionProfiles: [], runtimes: [], resources: [], createdAt: "2026-08-22T00:00:00.000Z"
  },
  graphNodeInvocations: [], tasks: [], state: { currentRevision: 2, currentStateSha256: "state-hash", revisions: [], totalRevisionCount: 3, historyTruncated: false },
  orchestration: {
    requests: [], decisions: [], policyDecisions: [decision()], policyObservations: [],
    policyProjection: { derived: true, source: "run_snapshot", sourceDecisionStateId: "open", modelVersion: 1, modelSha256: "model-hash", solverStatus: "converged", truncated: false, maxDecisionEpochs: 20, maxProjectionNodes: 100, nodes: [{ projectionNodeId: "projection-1", stateId: "open", depth: 0, cumulativeProbabilityPpm: 1_000_000, selectedGraphNodeId: "ship", expectedRemainingCostMicros: 1, configuredExpectedCostMicros: 1, actionValues: [{ graphNodeId: "ship", qMicros: 1 }] }], edges: [] },
    executionGraph: [occurrence("occurrence-1", 1, "PASS"), occurrence("occurrence-2", 2)],
    policyTelemetry: []
  },
  repair: { requests: [], frames: [], results: [], activeFrames: [] }, controlFlowEvents: []
});
const decision = () => ({ policyDecisionId: "decision-2", rootRunId: "run", epoch: 2, epochKind: "continuation" as const, state: { stateId: "open", features: { phase: "open" }, featureVectorSha256: "feature-hash", sourceStateRevision: 2, evidenceRefs: ["graph-state:2"] }, admissibleActionIds: ["intake", "ship"], excludedActions: [], selectedGraphNodeId: "ship", actionValues: [{ graphNodeId: "ship", qMicros: 1 }, { graphNodeId: "intake", qMicros: 5 }], stateValueMicros: 1, tiedActionIds: ["ship"], solverStatus: "converged" as const, solverAlgorithm: "ssp_value_iteration_v1" as const, iterations: 2, residual: 0, epsilon: 1e-9, modelVersion: 1 as const, modelSha256: "model-hash", policySha256: "policy-hash", snapshotSha256: "snapshot-hash", createdAt: "2026-08-22T00:01:00.000Z" });
const occurrence = (occurrenceId: string, epoch: number, actualOutcome?: "PASS" | "FAIL") => ({ occurrenceId, epoch, policyDecisionId: `decision-${epoch}`, graphNodeInvocationId: `invocation-${epoch}`, graphNodeId: "intake", status: actualOutcome ? "observed" as const : "running" as const, decisionStateBefore: { stateId: "open", features: { phase: "open" }, featureVectorSha256: "feature-hash", sourceStateRevision: epoch - 1, evidenceRefs: [] }, expectedRemainingCostMicros: 5, selectedActionValueMicros: 5, configuredExpectedCostMicros: 2, expectedOutcomeDistribution: [{ nextStateId: "open", probabilityPpm: 200_000 }, { nextStateId: "success", probabilityPpm: 800_000 }], actualOutcome, durationMillis: actualOutcome ? 2_000 : undefined, modelSha256: "model-hash", snapshotSha256: "snapshot-hash", createdAt: `2026-08-22T00:0${epoch}:00.000Z` });
