import { describe, expect, it } from "vitest";
import type { ProjectLoop, ProjectLoopEdge } from "../../shared/domain/automation.js";
import { RuntimeDatabase } from "../runtime-db.js";
import { RootRunExecutionCoordinator } from "../runs/RootRunExecutionCoordinator.js";
import { RootRunStore } from "../runs/RootRunStore.js";
import { testJobPair, testLoop } from "../tests/v12TestConfig.js";
import {
  activeNode, completeActiveLoop, createOrchestrationHarness, requestExternalRepair
} from "./LoopOrchestrator.test-support.js";

const flowLoop = (id: string): ProjectLoop => testLoop(id, testJobPair(`${id}-job`));

const flowEdge = (source: string, target: string, id = `${source}-${target}`): ProjectLoopEdge => ({
  id, source, target, kind: "flow", capability: "test:loop.transfer", description: `Flow to ${target}.`
});

describe("LoopOrchestrator normal-flow dispatch", () => {
  it("finishes the top-level Loop without an Orchestration Request when there are zero flow candidates", async () => {
    const harness = await createOrchestrationHarness({ targets: [], edges: [] });
    const { runtime } = harness;
    runtime.startLoopRun("root-run");
    completeActiveLoop(runtime);

    expect(runtime.listRootLoopRuns("root-run")).toEqual([
      expect.objectContaining({ loopId: "caller-loop", source: "manual", status: "completed" })
    ]);
    expect(runtime.orchestration.list("root-run")).toEqual([]);
    expect(rootActiveNode(runtime)).toBeNull();
    await syncRoot(runtime);
    expect(new RootRunStore(() => runtime.connection()).require("root-run")).toMatchObject({ status: "completed" });
    runtime.close();
    await harness.close();
  });

  it("persists one-candidate flow and waits for the Orchestrator instead of dispatching directly", async () => {
    const next = flowLoop("next-loop");
    const harness = await createOrchestrationHarness({
      targets: [next], edges: [flowEdge("caller-loop", next.id)]
    });
    const { runtime } = harness;
    runtime.startLoopRun("root-run");
    completeActiveLoop(runtime);

    const orchestrator = activeNode(runtime);
    const request = runtime.orchestration.forOrchestrator(orchestrator.nodeRunId)!;
    expect(orchestrator).toMatchObject({ role: "orchestrator", loopId: "caller-loop", status: "queued" });
    expect(request).toMatchObject({ kind: "flow", sourceLoopId: "caller-loop", status: "pending" });
    expect(runtime.listRootLoopRuns("root-run")).toHaveLength(1);

    runtime.applyNodeOutcome("root-run", orchestrator.nodeRunId, {
      role: "orchestrator", state: "completed", targetLoopId: next.id,
      routeReason: "The sole candidate accepts the flow capability.",
      dispatchInput: { handoff: "bounded" }, expectedOutcome: { ready: true }
    });
    const runs = runtime.listRootLoopRuns("root-run");
    expect(runs).toHaveLength(2);
    expect(runs[1]).toMatchObject({
      loopId: next.id, source: "flow", orchestrationRequestId: request.orchestrationRequestId,
      input: { handoff: "bounded" }, nestingDepth: 0
    });
    expect(runs[1]?.orchestrationFrameId).toBeUndefined();
    expect(runtime.orchestration.require(request.orchestrationRequestId)).toMatchObject({
      status: "dispatched", targetLoopRunId: runs[1]?.loopRunId
    });
    expect(runtime.orchestration.routeForRequest(request.orchestrationRequestId)).toMatchObject({
      kind: "flow", sourceLoopId: "caller-loop", targetLoopId: next.id,
      evidence: {
        routeReason: "The sole candidate accepts the flow capability.", expectedOutcome: { ready: true }
      }
    });
    expect(runtime.repair.listFrames("root-run")).toEqual([]);
    runtime.close();
    await harness.close();
  });

  it("selects exactly one target when several flow candidates are allowlisted", async () => {
    const alpha = flowLoop("alpha-loop");
    const beta = flowLoop("beta-loop");
    const harness = await createOrchestrationHarness({
      targets: [alpha, beta],
      edges: [flowEdge("caller-loop", alpha.id), flowEdge("caller-loop", beta.id)]
    });
    const { runtime } = harness;
    runtime.startLoopRun("root-run");
    completeActiveLoop(runtime);
    const orchestrator = activeNode(runtime);
    runtime.applyNodeOutcome("root-run", orchestrator.nodeRunId, {
      role: "orchestrator", state: "completed", targetLoopId: beta.id,
      routeReason: "Beta matches the bounded expected outcome.", dispatchInput: {}, expectedOutcome: {}
    });

    expect(runtime.listRootLoopRuns("root-run").map(({ loopId }) => loopId))
      .toEqual(["caller-loop", "beta-loop"]);
    expect(runtime.orchestration.listRoutes("root-run")).toEqual([
      expect.objectContaining({ targetLoopId: "beta-loop", kind: "flow" })
    ]);
    runtime.close();
    await harness.close();
  });

  it("persists ambiguity as needs_input without choosing a target or fallback", async () => {
    const alpha = flowLoop("alpha-loop");
    const beta = flowLoop("beta-loop");
    const harness = await createOrchestrationHarness({
      targets: [alpha, beta],
      edges: [flowEdge("caller-loop", alpha.id), flowEdge("caller-loop", beta.id)]
    });
    const { runtime } = harness;
    runtime.startLoopRun("root-run");
    completeActiveLoop(runtime);
    const orchestrator = activeNode(runtime);
    const request = runtime.orchestration.forOrchestrator(orchestrator.nodeRunId)!;
    runtime.applyNodeOutcome("root-run", orchestrator.nodeRunId, {
      role: "orchestrator", state: "needs_input", summary: "Both candidates are equally valid.",
      question: "Which target Loop should receive the flow?", context: "alpha-loop or beta-loop"
    });

    expect(runtime.getNodeRun(orchestrator.nodeRunId)).toMatchObject({ status: "waiting_for_input" });
    expect(runtime.orchestration.require(request.orchestrationRequestId)).toMatchObject({
      status: "waiting_for_input", routedTargetLoopId: undefined
    });
    expect(runtime.orchestration.listRoutes("root-run")).toEqual([]);
    expect(runtime.listRootLoopRuns("root-run")).toHaveLength(1);
    runtime.close();
    await harness.close();
  });
});

