import { readFile, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { projectConfigSchema } from "../../shared/api/workspace-schemas.js";
import { defaultCanvasTheme } from "../../shared/domain/canvasTheme.js";
import { maxControlFlowTransitions } from "../../shared/domain/runtime.js";
import type { RootExecutionSnapshot, ValidationNodeOutcome, WorkNodeOutcome } from "../../shared/domain/runtime.js";
import type { CompiledRewardPolicyV4 } from "../../shared/domain/decisionModel.js";
import { compilePolicyScope, describePolicyScope, policyGuardContext, scopedDecisionModelSha256 } from "../policy/PolicyScope.js";
import { RootRunStore } from "../runs/RootRunStore.js";
import { RuntimeDatabase } from "../runtime-db.js";
import { jsonSha256 } from "./state/CanonicalJson.js";

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

describe("hierarchical Reward-MDP runtime", () => {
  it("runs global → local → Action → local → global through all default scopes", async () => {
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
      if (node!.role === "work") fixture.database.applyNodeOutcome("run", node!.nodeRunId, workPass());
      else {
        const graphNode = fixture.config.graph.graphNodes.find(({ id }) => id === node!.graphNodeId)!;
        const isLast = graphNode.actionNodes.at(-1)!.id === node!.actionNodeId;
        const [outcomeId, obligationId] = successfulOutcome[node!.graphNodeId as keyof typeof successfulOutcome];
        fixture.database.applyNodeOutcome("run", node!.nodeRunId, validation(
          "PASS", outcomeId, isLast ? [obligationId] : []
        ));
      }
    }
    expect(fixture.status()).toBe("completed");
    const invocations = fixture.database.listRootGraphNodeInvocations("run");
    expect(invocations.map(({ graphNodeId }) => graphNodeId)).toEqual(["design", "plan", "build", "deploy", "verify"]);
    expect(invocations.flatMap(({ actionNodeInvocations }) => actionNodeInvocations)).toHaveLength(17);
    const orchestration = fixture.database.readRootOrchestration("run");
    expect(orchestration.policyObservations.filter(({ scope }) => scope === "graph")).toHaveLength(5);
    expect(orchestration.policyObservations.filter(({ scope }) => scope === "graph_node")).toHaveLength(17);
    expect(orchestration.acceptanceLedger.entries.every(({ status }) => status === "verified")).toBe(true);
    expect(orchestration.policyDecisions.at(-1)).toMatchObject({ scope: "graph_node", selectedActionId: "verify-release" });
    fixture.database.close();
  });

  it("uses bounded Action retry before returning the observed outcome to the local policy", async () => {
    const fixture = await runtime("graph_node", "build");
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const work = fixture.database.pendingNodeRuns("run")[0]!;
      expect(work).toMatchObject({ role: "work", attempt });
      fixture.database.applyNodeOutcome("run", work.nodeRunId, workPass());
      const validationNode = fixture.database.pendingNodeRuns("run")[0]!;
      fixture.database.applyNodeOutcome("run", validationNode.nodeRunId, validation(
        "FAIL", "implementation-defect", [], [], "retry"
      ));
    }
    expect(fixture.status()).toBe("running");
    const nextWork = fixture.database.pendingNodeRuns("run")[0]!;
    expect(nextWork).toMatchObject({ role: "work", attempt: 1 });
    expect(fixture.database.readRootOrchestration("run").policyObservations).toHaveLength(1);
    fixture.database.applyNodeOutcome("run", nextWork.nodeRunId, workPass());
    const finalValidation = fixture.database.pendingNodeRuns("run")[0]!;
    fixture.database.applyNodeOutcome("run", finalValidation.nodeRunId, validation(
      "PASS", "build-success", ["build-verified"]
    ));
    expect(fixture.status()).toBe("completed");
    fixture.database.close();
  });

  it("lets Escalate reach the parent only through an authored local terminal branch", async () => {
    const fixture = await runtime("graph_node", "build");
    const work = fixture.database.pendingNodeRuns("run")[0]!;
    fixture.database.applyNodeOutcome("run", work.nodeRunId, workPass());
    const check = fixture.database.pendingNodeRuns("run")[0]!;
    fixture.database.applyNodeOutcome("run", check.nodeRunId, validation(
      "FAIL", "invalid-plan", [], ["plan-accepted"], "escalate"
    ));
    expect(fixture.status()).toBe("failed");
    expect(fixture.database.readRootOrchestration("run").policyObservations[0]).toMatchObject({
      scope: "graph_node", terminal: "failure", emittedOutcomeId: "invalid-plan"
    });
    fixture.database.close();
  });

  it("pauses in needs_input when terminal Validation ledger effects do not match exactly", async () => {
    const fixture = await runtime("graph_node", "plan");
    const work = fixture.database.pendingNodeRuns("run")[0]!;
    fixture.database.applyNodeOutcome("run", work.nodeRunId, workPass());
    const check = fixture.database.pendingNodeRuns("run")[0]!;
    fixture.database.applyNodeOutcome("run", check.nodeRunId, validation(
      "PASS", "plan-valid", ["plan-accepted"]
    ));
    expect(fixture.status()).toBe("waiting_for_input");
    expect(fixture.database.readRootOrchestration("run").policyObservations).toHaveLength(0);
    expect(fixture.database.listControlFlowEvents("run").at(-1)?.kind).toBe("acceptance_mismatch");
    fixture.database.applyNodeOutcome("run", check.nodeRunId, validation("PASS", "plan-valid", []));
    expect(fixture.status()).toBe("running");
    expect(fixture.database.pendingNodeRuns("run")[0]).toMatchObject({ actionNodeId: "plan-materialize-work", role: "work" });
    fixture.database.close();
  });
});

