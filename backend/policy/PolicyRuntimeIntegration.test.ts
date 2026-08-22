import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { defaultCanvasTheme } from "../../shared/domain/canvasTheme.js";
import type { ProjectGraphNode } from "../../shared/domain/automation.js";
import type { ProjectSspGraphStrategyV1 } from "../../shared/domain/decisionModel.js";
import type { RootExecutionSnapshot } from "../../shared/domain/runtime.js";
import { RootRunStore } from "../runs/RootRunStore.js";
import { RuntimeDatabase } from "../runtime-db.js";

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

describe("SSP Graph runtime decision epochs", () => {
  it("persists hard-admissible decisions and reevaluates after the verified option outcome", async () => {
    const fixture = await runtimeFixture(strategy());
    const mutableConfigureCopy = fixture.snapshot;
    mutableConfigureCopy.graph.strategy = invalidChangedStrategy();

    fixture.database.initializeRoot(fixture.rootRunId);
    let projection = fixture.database.readRootOrchestration(fixture.rootRunId);
    expect(projection.requests.every(({ scope }) => scope === "graph_node")).toBe(true);
    expect(projection.policyDecisions[0]).toMatchObject({
      epoch: 1, solverStatus: "converged", selectedGraphNodeId: "discover",
      admissibleActionIds: ["discover"]
    });
    expect(projection.policyDecisions[0]?.excludedActions).toContainEqual({
      graphNodeId: "prototype", reasonCode: "guard_denied"
    });
    expect(projection.policyDecisions[0]?.actionValues.map(({ graphNodeId }) => graphNodeId)).toEqual(["discover"]);

    const firstInvocation = fixture.database.listRootGraphNodeInvocations(fixture.rootRunId)[0]!;
    expect(firstInvocation).toMatchObject({ graphNodeId: "discover", policyDecisionId: projection.policyDecisions[0]?.policyDecisionId });
    const firstOrchestrator = fixture.database.pendingNodeRuns(fixture.rootRunId)[0]!;
    fixture.database.applyNodeOutcome(fixture.rootRunId, firstOrchestrator.nodeRunId, complete("FAIL"));

    projection = fixture.database.readRootOrchestration(fixture.rootRunId);
    expect(projection.policyObservations).toHaveLength(1);
    expect(projection.policyObservations[0]).toMatchObject({
      action: "discover", verifiedOutcome: "FAIL",
      configuredExpectedCostMicros: 5,
      stateBefore: { stateId: "start" }, stateAfter: { stateId: "recovery" }
    });
    expect(projection.policyDecisions[1]).toMatchObject({
      epoch: 2, solverStatus: "converged", selectedGraphNodeId: "package",
      previousGraphNodeInvocationId: firstInvocation.graphNodeInvocationId
    });
    expect(fixture.database.listRootGraphNodeInvocations(fixture.rootRunId).map(({ graphNodeId }) => graphNodeId))
      .toEqual(["discover", "package"]);

    fixture.database.close();
    const reopened = new RuntimeDatabase(fixture.databasePath);
    expect(reopened.readRootOrchestration(fixture.rootRunId).policyDecisions).toEqual(projection.policyDecisions);
    const packageOrchestrator = reopened.pendingNodeRuns(fixture.rootRunId)[0]!;
    reopened.applyNodeOutcome(fixture.rootRunId, packageOrchestrator.nodeRunId, complete("PASS"));
    const final = reopened.readRootOrchestration(fixture.rootRunId);
    expect(final.policyObservations).toHaveLength(2);
    expect(final.policyDecisions.at(-1)).toMatchObject({ epoch: 3, solverStatus: "terminal", state: { stateId: "published" } });
    expect(new RootRunStore(() => reopened.connection()).require(fixture.rootRunId).status).toBe("completed");
    reopened.close();
  });

  it("fails closed without a child invocation or agent fallback when the solver bound is exhausted", async () => {
    const bounded = strategy();
    bounded.capabilityGraph.actions = [{ graphNodeId: "discover", guards: [] }];
    bounded.model.stateActions = [{
      stateId: "start", graphNodeId: "discover", expectedCostMicros: 1,
      successors: [{ nextStateId: "start", probabilityPpm: 500_000 }, { nextStateId: "published", probabilityPpm: 500_000 }]
    }];
    bounded.model.solver.maxIterations = 1;
    const fixture = await runtimeFixture(bounded, ["discover"]);
    fixture.database.initializeRoot(fixture.rootRunId);
    const projection = fixture.database.readRootOrchestration(fixture.rootRunId);
    expect(projection.policyDecisions[0]).toMatchObject({ solverStatus: "policy_not_converged" });
    expect(projection.requests).toEqual([]);
    expect(fixture.database.listRootGraphNodeInvocations(fixture.rootRunId)).toEqual([]);
    expect(new RootRunStore(() => fixture.database.connection()).require(fixture.rootRunId)).toMatchObject({
      status: "waiting_for_input", errorCode: "policy_not_converged"
    });
    fixture.database.close();
  });

  it("atomically rolls back the initial policy decision when child dispatch cannot commit", async () => {
    const fixture = await runtimeFixture(strategy());
    fixture.database.connection().exec(`
      CREATE TRIGGER reject_policy_dispatch BEFORE INSERT ON graph_node_invocations
      BEGIN SELECT RAISE(ABORT, 'injected dispatch failure'); END;
    `);

    expect(() => fixture.database.initializeRoot(fixture.rootRunId)).toThrow("injected dispatch failure");
    expect(fixture.database.readRootOrchestration(fixture.rootRunId).policyDecisions).toEqual([]);
    expect(fixture.database.listRootGraphNodeInvocations(fixture.rootRunId)).toEqual([]);
    expect(new RootRunStore(() => fixture.database.connection()).require(fixture.rootRunId).status).toBe("queued");
    fixture.database.close();
  });
});

