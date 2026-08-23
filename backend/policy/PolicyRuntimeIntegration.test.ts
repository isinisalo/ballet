import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ProjectGraphNode } from "../../shared/domain/automation.js";
import { defaultCanvasTheme } from "../../shared/domain/canvasTheme.js";
import type { ProjectSspDecisionStrategyV2 } from "../../shared/domain/decisionModel.js";
import type { RootExecutionSnapshot } from "../../shared/domain/runtime.js";
import { RootRunStore } from "../runs/RootRunStore.js";
import { RuntimeDatabase } from "../runtime-db.js";

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

describe("outcome-aware SSP v2 Graph runtime decision epochs", () => {
  it("persists outcome-aware observations, projects actual state, and reevaluates from it after restart", async () => {
    const fixture = await runtimeFixture(strategy());
    if (fixture.snapshot.graph.strategy.kind !== "ssp_v2") throw new Error("Expected SSP v2 snapshot.");
    fixture.snapshot.graph.strategy.model.stateActions[0]!.expectedCostMicros = 999_999;
    fixture.database.initializeRoot(fixture.rootRunId);
    let projection = fixture.database.readRootOrchestration(fixture.rootRunId);
    expect(projection.policyDecisions[0]).toMatchObject({
      scope: "graph", epoch: 1, solverStatus: "converged", selectedActionId: "discover", admissibleActionIds: ["discover"]
    });
    expect(projection.policyDecisions[0]?.excludedActions).toContainEqual({ actionId: "prototype", reasonCode: "guard_denied" });

    const firstInvocation = fixture.database.listRootGraphNodeInvocations(fixture.rootRunId)[0]!;
    const firstOrchestrator = fixture.database.pendingNodeRuns(fixture.rootRunId)[0]!;
    fixture.database.applyNodeOutcome(fixture.rootRunId, firstOrchestrator.nodeRunId, complete("FAIL", "discover-failed"));

    projection = fixture.database.readRootOrchestration(fixture.rootRunId);
    expect(projection.policyObservations[0]).toMatchObject({
      scope: "graph", actionId: "discover", observedOutcomeId: "discover-failed", verifiedResult: "FAIL",
      configuredExpectedCostMicros: 5, stateBefore: { stateId: "start" }, actualState: { stateId: "recovery" }, modelMatch: "match"
    });
    expect(projection.policyDecisions[1]).toMatchObject({
      epoch: 2, solverStatus: "converged", selectedActionId: "package",
      previousActionInvocationId: firstInvocation.graphNodeInvocationId
    });

    fixture.database.close();
    const reopened = new RuntimeDatabase(fixture.databasePath);
    expect(reopened.readRootOrchestration(fixture.rootRunId).policyDecisions).toEqual(projection.policyDecisions);
    const packageOrchestrator = reopened.pendingNodeRuns(fixture.rootRunId)[0]!;
    reopened.applyNodeOutcome(fixture.rootRunId, packageOrchestrator.nodeRunId, complete("PASS", "package-succeeded"));
    const final = reopened.readRootOrchestration(fixture.rootRunId);
    expect(final.policyObservations).toHaveLength(2);
    expect(final.policyDecisions.at(-1)).toMatchObject({ epoch: 3, solverStatus: "terminal", state: { stateId: "published" } });
    expect(new RootRunStore(() => reopened.connection()).require(fixture.rootRunId).status).toBe("completed");
    reopened.close();
  });

  it("rejects a semantic outcome outside the immutable selected action contract", async () => {
    const fixture = await runtimeFixture(strategy());
    fixture.database.initializeRoot(fixture.rootRunId);
    const node = fixture.database.pendingNodeRuns(fixture.rootRunId)[0]!;
    expect(() => fixture.database.applyNodeOutcome(fixture.rootRunId, node.nodeRunId, complete("FAIL", "unknown-failure")))
      .toThrow(/outcome.*outside/i);
    expect(fixture.database.readRootOrchestration(fixture.rootRunId).policyObservations).toEqual([]);
    fixture.database.close();
  });

  it("fails closed without agent fallback when the solver bound is exhausted", async () => {
    const bounded = strategy();
    bounded.capabilityModel.actions = [{ actionId: "discover", guards: [] }];
    bounded.model.stateActions = [{
      stateId: "start", actionId: "discover", expectedCostMicros: 1,
      successors: [
        { outcomeId: "discover-failed", expectedNextStateId: "start", probabilityPpm: 500_000 },
        { outcomeId: "discover-succeeded", expectedNextStateId: "discovered", probabilityPpm: 500_000 }
      ]
    }];
    bounded.model.solver.maxIterations = 1;
    const fixture = await runtimeFixture(bounded, ["discover"]);
    fixture.database.initializeRoot(fixture.rootRunId);
    const projection = fixture.database.readRootOrchestration(fixture.rootRunId);
    expect(projection.policyDecisions[0]).toMatchObject({ solverStatus: "policy_not_converged" });
    expect(fixture.database.listRootGraphNodeInvocations(fixture.rootRunId)).toEqual([]);
    expect(new RootRunStore(() => fixture.database.connection()).require(fixture.rootRunId)).toMatchObject({
      status: "waiting_for_input", errorCode: "policy_not_converged"
    });
    fixture.database.close();
  });
});