describe("LoopOrchestrator flow boundaries and recovery", () => {
  it("rejects a selected target outside the source flow allowlist", async () => {
    const allowed = flowLoop("allowed-loop");
    const outside = flowLoop("outside-loop");
    const harness = await createOrchestrationHarness({
      targets: [allowed, outside],
      edges: [flowEdge("caller-loop", allowed.id), flowEdge(allowed.id, outside.id)]
    });
    const { runtime } = harness;
    runtime.startLoopRun("root-run");
    completeActiveLoop(runtime);
    const orchestrator = activeNode(runtime);
    const request = runtime.orchestration.forOrchestrator(orchestrator.nodeRunId)!;
    runtime.applyNodeOutcome("root-run", orchestrator.nodeRunId, {
      role: "orchestrator", state: "completed", targetLoopId: outside.id,
      routeReason: "Outside the source allowlist.", dispatchInput: {}, expectedOutcome: {}
    });

    expect(runtime.orchestration.require(request.orchestrationRequestId)).toMatchObject({ status: "failed" });
    expect(runtime.orchestration.listRoutes("root-run")).toEqual([]);
    expect(runtime.listRootLoopRuns("root-run")).toHaveLength(1);
    runtime.close();
    await harness.close();
  });

  it("fails closed for a target connected only by the wrong edge kind", async () => {
    const selectedId = "wrong-kind-loop";
    const selectedKind = "repair" as const;
    const allowed = flowLoop("allowed-loop");
    const selected = flowLoop(selectedId);
    const edges: ProjectLoopEdge[] = [
      flowEdge("caller-loop", allowed.id, "allowed-flow"),
      {
        id: "invalid-selection", source: "caller-loop", target: selected.id, kind: selectedKind,
        capability: "test:loop.transfer", description: "Must not be selected."
      }
    ];
    const harness = await createOrchestrationHarness({ targets: [allowed, selected], edges });
    const { runtime } = harness;
    runtime.startLoopRun("root-run");
    completeActiveLoop(runtime);
    const orchestrator = activeNode(runtime);
    const request = runtime.orchestration.forOrchestrator(orchestrator.nodeRunId)!;
    runtime.applyNodeOutcome("root-run", orchestrator.nodeRunId, {
      role: "orchestrator", state: "completed", targetLoopId: selected.id,
      routeReason: "Invalid selection.", dispatchInput: {}, expectedOutcome: {}
    });

    expect(runtime.orchestration.require(request.orchestrationRequestId)).toMatchObject({ status: "failed" });
    expect(runtime.orchestration.listRoutes("root-run")).toEqual([]);
    expect(runtime.listRootLoopRuns("root-run")).toHaveLength(1);
    expect(rootError(runtime)).toContain("not an unambiguous allowed flow target");
    runtime.close();
    await harness.close();
  });

  it("rejects a flow capability mismatch before the immutable Root snapshot is persisted", async () => {
    const allowed = flowLoop("allowed-loop");
    const incompatible = flowLoop("incompatible-loop");
    incompatible.capabilities.accepts = [];
    await expect(createOrchestrationHarness({
      targets: [allowed, incompatible],
      edges: [
        flowEdge("caller-loop", allowed.id, "allowed-flow"),
        flowEdge("caller-loop", incompatible.id, "incompatible-flow")
      ]
    })).rejects.toThrow(/is not accepted by target Loop incompatible-loop/);
  });

  it("keeps orchestration evidence immutable and dispatch idempotent across restart", async () => {
    const next = flowLoop("next-loop");
    const harness = await createOrchestrationHarness({
      targets: [next], edges: [flowEdge("caller-loop", next.id)]
    });
    let runtime = harness.runtime;
    runtime.startLoopRun("root-run");
    completeActiveLoop(runtime);
    const orchestrator = activeNode(runtime);
    const request = runtime.orchestration.forOrchestrator(orchestrator.nodeRunId)!;
    expect(() => runtime.connection().prepare(`
      UPDATE orchestration_requests SET source_loop_id = 'forged-source'
      WHERE orchestration_request_id = ?
    `).run(request.orchestrationRequestId)).toThrow(/identity and evidence are immutable/);
    runtime.close();

    runtime = new RuntimeDatabase(harness.filename);
    expect(runtime.orchestration.require(request.orchestrationRequestId)).toMatchObject({ status: "pending" });
    runtime.applyNodeOutcome("root-run", orchestrator.nodeRunId, {
      role: "orchestrator", state: "completed", targetLoopId: next.id,
      routeReason: "Persist once.", dispatchInput: {}, expectedOutcome: {}
    });
    runtime.close();

    runtime = new RuntimeDatabase(harness.filename);
    expect(runtime.orchestration.list("root-run")).toEqual([
      expect.objectContaining({ orchestrationRequestId: request.orchestrationRequestId, status: "dispatched" })
    ]);
    expect(runtime.orchestration.listRoutes("root-run")).toHaveLength(1);
    expect(runtime.listRootLoopRuns("root-run").filter(({ source }) => source === "flow")).toHaveLength(1);
    runtime.close();
    await harness.close();
  });
});

