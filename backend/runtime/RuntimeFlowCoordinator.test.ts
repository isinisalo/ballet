import { readFile } from "node:fs/promises";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { projectConfigSchema } from "../../shared/api/workspace-schemas.js";
import { defaultCanvasTheme } from "../../shared/domain/canvasTheme.js";
import { maxControlFlowTransitions } from "../../shared/domain/runtime.js";
import type { RootExecutionSnapshot, ValidationNodeOutcome, WorkNodeOutcome } from "../../shared/domain/runtime.js";
import { decisionModelSha256, capabilityModelSha256 } from "../policy/DecisionModelCanonical.js";
import { compileRewardPolicy, rewardBreakdown } from "../policy/RewardMdpCompiler.js";
import { RootRunStore } from "../runs/RootRunStore.js";
import { RuntimeDatabase } from "../runtime-db.js";
import { jsonSha256 } from "./state/CanonicalJson.js";

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

describe("RuntimeFlowCoordinator Reward-MDP execution", () => {
  it("runs ordered Graph Node options through the compiled policy to DONE", async () => {
    const fixture = await runtime("graph");
    const successfulOutcome = {
      design: ["design-valid", "design-accepted"],
      plan: ["plan-valid", "plan-accepted"],
      build: ["build-success", "build-verified"],
      deploy: ["deploy-success", "deploy-verified"],
      verify: ["release-complete", "release-verified"]
    } as const;

    let steps = 0;
    while (fixture.status() !== "completed" && steps < 100) {
      steps += 1;
      const node = fixture.database.pendingNodeRuns("run")[0];
      expect(node, `pending Node at step ${steps}`).toBeDefined();
      if (node!.role === "work") {
        fixture.database.applyNodeOutcome("run", node!.nodeRunId, workPass());
        continue;
      }
      const graphNode = fixture.config.graph.graphNodes.find(({ id }) => id === node!.graphNodeId)!;
      const isLast = graphNode.actionNodes.at(-1)!.id === node!.actionNodeId;
      const [outcomeId, obligationId] = successfulOutcome[node!.graphNodeId as keyof typeof successfulOutcome];
      fixture.database.applyNodeOutcome("run", node!.nodeRunId, validation(
        "PASS", outcomeId, isLast ? [obligationId] : []
      ));
    }

    expect(fixture.status()).toBe("completed");
    const invocations = fixture.database.listRootGraphNodeInvocations("run");
    expect(invocations.map(({ graphNodeId }) => graphNodeId)).toEqual(["design", "plan", "build", "deploy", "verify"]);
    for (const invocation of invocations) {
      const authored = fixture.config.graph.graphNodes.find(({ id }) => id === invocation.graphNodeId)!;
      expect(invocation.actionNodeInvocations.map(({ actionNodeId }) => actionNodeId)).toEqual(authored.actionNodes.map(({ id }) => id));
    }
    const orchestration = fixture.database.readRootOrchestration("run");
    expect(orchestration.policyObservations).toHaveLength(5);
    expect(orchestration.acceptanceLedger.entries.every(({ status }) => status === "verified")).toBe(true);
    expect(orchestration.policyDecisions.at(-1)?.selectedActionId).toBe("verify");
    fixture.database.close();
  });

  it("bounds Validation retry and escalates the typed outcome without Repair state", async () => {
    const fixture = await runtime("graph_node", "build");
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const work = fixture.database.pendingNodeRuns("run")[0]!;
      expect(work).toMatchObject({ role: "work", attempt });
      fixture.database.applyNodeOutcome("run", work.nodeRunId, workPass());
      const validationNode = fixture.database.pendingNodeRuns("run")[0]!;
      expect(validationNode).toMatchObject({ role: "validation", attempt });
      fixture.database.applyNodeOutcome("run", validationNode.nodeRunId, validation(
        "FAIL", "implementation-defect", [], ["build-verified"], "retry"
      ));
      if (attempt < 3) expect(fixture.status()).toBe("running");
    }
    expect(fixture.status()).toBe("failed");
    expect(fixture.database.listRootGraphNodeInvocations("run")[0]!.nodeRuns
      .filter(({ role }) => role === "work").map(({ attempt }) => attempt)).toEqual([1, 2, 3]);
    const tables = fixture.database.connection().prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table'"
    ).pluck().all() as string[];
    expect(tables).not.toEqual(expect.arrayContaining(["repair_frames", "repair_requests", "repair_results"]));
    fixture.database.close();
  });
});