const runtimeFixture = async (policy: ProjectSspDecisionStrategyV2, ids = ["discover", "prototype", "package"]) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ballet-policy-runtime-")); roots.push(root);
  const databasePath = path.join(root, "state.sqlite"); const database = new RuntimeDatabase(databasePath);
  const rootRunId = "00000000-0000-4000-8000-000000000021"; const snapshot = executionSnapshot(policy, ids);
  new RootRunStore(() => database.connection()).create({
    rootRunId, kind: "graph", targetId: snapshot.graph.id, worktreePath: root,
    branch: "codex/policy-runtime", headSha: "a".repeat(40), configHash: "config",
    snapshotHash: snapshot.project.snapshotHash, executionSnapshot: snapshot, createdAt: "2026-08-22T00:00:00.000Z"
  });
  return { rootRunId, databasePath, database, snapshot };
};

const executionSnapshot = (policy: ProjectSspDecisionStrategyV2, ids: string[]): RootExecutionSnapshot => ({
  version: 10, policyObservationContractVersion: 3, rootKind: "graph",
  project: { checkoutRoot: "/tmp/policy", headSha: "a".repeat(40), configHash: "config", snapshotHash: "snapshot-hash" },
  issueTracker: { kind: "tk", testedRevision: "b".repeat(40), orchestrationDirectory: ".tickets/orchestration", workDirectory: ".tickets/work" },
  graph: { id: "generic-policy-graph", name: "Generic policy graph", state: { description: "Bounded authorization facts.", initial: { permitPrototype: "no" } }, strategy: structuredClone(policy), graphNodes: ids.map(graphNode) },
  graphDecision: { strategyKind: "ssp_v2", modelVersion: 2, modelSha256: "model-hash", capabilityModelSha256: "capability-hash" },
  graphNodeDecisions: Object.fromEntries(ids.map((id) => [id, { strategyKind: "agent_v1" as const }])),
  theme: structuredClone(defaultCanvasTheme), executionProfiles: [], runtimes: [], resources: [], createdAt: "2026-08-22T00:00:00.000Z"
});