describe("LoopOrchestrator permission requests", () => {
  it("waits for authorized human input when no permission-capable target exists without mutating permission State", async () => {
    const harness = await createOrchestrationHarness({
      initial: { permissionGranted: false }, targets: [], edges: []
    });
    const { runtime } = harness;
    runtime.startLoopRun("root-run");
    const { orchestrator, orchestrationRequest } = requestExternalRepair(runtime, {
      requestedCapability: "permission:external.write"
    });
    runtime.applyNodeOutcome("root-run", orchestrator.nodeRunId, {
      role: "orchestrator", state: "needs_input", summary: "No authorized target exists.",
      question: "Authorize an external write target?", context: "No permission mutation was performed."
    });

    expect(runtime.orchestration.require(orchestrationRequest.orchestrationRequestId))
      .toMatchObject({ status: "waiting_for_input", requestedCapability: "permission:external.write" });
    expect(runtime.state.current("root-run")).toMatchObject({
      revision: 0, state: { permissionGranted: false }
    });
    expect(runtime.orchestration.listRoutes("root-run")).toEqual([]);
    expect(runtime.repair.listFrames("root-run")).toEqual([]);
    expect(runtime.listRootLoopRuns("root-run")).toHaveLength(1);
    runtime.close();
    await harness.close();
  });
});

describe("LoopOrchestrator bounded dispatch", () => {
  it("rejects oversized dispatch input before route or target persistence", async () => {
    const next = flowLoop("next-loop");
    const harness = await createOrchestrationHarness({
      targets: [next], edges: [flowEdge("caller-loop", next.id)]
    });
    const { runtime } = harness;
    runtime.startLoopRun("root-run");
    completeActiveLoop(runtime);
    const orchestrator = activeNode(runtime);
    expect(() => runtime.applyNodeOutcome("root-run", orchestrator.nodeRunId, {
      role: "orchestrator", state: "completed", targetLoopId: next.id,
      routeReason: "Oversized input.", dispatchInput: "x".repeat(65_537), expectedOutcome: {}
    })).toThrow(/dispatch input.*maximum is 65536 bytes/i);
    expect(runtime.orchestration.listRoutes("root-run")).toEqual([]);
    expect(runtime.listRootLoopRuns("root-run")).toHaveLength(1);
    runtime.close();
    await harness.close();
  });
});

const rootActiveNode = (runtime: RuntimeDatabase): unknown => runtime.connection().prepare(`
  SELECT active_node_run_id FROM root_runs WHERE root_run_id = 'root-run'
`).pluck().get();

const rootError = (runtime: RuntimeDatabase): string => {
  const value = runtime.connection().prepare(`
    SELECT error_message FROM root_runs WHERE root_run_id = 'root-run'
  `).pluck().get();
  return typeof value === "string" ? value : "";
};

const syncRoot = async (runtime: RuntimeDatabase): Promise<void> => {
  const roots = new RootRunStore(() => runtime.connection());
  const coordinator = new RootRunExecutionCoordinator({
    connection: () => runtime.connection(), database: runtime, roots,
    executions: { listByRoot: () => [] } as never,
    queue: {} as never,
    finalizer: { finalize: async (rootRunId: string, status: "completed") =>
      roots.setStatus(rootRunId, status) } as never,
    workspaces: {} as never
  });
  await coordinator.sync("root-run");
};
