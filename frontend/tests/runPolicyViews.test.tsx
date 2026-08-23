import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { RootRunDetail } from "@shared/api/workspace-contracts";
import { RunPolicyViews } from "../src/workspace/runs/RunPolicyViews";

describe("Run Reward-MDP evidence views", () => {
  it("separates compiled policy, factual ledger and observed outcomes", async () => {
    const user = userEvent.setup();
    render(<RunPolicyViews detail={detail()} />);
    expect(screen.getByText("Current decision")).toBeInTheDocument();
    expect(screen.getByText("Compiled Q / V table")).toBeInTheDocument();
    expect(screen.getByText("Acceptance progress")).toBeInTheDocument();
    expect(screen.getByText("Execution observations")).toBeInTheDocument();
    expect(screen.getByText("verified")).toBeInTheDocument();
    const observed = screen.getByRole("button", { name: /Policy observation 1, design/ });
    await user.click(observed);
    expect(screen.getByRole("complementary", { name: "design execution evidence inspector" })).toBeInTheDocument();
    expect(screen.getByText("Configured P(outcome,state′|state,action)")).toBeInTheDocument();
    expect(screen.getByText("Realized reward")).toBeInTheDocument();
  });
});

const detail = (): RootRunDetail => ({
  rootRunId: "run",
  kind: "graph",
  targetId: "graph-engineering",
  source: "manual",
  status: "running",
  stateRevision: 0,
  createdAt: "2026-08-23T00:00:00.000Z",
  updatedAt: "2026-08-23T00:01:00.000Z",
  executionSnapshot: {
    version: 11,
    policyObservationContractVersion: 4,
    rootKind: "graph",
    project: { checkoutRoot: "/tmp", headSha: "head", configHash: "config", snapshotHash: "snapshot" },
    issueTracker: {} as RootRunDetail["executionSnapshot"]["issueTracker"],
    graph: {} as RootRunDetail["executionSnapshot"]["graph"],
    decisionModel: {
      strategyKind: "reward_mdp_v3",
      modelVersion: 3,
      modelSha256: "model",
      capabilityModelSha256: "capability"
    },
    theme: {} as RootRunDetail["executionSnapshot"]["theme"],
    executionProfiles: [],
    runtimes: [],
    resources: [],
    authorization: { version: 1, facts: {}, sha256: "authorization" },
    acceptanceLedger: ledger(),
    compiledPolicy: compiled(),
    createdAt: "2026-08-23T00:00:00.000Z"
  },
  graphNodeInvocations: [],
  tasks: [],
  state: {
    currentRevision: 0,
    currentStateSha256: "state",
    revisions: [],
    totalRevisionCount: 1,
    historyTruncated: false
  },
  orchestration: {
    policyDecisions: [{
      version: 3,
      policyDecisionId: "decision",
      rootRunId: "run",
      epoch: 1,
      epochKind: "start",
      state: state("open", 0),
      admissibleActionIds: ["design"],
      excludedActions: [],
      selectedActionId: "design",
      actionValues: [{ actionId: "design", qMicros: 10_000_000 }],
      stateValueMicros: 10_000_000,
      solverStatus: "compiled",
      modelSha256: "model",
      policySha256: "policy",
      snapshotSha256: "snapshot",
      createdAt: "2026-08-23T00:00:00.000Z"
    }],
    policyObservations: [{
      version: 4,
      policyObservationId: "observation",
      rootRunId: "run",
      policyDecisionId: "decision",
      actionInvocationId: "action",
      graphNodeInvocationId: "action",
      stateBefore: state("open", 0),
      actionId: "design",
      expectedOutcomeDistribution: [{
        outcomeId: "design-valid",
        nextStateId: "done",
        probabilityPpm: 1_000_000,
        provenance: "default_prior"
      }],
      observedCost: {
        version: 1,
        attribution: { mode: "inclusive_v1", nodeRunIds: [], executionTaskIds: [] },
        dimensions: {
          durationMillis: known(100),
          inputTokens: known(10),
          outputTokens: known(4),
          cachedInputTokens: known(0),
          workRetryCount: known(0),
          monetaryMicros: unknown()
        }
      },
      observedOutcomeId: "design-valid",
      verifiedResult: "PASS",
      actualState: state("done", 1_000_000),
      acceptanceLedgerAfter: ledger(),
      realizedRewardMicros: 24_000_000,
      modelMatch: "match",
      modelSha256: "model",
      snapshotSha256: "snapshot",
      createdAt: "2026-08-23T00:01:00.000Z"
    }],
    compiledPolicy: compiled(),
    acceptanceLedger: ledger()
  },
  controlFlowEvents: []
});

const compiled = () => ({
  version: 3 as const,
  algorithm: "discounted_value_iteration_v3" as const,
  status: "compiled" as const,
  states: [{
    stateId: "open",
    selectedActionId: "design",
    valueMicros: 10_000_000,
    actionValues: [{ actionId: "design", qMicros: 10_000_000 }]
  }],
  iterations: 4,
  residualMicros: 1,
  modelSha256: "model",
  policySha256: "policy"
});
const ledger = () => ({
  version: 1 as const,
  entries: [{ obligationId: "design", weight: 1, status: "verified" as const, evidenceRefs: ["test"] }],
  sha256: "ledger"
});
const state = (stateId: string, verifiedProgressPpm: number) => ({
  stateId,
  features: {},
  verifiedProgressPpm,
  featureVectorSha256: stateId,
  sourceStateRevision: 0,
  evidenceRefs: []
});
const known = (value: number) => ({ status: "known" as const, value, sourceRefs: [] });
const unknown = () => ({ status: "unknown" as const, reason: "provider_not_reported" as const, sourceRefs: [] });
