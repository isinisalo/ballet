import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { RootRunDetail } from "@shared/api/workspace-contracts";
import { RunPolicyViews } from "../src/workspace/runs/RunPolicyViews";

describe("hierarchical Run Reward-MDP evidence views", () => {
  it("separates global/local compiled policy, factual ledger and observed outcomes", async () => {
    const user = userEvent.setup();
    render(<RunPolicyViews detail={detail()} />);
    expect(screen.getByText("Current decision")).toBeInTheDocument();
    expect(screen.getByText("Compiled Q / V policies")).toBeInTheDocument();
    expect(screen.getByText("global")).toBeInTheDocument();
    expect(screen.getAllByText("local · design")).toHaveLength(2);
    expect(screen.getByText("Acceptance progress")).toBeInTheDocument();
    expect(screen.getByText("Execution observations")).toBeInTheDocument();
    expect(screen.getByText("verified")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Policy observation 1, design-action/ }));
    expect(screen.getByRole("complementary", { name: "design-action execution evidence inspector" })).toBeInTheDocument();
    expect(screen.getByText("Configured P(outcome,target|state,action)")).toBeInTheDocument();
    expect(screen.getByText("Realized reward")).toBeInTheDocument();
  });
});

const detail = () => ({
  rootRunId: "run",
  kind: "graph",
  targetId: "graph-engineering",
  source: "manual",
  status: "running",
  stateRevision: 0,
  current: { graphNodeId: "design", actionNodeId: "design-action" },
  createdAt: "2026-08-23T00:00:00.000Z",
  updatedAt: "2026-08-23T00:01:00.000Z",
  executionSnapshot: {
    version: 12,
    policyObservationContractVersion: 5,
    rootKind: "graph",
    project: { checkoutRoot: "/tmp", headSha: "head", configHash: "config", snapshotHash: "snapshot" },
    decisionModels: {
      global: { strategyKind: "reward_mdp_v4", modelVersion: 4, modelSha256: "global-model" },
      graphNodes: { design: { strategyKind: "reward_mdp_v4", modelVersion: 4, modelSha256: "local-model" } }
    }
  },
  graphNodeInvocations: [],
  tasks: [],
  state: { currentRevision: 0, currentStateSha256: "state", revisions: [], totalRevisionCount: 1, historyTruncated: false },
  orchestration: {
    policyDecisions: [{
      version: 5,
      policyDecisionId: "local-decision",
      rootRunId: "run",
      epoch: 2,
      epochKind: "continuation",
      scope: "graph_node",
      graphNodeId: "design",
      graphNodeInvocationId: "graph-node-invocation",
      state: state("graph_node", "design-action", 0, "design"),
      admissibleActionIds: ["design-action"],
      excludedActions: [],
      selectedActionId: "design-action",
      actionValues: [{ actionId: "design-action", qMicros: 10_000_000 }],
      stateValueMicros: 10_000_000,
      solverStatus: "compiled",
      modelSha256: "local-model",
      policySha256: "local-policy",
      snapshotSha256: "snapshot",
      createdAt: "2026-08-23T00:00:30.000Z"
    }],
    policyObservations: [{
      version: 5,
      policyObservationId: "observation",
      rootRunId: "run",
      policyDecisionId: "local-decision",
      scope: "graph_node",
      graphNodeId: "design",
      graphNodeInvocationId: "graph-node-invocation",
      actionInvocationId: "action-invocation",
      stateBefore: state("graph_node", "design-action", 0, "design"),
      actionId: "design-action",
      expectedOutcomeDistribution: [{
        outcomeId: "design-valid",
        target: { kind: "terminal", terminal: "success", emitOutcomeId: "design-complete" },
        probabilityPpm: 1_000_000,
        provenance: "default_prior",
        penaltyClass: "none"
      }],
      observedCost: {
        version: 1,
        attribution: { mode: "inclusive_v1", nodeRunIds: [], executionTaskIds: [] },
        dimensions: {
          durationMillis: known(100), inputTokens: known(10), outputTokens: known(4),
          cachedInputTokens: known(0), workRetryCount: known(0), monetaryMicros: unknown()
        }
      },
      observedOutcomeId: "design-valid",
      emittedOutcomeId: "design-complete",
      verifiedResult: "PASS",
      terminal: "success",
      acceptanceLedgerAfter: ledger(),
      realizedRewardMicros: 4_000_000,
      modelMatch: "match",
      modelSha256: "local-model",
      snapshotSha256: "snapshot",
      createdAt: "2026-08-23T00:01:00.000Z"
    }],
    compiledPolicies: { global: compiled("graph"), graphNodes: { design: compiled("graph_node", "design") } },
    acceptanceLedger: ledger()
  },
  controlFlowEvents: []
}) as unknown as RootRunDetail;

const compiled = (scope: "graph" | "graph_node", graphNodeId?: string) => ({
  version: 4 as const,
  scope,
  ...(graphNodeId ? { graphNodeId } : {}),
  algorithm: "discounted_value_iteration_v4" as const,
  status: "compiled" as const,
  initialStateId: scope === "graph" ? "design" : "design-action",
  stateIds: [scope === "graph" ? "design" : "design-action"],
  actionIds: [scope === "graph" ? "design" : "design-action"],
  states: [{
    stateId: scope === "graph" ? "design" : "design-action",
    selectedActionId: scope === "graph" ? "design" : "design-action",
    valueMicros: 10_000_000,
    actionValues: [{ actionId: scope === "graph" ? "design" : "design-action", qMicros: 10_000_000 }]
  }],
  iterations: 4,
  residualMicros: 1,
  modelSha256: `${scope}-model`,
  policySha256: `${scope}-policy`
});
const ledger = () => ({
  version: 1 as const,
  entries: [{ obligationId: "design-accepted", weight: 1, status: "verified" as const, evidenceRefs: ["test"] }],
  sha256: "ledger"
});
const state = (scope: "graph" | "graph_node", stateId: string, acceptanceProgressPpm: number, graphNodeId?: string) => ({
  scope, ...(graphNodeId ? { graphNodeId } : {}), stateId, acceptanceProgressPpm, sourceStateRevision: 0, evidenceRefs: []
});
const known = (value: number) => ({ status: "known" as const, value, sourceRefs: [] });
const unknown = () => ({ status: "unknown" as const, reason: "provider_not_reported" as const, sourceRefs: [] });