describe("hierarchical Reward-MDP runtime safeguards", () => {
  it("rejects an outcome outside the selected local policy cell without persisting progress", async () => {
    const fixture = await runtime("graph_node", "plan");
    const work = fixture.database.pendingNodeRuns("run")[0]!;
    fixture.database.applyNodeOutcome("run", work.nodeRunId, workPass());
    const check = fixture.database.pendingNodeRuns("run")[0]!;
    expect(() => fixture.database.applyNodeOutcome("run", check.nodeRunId, validation(
      "FAIL", "not-authored", [], [], "escalate"
    ))).toThrow("semantic enum");
    expect(fixture.database.readRootOrchestration("run").policyObservations).toHaveLength(0);
    fixture.database.close();
  });

  it("counts both global and local policy decisions against one 256-transition bound", async () => {
    const fixture = await runtime("graph", undefined, false);
    fixture.database.connection().prepare(
      "UPDATE root_runs SET transition_count = ? WHERE root_run_id = 'run'"
    ).run(maxControlFlowTransitions);
    fixture.database.initializeRoot("run");
    expect(fixture.status()).toBe("blocked");
    expect(fixture.database.listRootGraphNodeInvocations("run")).toEqual([]);
    expect(fixture.database.listControlFlowEvents("run").map(({ kind }) => kind)).toEqual(["root_terminal"]);
    fixture.database.close();
  });

  it("rechecks authorization before dispatching a compiled action", async () => {
    const fixture = await runtime("graph", undefined, false);
    const stored = fixture.database.connection().prepare(
      "SELECT execution_snapshot_json FROM root_runs WHERE root_run_id = 'run'"
    ).pluck().get() as string;
    const snapshot = JSON.parse(stored) as RootExecutionSnapshot;
    snapshot.graph.strategy.model.stateActions.find(({ stateId, actionId }) =>
      stateId === "design" && actionId === "design")!.guards.push({
      source: { kind: "authorization", pointer: "/externalWritesAuthorized" },
      allowedValues: [true]
    });
    fixture.database.connection().prepare(
      "UPDATE root_runs SET execution_snapshot_json = ? WHERE root_run_id = 'run'"
    ).run(JSON.stringify(snapshot));
    fixture.database.initializeRoot("run");
    expect(fixture.status()).toBe("blocked");
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
  const entries = config.graph.acceptance.obligations.map(({ obligationId, weight }) => ({
    obligationId, weight, status: "pending" as const, evidenceRefs: []
  })).sort((left, right) => left.obligationId.localeCompare(right.obligationId));
  const authorizationFacts = { localExecutionAuthorized: true, externalWritesAuthorized: false };
  const authorization = { version: 1 as const, facts: authorizationFacts, sha256: jsonSha256(authorizationFacts) };
  const acceptanceLedger = { version: 1 as const, entries, sha256: jsonSha256(entries) };
  const context = policyGuardContext({
    graphState: config.graph.state.initial, stateRevision: 0, authorization, acceptanceLedger
  });
  const localIds = rootKind === "graph" ? config.graph.graphNodes.map(({ id }) => id) : [graphNodeId!];
  const graphNodePolicies: Record<string, CompiledRewardPolicyV4> = {};
  for (const id of localIds) {
    const policy = compilePolicyScope(config.graph, "graph_node", context, id);
    expect(policy.status).toBe("compiled");
    graphNodePolicies[id] = policy;
  }
  const global = rootKind === "graph" ? compilePolicyScope(config.graph, "graph", context) : undefined;
  expect(global?.status ?? "compiled").toBe("compiled");
  return {
    version: 12,
    policyObservationContractVersion: 5,
    rootKind,
    ...(rootKind === "graph_node" ? { rootGraphNodeId: graphNodeId } : {}),
    project: { checkoutRoot: "/tmp", headSha: "head", configHash: "config", snapshotHash: "snapshot" },
    issueTracker: config.issueTracker,
    graph: config.graph,
    decisionModels: {
      ...(global ? { global: {
        strategyKind: "reward_mdp_v4" as const,
        modelVersion: 4 as const,
        modelSha256: scopedDecisionModelSha256(describePolicyScope(config.graph, "graph"))
      } } : {}),
      graphNodes: Object.fromEntries(localIds.map((id) => [id, {
        strategyKind: "reward_mdp_v4" as const,
        modelVersion: 4 as const,
        modelSha256: scopedDecisionModelSha256(describePolicyScope(config.graph, "graph_node", id))
      }]))
    },
    theme: structuredClone(defaultCanvasTheme),
    executionProfiles: config.executionProfiles,
    runtimes: [],
    resources: [],
    authorization,
    acceptanceLedger,
    compiledPolicies: { ...(global ? { global } : {}), graphNodes: graphNodePolicies },
    createdAt: "2026-08-23T00:00:00.000Z"
  };
};

const workPass = (): WorkNodeOutcome => ({
  role: "work", state: "completed", summary: "Work completed.", checks: [], artifacts: {}
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