describe("RuntimeFlowCoordinator Reward-MDP conformance guards", () => {
  it("records realized reward from the factual projected state when an authored branch misses", async () => {
    const fixture = await runtime("graph");
    let observedMiss = false;
    while (!observedMiss) {
      const node = fixture.database.pendingNodeRuns("run")[0]!;
      if (node.role === "work") {
        fixture.database.applyNodeOutcome("run", node.nodeRunId, workPass());
        continue;
      }
      const graphNode = fixture.config.graph.graphNodes.find(({ id }) => id === node.graphNodeId)!;
      const isLast = graphNode.actionNodes.at(-1)!.id === node.actionNodeId;
      if (node.graphNodeId === "design") {
        fixture.database.applyNodeOutcome("run", node.nodeRunId,
          validation("PASS", "design-valid", isLast ? ["design-accepted"] : []));
        continue;
      }
      expect(node.graphNodeId).toBe("plan");
      if (!isLast) {
        fixture.database.applyNodeOutcome("run", node.nodeRunId, validation("PASS", "plan-valid", []));
        continue;
      }
      fixture.database.applyNodeOutcome("run", node.nodeRunId, validation("FAIL", "invalid-design", []));
      observedMiss = true;
    }
    const observation = fixture.database.readRootOrchestration("run").policyObservations.at(-1)!;
    expect(observation.modelMatch).toBe("state_miss");
    const model = fixture.config.graph.strategy.model;
    const capability = fixture.config.graph.strategy.capabilityModel;
    const current = model.states.find(({ id }) => id === observation.stateBefore.stateId)!;
    const actual = model.states.find(({ id }) => id === observation.actualState!.stateId)!;
    const row = model.stateActions.find(({ stateId, actionId }) =>
      stateId === current.id && actionId === observation.actionId)!;
    const expected = model.states.find(({ id }) => id === row.successors.find(({ outcomeId }) =>
      outcomeId === observation.observedOutcomeId)!.nextStateId)!;
    const factual = rewardBreakdown(model, capability, current, actual, observation.observedOutcomeId);
    const authored = rewardBreakdown(model, capability, current, expected, observation.observedOutcomeId);
    expect(factual.verifiedProgressDeltaPpm).toBe(0);
    expect(observation.realizedRewardMicros).toBe(factual.netRewardMicros);
    expect(observation.realizedRewardMicros).not.toBe(authored.netRewardMicros);
    fixture.database.close();
  });

  it("blocks before dispatch when the hard Graph Node transition limit is exhausted", async () => {
    const fixture = await runtime("graph", undefined, false);
    fixture.database.connection().prepare(
      "UPDATE root_runs SET transition_count = ? WHERE root_run_id = 'run'"
    ).run(maxControlFlowTransitions);
    fixture.database.initializeRoot("run");
    expect(fixture.status()).toBe("blocked");
    expect(fixture.database.listRootGraphNodeInvocations("run")).toEqual([]);
    expect(fixture.database.listControlFlowEvents("run").map(({ kind }) => kind))
      .toEqual(["policy_decided", "root_terminal"]);
    fixture.database.close();
  });

  it("assigns zero Q and dispatches nothing when runtime authorization excludes the compiled action", async () => {
    const fixture = await runtime("graph", undefined, false);
    const stored = fixture.database.connection().prepare(
      "SELECT execution_snapshot_json FROM root_runs WHERE root_run_id = 'run'"
    ).pluck().get() as string;
    const snapshot = JSON.parse(stored) as RootExecutionSnapshot;
    snapshot.graph.strategy.model.features.push({
      id: "external-write-authorized",
      domain: ["false", "true"],
      missingValue: "false",
      source: { kind: "authorization", pointer: "/externalWritesAuthorized" }
    });
    snapshot.graph.strategy.model.states.forEach((state) => {
      state.values["external-write-authorized"] = "false";
    });
    snapshot.graph.strategy.capabilityModel.actions.find(({ actionId }) => actionId === "design")!.guards.push({
      featureId: "external-write-authorized",
      allowedValues: ["true"]
    });
    fixture.database.connection().prepare(
      "UPDATE root_runs SET execution_snapshot_json = ? WHERE root_run_id = 'run'"
    ).run(JSON.stringify(snapshot));
    fixture.database.initializeRoot("run");
    expect(fixture.status()).toBe("blocked");
    expect(fixture.database.listRootGraphNodeInvocations("run")).toEqual([]);
    const decision = fixture.database.readRootOrchestration("run").policyDecisions[0]!;
    expect(decision.excludedActions).toContainEqual({ actionId: "design", reasonCode: "authorization_denied" });
    expect(decision.actionValues).toContainEqual({ actionId: "design", qMicros: 0 });
    fixture.database.close();
  });
});