const strategy = (): ProjectSspDecisionStrategyV2 => ({
  kind: "ssp_v2", id: "policy-core", description: "Generic SSP policy.",
  capabilityModel: { version: 2, outcomes: [
    { id: "discover-succeeded", description: "Discovery passed." }, { id: "discover-failed", description: "Discovery failed." },
    { id: "prototype-succeeded", description: "Prototype passed." }, { id: "prototype-failed", description: "Prototype failed." },
    { id: "package-succeeded", description: "Package passed." }, { id: "package-failed", description: "Package failed." }
  ], actions: [
    { actionId: "discover", guards: [] },
    { actionId: "prototype", guards: [{ featureId: "authorization", allowedValues: ["yes"] }] },
    { actionId: "package", guards: [] }
  ] },
  model: {
    version: 2,
    features: [
      { id: "epoch", domain: ["start", "continuation"], missingValue: "start", source: { kind: "runtime", fact: "epoch_kind" } },
      { id: "previous-action", domain: ["none", "discover", "prototype", "package"], missingValue: "none", source: { kind: "runtime", fact: "previous_action_id" } },
      { id: "result", domain: ["none", "PASS", "FAIL"], missingValue: "none", source: { kind: "runtime", fact: "previous_action_result" } },
      { id: "outcome", domain: ["none", "discover-succeeded", "discover-failed", "package-succeeded", "package-failed"], missingValue: "none", source: { kind: "runtime", fact: "previous_outcome_id" } },
      { id: "authorization", domain: ["yes", "no"], missingValue: "no", source: { kind: "authorization", pointer: "/permitPrototype" } }
    ],
    states: [
      state("start", "start", "none", "none", "none"), state("recovery", "continuation", "discover", "FAIL", "discover-failed"),
      { ...state("discovered", "continuation", "discover", "PASS", "discover-succeeded"), terminal: "success" },
      { ...state("published", "continuation", "package", "PASS", "package-succeeded"), terminal: "success" },
      { ...state("failure", "continuation", "package", "FAIL", "package-failed"), terminal: "failure" },
      { ...state("blocked", "continuation", "prototype", "FAIL", "none"), terminal: "blocked" }
    ],
    stateActions: [
      { stateId: "start", actionId: "discover", expectedCostMicros: 5, successors: [
        { outcomeId: "discover-succeeded", expectedNextStateId: "discovered", probabilityPpm: 900_000 },
        { outcomeId: "discover-failed", expectedNextStateId: "recovery", probabilityPpm: 100_000 }
      ] },
      { stateId: "start", actionId: "prototype", expectedCostMicros: 1, successors: [{ outcomeId: "prototype-succeeded", expectedNextStateId: "discovered", probabilityPpm: 1_000_000 }] },
      { stateId: "recovery", actionId: "package", expectedCostMicros: 8, successors: [{ outcomeId: "package-succeeded", expectedNextStateId: "published", probabilityPpm: 1_000_000 }] }
    ],
    solver: { algorithm: "ssp_value_iteration_v2", epsilon: 1e-9, maxIterations: 10_000, maxSolveMillis: 2_000 },
    projection: { maxDecisionEpochs: 20, maxProjectionNodes: 100 }
  }
});

const state = (id: string, epoch: string, action: string, result: string, outcome: string) => ({
  id, values: { epoch, "previous-action": action, result, outcome, authorization: "no" }
});

const graphNode = (id: string): ProjectGraphNode => ({
  id, description: `Generic ${id} option.`, capabilities: { accepts: [], provides: [] },
  outcomes: [{ outcomeId: `${id}-succeeded`, result: "PASS" }, { outcomeId: `${id}-failed`, result: "FAIL" }],
  stateContract: { description: "Uses bounded state." },
  strategy: { kind: "agent_v1", orchestrator: {
    id: `${id}-orchestrator`, description: "Completes from verified evidence.", executionProfileId: "unused",
    primaryInstructionId: "project:unused", skillIds: [], maxTransitions: 256, maxRouteAttempts: 1,
    routing: { start: { id: `${id}-start`, candidates: [
      { target: { jobNodeId: `${id}-job` }, description: "Run the job." },
      { target: { terminal: "PASS" }, description: "Verified PASS." },
      { target: { terminal: "FAIL" }, description: "Verified FAIL." }
    ] }, continuation: [], repair: [] }
  } },
  jobNodes: [{
    id: `${id}-job`, description: "Unused aggregate Job.", capabilities: { accepts: [], provides: [] }, outcomes: [], maxRetries: 0,
    workNode: { id: `${id}-work`, type: "human", description: "Work.", task: "Work.", nodeStyle: "terra", nodeSize: "medium" },
    validationNode: { id: `${id}-validation`, type: "human", description: "Validate.", task: "Validate.", nodeStyle: "terra", nodeSize: "medium" }
  }]
});

const complete = (result: "PASS" | "FAIL", outcomeId: string) => ({
  role: "orchestrator" as const, state: "completed" as const, action: "complete" as const,
  summary: `Verified ${result}.`, result, outcomeId, reason: "Test observation."
});