const runtimeFixture = async (policy: ProjectSspGraphStrategyV1, ids = ["discover", "prototype", "package"]) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ballet-policy-runtime-"));
  roots.push(root);
  const databasePath = path.join(root, "state.sqlite");
  const database = new RuntimeDatabase(databasePath);
  const runRoots = new RootRunStore(() => database.connection());
  const rootRunId = "00000000-0000-4000-8000-000000000021";
  const snapshot = executionSnapshot(policy, ids);
  runRoots.create({
    rootRunId, kind: "graph", targetId: snapshot.graph.id, worktreePath: root,
    branch: "codex/policy-runtime", headSha: "a".repeat(40), configHash: "config",
    snapshotHash: snapshot.project.snapshotHash, executionSnapshot: snapshot,
    createdAt: "2026-08-22T00:00:00.000Z"
  });
  return { rootRunId, databasePath, database, snapshot };
};

const executionSnapshot = (policy: ProjectSspGraphStrategyV1, ids: string[]): RootExecutionSnapshot => ({
  version: 8, rootKind: "graph",
  project: { checkoutRoot: "/tmp/policy", headSha: "a".repeat(40), configHash: "config", snapshotHash: "snapshot-hash" },
  issueTracker: {
    kind: "tk", testedRevision: "b".repeat(40),
    orchestrationDirectory: ".tickets/orchestration", workDirectory: ".tickets/work"
  },
  graph: {
    id: "generic-policy-graph", name: "Generic policy graph",
    state: { description: "Bounded authorization facts.", initial: { permitPrototype: "no" } },
    strategy: structuredClone(policy), graphNodes: ids.map(graphNode)
  },
  graphDecision: { strategyKind: "ssp_v1", modelVersion: 1, modelSha256: "model-hash", capabilityGraphSha256: "capability-hash" },
  theme: structuredClone(defaultCanvasTheme), executionProfiles: [], runtimes: [], resources: [],
  createdAt: "2026-08-22T00:00:00.000Z"
});