const runtime = async (kind: "graph" | "graph_node", graphNodeId?: string, initialize = true) => {
  const config = projectConfigSchema.parse(JSON.parse(await readFile(".ballet/project.json", "utf8")));
  const directory = await mkdtemp(path.join(os.tmpdir(), "ballet-reward-runtime-"));
  roots.push(directory);
  const database = new RuntimeDatabase(path.join(directory, "state.sqlite"));
  const snapshot = snapshotFor(config, kind, graphNodeId);
  const runs = new RootRunStore(() => database.connection());
  runs.create({
    rootRunId: "run",
    kind,
    targetId: kind === "graph" ? config.graph.id : graphNodeId!,
    worktreePath: directory,
    branch: "test",
    headSha: "head",
    configHash: "config",
    snapshotHash: "snapshot",
    executionSnapshot: snapshot,
    createdAt: "2026-08-23T00:00:00.000Z"
  });
  if (initialize) database.initializeRoot("run");
  return {
    config,
    database,
    status: () => String(database.connection().prepare(
      "SELECT status FROM root_runs WHERE root_run_id = 'run'"
    ).pluck().get())
  };
};

const snapshotFor = (
  config: ReturnType<typeof projectConfigSchema.parse>,
  rootKind: "graph" | "graph_node",
  graphNodeId?: string
): RootExecutionSnapshot => {
  const strategy = config.graph.strategy;
  const modelSha256 = decisionModelSha256(strategy.model);
  const admissibleActionsByState = Object.fromEntries(strategy.model.states.map((state) => [
    state.id,
    state.terminal ? [] : strategy.model.stateActions.filter(({ stateId }) => stateId === state.id)
      .map(({ actionId }) => actionId)
  ]));
  const compiledPolicy = compileRewardPolicy({
    model: strategy.model,
    capabilityModel: strategy.capabilityModel,
    admissibleActionsByState,
    modelSha256
  });
  expect(compiledPolicy.status).toBe("compiled");
  const entries = strategy.model.acceptance.obligations.map(({ obligationId, weight }) => ({
    obligationId, weight, status: "pending" as const, evidenceRefs: []
  })).sort((left, right) => left.obligationId.localeCompare(right.obligationId));
  const authorizationFacts = { localExecutionAuthorized: true, externalWritesAuthorized: false };
  return {
    version: 11,
    policyObservationContractVersion: 4,
    rootKind,
    ...(rootKind === "graph_node" ? { rootGraphNodeId: graphNodeId } : {}),
    project: { checkoutRoot: "/tmp", headSha: "head", configHash: "config", snapshotHash: "snapshot" },
    issueTracker: config.issueTracker,
    graph: config.graph,
    decisionModel: {
      strategyKind: "reward_mdp_v3",
      modelVersion: 3,
      modelSha256,
      capabilityModelSha256: capabilityModelSha256(strategy.capabilityModel)
    },
    theme: structuredClone(defaultCanvasTheme),
    executionProfiles: config.executionProfiles,
    runtimes: [],
    resources: [],
    authorization: { version: 1, facts: authorizationFacts, sha256: jsonSha256(authorizationFacts) },
    acceptanceLedger: { version: 1, entries, sha256: jsonSha256(entries) },
    compiledPolicy,
    createdAt: "2026-08-23T00:00:00.000Z"
  };
};

const workPass = (): WorkNodeOutcome => ({
  role: "work",
  state: "completed",
  summary: "Work completed.",
  checks: [],
  artifacts: {}
});

const validation = (
  decision: "PASS" | "FAIL",
  outcomeId: string,
  verifyObligationIds: string[],
  invalidateObligationIds: string[] = [],
  disposition?: "retry" | "escalate"
): ValidationNodeOutcome => ({
  role: "validation",
  state: "completed",
  summary: `${outcomeId}.`,
  checks: [],
  decision,
  outcomeId,
  ...(decision === "FAIL" ? { disposition: disposition ?? "escalate" } : {}),
  evidence: { outcomeId },
  acceptance: {
    verifyObligationIds,
    invalidateObligationIds,
    evidenceRefs: [...verifyObligationIds, ...invalidateObligationIds].map((id) => `test:${id}`)
  }
});