const strategy = (): ProjectSspGraphStrategyV1 => ({
  kind: "ssp_v1", id: "policy-core", description: "Generic SSP policy.", nodeStyle: "luna", nodeSize: "medium",
  capabilityGraph: { version: 1, actions: [
    { graphNodeId: "discover", guards: [] },
    { graphNodeId: "prototype", guards: [{ featureId: "authorization", allowedValues: ["yes"] }] },
    { graphNodeId: "package", guards: [] }
  ] },
  model: {
    version: 1,
    features: [
      { id: "epoch", domain: ["start", "continuation"], missingValue: "start", source: { kind: "runtime", fact: "epoch_kind" } },
      { id: "previous-node", domain: ["none", "discover", "prototype", "package"], missingValue: "none", source: { kind: "runtime", fact: "previous_graph_node_id" } },
      { id: "result", domain: ["none", "PASS", "FAIL"], missingValue: "none", source: { kind: "runtime", fact: "previous_graph_node_result" } },
      { id: "authorization", domain: ["yes", "no"], missingValue: "no", source: { kind: "authorization", pointer: "/permitPrototype" } }
    ],
    states: [
      { id: "start", values: { epoch: "start", "previous-node": "none", result: "none", authorization: "no" } },
      { id: "recovery", values: { epoch: "continuation", "previous-node": "discover", result: "FAIL", authorization: "no" } },
      { id: "discovered", values: { epoch: "continuation", "previous-node": "discover", result: "PASS", authorization: "no" }, terminal: "success" },
      { id: "published", values: { epoch: "continuation", "previous-node": "package", result: "PASS", authorization: "no" }, terminal: "success" },
      { id: "failure", values: { epoch: "continuation", "previous-node": "package", result: "FAIL", authorization: "no" }, terminal: "failure" },
      { id: "blocked", values: { epoch: "continuation", "previous-node": "prototype", result: "FAIL", authorization: "no" }, terminal: "blocked" }
    ],
    stateActions: [
      { stateId: "start", graphNodeId: "discover", expectedCostMicros: 5, successors: [
        { nextStateId: "discovered", probabilityPpm: 900_000 }, { nextStateId: "recovery", probabilityPpm: 100_000 }
      ] },
      { stateId: "start", graphNodeId: "prototype", expectedCostMicros: 1, successors: [{ nextStateId: "discovered", probabilityPpm: 1_000_000 }] },
      { stateId: "recovery", graphNodeId: "package", expectedCostMicros: 8, successors: [{ nextStateId: "published", probabilityPpm: 1_000_000 }] }
    ],
    solver: { algorithm: "ssp_value_iteration_v1", epsilon: 1e-9, maxIterations: 10_000, maxSolveMillis: 2_000 },
    projection: { maxDecisionEpochs: 20, maxProjectionNodes: 100 }
  }
});

const invalidChangedStrategy = (): ProjectSspGraphStrategyV1 => {
  const changed = strategy();
  changed.model.stateActions.find(({ graphNodeId }) => graphNodeId === "discover")!.expectedCostMicros = 999_999;
  return changed;
};

const graphNode = (id: string): ProjectGraphNode => ({
  id, description: `Generic ${id} option.`, nodeStyle: "vector-planet", nodeSize: "medium",
  capabilities: { accepts: [], provides: [] }, stateContract: { description: "Uses bounded state." },
  orchestrator: {
    id: `${id}-orchestrator`, description: "Completes the option from verified evidence.", nodeStyle: "luna", nodeSize: "medium",
    executionProfileId: "unused", primaryInstructionId: "project:unused", skillIds: [], maxTransitions: 256, maxRouteAttempts: 1,
    routing: { start: { id: `${id}-start`, candidates: [
      { target: { terminal: "PASS" }, description: "Verified PASS." },
      { target: { terminal: "FAIL" }, description: "Verified FAIL." }
    ] }, continuation: [], repair: [] }
  },
  jobNodes: [{
    id: `${id}-job`, description: "Unused aggregate Job.", nodeStyle: "terra", nodeSize: "medium",
    capabilities: { accepts: [], provides: [] }, maxRetries: 0,
    workNode: { id: `${id}-work`, type: "human", description: "Work.", task: "Work.", nodeStyle: "terra", nodeSize: "medium" },
    validationNode: { id: `${id}-validation`, type: "human", description: "Validate.", task: "Validate.", nodeStyle: "terra", nodeSize: "medium" }
  }]
});

const complete = (result: "PASS" | "FAIL") => ({
  role: "orchestrator" as const, state: "completed" as const, action: "complete" as const,
  summary: `Verified ${result}.`, result, reason: "Test observation."
});
