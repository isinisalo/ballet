import { describe, expect, it } from "vitest";
import { RuntimeDatabase } from "../runtime-db.js";
import { testLoop, testWorkLoopNode } from "../tests/v11TestConfig.js";
import {
  activeNode, completeActiveLoop, createOrchestrationHarness,
  requestExternalRepair, routeRepair, validationOk
} from "./LoopOrchestrator.test-support.js";

describe("LoopOrchestrator nesting and limits", () => {
  it("returns nested repairs in LIFO order", async () => {
    const repairA = testLoop("repair-a", testWorkLoopNode("repair-a-work"));
    const repairB = testLoop("repair-b", testWorkLoopNode("repair-b-work"));
    const harness = await createOrchestrationHarness({ targets: [repairA, repairB], edges: [
      { id: "caller-a", source: "caller-loop", target: "repair-a", kind: "repair", capability: "test:loop.transfer", description: "Caller to A." },
      { id: "a-b", source: "repair-a", target: "repair-b", kind: "repair", capability: "test:loop.transfer", description: "A to B." }
    ] });
    const { runtime } = harness;
    runtime.startLoopRun("root-run");
    const outerRequest = requestExternalRepair(runtime);
    const repairARun = routeRepair(runtime, outerRequest.orchestrator, "repair-a");
    const innerRequest = requestExternalRepair(runtime, { requestedCapability: "test:loop.transfer" });
    const repairBRun = routeRepair(runtime, innerRequest.orchestrator, "repair-b");

    expect(runtime.readRootRuntime("root-run").repair).toMatchObject({
      pendingRepair: { repairRequestId: innerRequest.request.repairRequestId, nestingDepth: 2 },
      routedTarget: { targetLoopId: "repair-b" },
      returnDestination: {
        loopId: "repair-a", workLoopNodeId: "repair-a-work",
        validationNodeDefinitionId: "repair-a:repair-a-work:validation"
      },
      activeContinuationChain: [
        { repairRequestId: outerRequest.request.repairRequestId, nestingDepth: 1 },
        { repairRequestId: innerRequest.request.repairRequestId, nestingDepth: 2 }
      ]
    });

    completeActiveLoop(runtime);
    const returnedToA = activeNode(runtime);
    expect(returnedToA).toMatchObject({ role: "validation", loopRunId: repairARun.loopRunId, loopId: "repair-a" });
    expect(runtime.repair.openFrames("root-run")).toEqual([
      expect.objectContaining({ calleeLoopRunId: repairARun.loopRunId, status: "open" })
    ]);
    runtime.applyNodeOutcome("root-run", returnedToA.nodeRunId, validationOk("Nested repair accepted."));
    const returnedToCaller = activeNode(runtime);
    expect(returnedToCaller).toMatchObject({
      role: "validation", loopId: "caller-loop", workLoopNodeRunId: outerRequest.validation.workLoopNodeRunId
    });
    expect(runtime.listRepairResults("root-run").map(({ targetLoopRunId }) => targetLoopRunId))
      .toEqual([repairBRun.loopRunId, repairARun.loopRunId]);
    expect(runtime.connection().prepare(`
      SELECT status FROM orchestration_frames ORDER BY nesting_depth DESC
    `).pluck().all()).toEqual(["returned", "returned"]);
    expect(runtime.listControlFlowEvents("root-run").filter(({ kind }) => kind === "repair_return")
      .map(({ targetLoopRunId }) => targetLoopRunId)).toEqual([repairARun.loopRunId, outerRequest.work.loopRunId]);
    runtime.close();
    await harness.close();
  });

  it("blocks a nested request at the snapshotted repair depth limit", async () => {
    const harness = await createOrchestrationHarness({ maxRepairDepth: 1 });
    const { runtime } = harness;
    runtime.startLoopRun("root-run");
    const outer = requestExternalRepair(runtime);
    routeRepair(runtime, outer.orchestrator, "repair-a");
    const work = activeNode(runtime);
    runtime.applyNodeOutcome("root-run", work.nodeRunId, {
      role: "work", state: "completed", summary: "Repair A work.", artifacts: {}, checks: []
    });
    const validation = activeNode(runtime);
    runtime.applyNodeOutcome("root-run", validation.nodeRunId, externalFailure("Nested repair requested."));

    expect(runtime.connection().prepare("SELECT COUNT(*) FROM repair_requests").pluck().get()).toBe(1);
    expect(runtime.getRepairRequest(outer.request.repairRequestId)).toMatchObject({ status: "failed" });
    expect(runtime.listRepairResults("root-run")).toEqual([
      expect.objectContaining({ targetLoopId: "repair-a", status: "blocked" })
    ]);
    expect(rootError(runtime)).toContain("exceeds limit 1");
    runtime.close();
    await harness.close();
  });

  it("blocks a repeated external repair at the per-composite attempt limit", async () => {
    const harness = await createOrchestrationHarness({ maxRepairAttempts: 1 });
    const { runtime } = harness;
    runtime.startLoopRun("root-run");
    const first = requestExternalRepair(runtime);
    routeRepair(runtime, first.orchestrator, "repair-a");
    completeActiveLoop(runtime);
    const returned = activeNode(runtime);
    runtime.applyNodeOutcome("root-run", returned.nodeRunId, externalFailure("Repair was insufficient."));

    expect(runtime.connection().prepare("SELECT COUNT(*) FROM repair_requests").pluck().get()).toBe(1);
    expect(runtime.listRootLoopRuns("root-run")[0]).toMatchObject({ status: "blocked" });
    expect(rootError(runtime)).toContain("exceeded 1 external repair attempts");
    runtime.close();
    await harness.close();
  });

  it("creates a traceable second request when caller Validation fails again within the limit", async () => {
    const harness = await createOrchestrationHarness({ maxRepairAttempts: 2 });
    const { runtime } = harness;
    runtime.startLoopRun("root-run");
    const first = requestExternalRepair(runtime);
    routeRepair(runtime, first.orchestrator, "repair-a");
    completeActiveLoop(runtime);
    const returned = activeNode(runtime);
    runtime.applyNodeOutcome("root-run", returned.nodeRunId, externalFailure("A second repair is required."));

    expect(activeNode(runtime)).toMatchObject({ role: "orchestrator", status: "queued" });
    expect(runtime.connection().prepare(`
      SELECT attempt, status FROM repair_requests ORDER BY attempt
    `).all()).toEqual([{ attempt: 1, status: "repaired" }, { attempt: 2, status: "pending" }]);
    runtime.close();
    await harness.close();
  });
});

describe("LoopOrchestrator input, recovery, and cancellation", () => {
  it("resumes a needs_input Orchestrator for the same Repair Request without changing State", async () => {
    const harness = await createOrchestrationHarness();
    const { runtime } = harness;
    runtime.startLoopRun("root-run");
    const requested = requestExternalRepair(runtime);
    runtime.applyNodeOutcome("root-run", requested.orchestrator.nodeRunId, {
      role: "orchestrator", state: "needs_input", summary: "Need route context.",
      question: "Which capability is authoritative?", context: "Choose a repair specialization."
    });
    expect(activeNode(runtime)).toMatchObject({ nodeRunId: requested.orchestrator.nodeRunId, status: "waiting_for_input" });
    const resumedRun = runtime.resumeNode(
      "root-run", requested.orchestrator.nodeRunId, "Use the repair-a specialization."
    );
    const resumed = resumedRun.nodeRuns.at(-1)!;
    expect(resumed).toMatchObject({
      nodeRunId: requested.orchestrator.nodeRunId, role: "orchestrator", attempt: 2, status: "queued"
    });
    expect(resumed.context).toEqual({
      orchestrationRequestId: requested.orchestrationRequest.orchestrationRequestId,
      resume: {
        question: "Which capability is authoritative?", context: "Choose a repair specialization.",
        response: "Use the repair-a specialization."
      }
    });
    expect(runtime.getRepairRequest(requested.request.repairRequestId)).toMatchObject({
      status: "pending", orchestratorNodeRunId: requested.orchestrator.nodeRunId
    });
    expect(runtime.state.current("root-run")).toMatchObject({ revision: 0, state: { repaired: false } });
    routeRepair(runtime, resumed, "repair-a");
    runtime.close();
    await harness.close();
  });

  it("reopens pending, dispatched, and returned boundaries without duplicating runtime records", async () => {
    const harness = await createOrchestrationHarness();
    let runtime = harness.runtime;
    runtime.startLoopRun("root-run");
    const requested = requestExternalRepair(runtime);
    const requestId = requested.request.repairRequestId;
    const orchestratorId = requested.orchestrator.nodeRunId;
    runtime.close();

    runtime = new RuntimeDatabase(harness.filename);
    expect(activeNode(runtime)).toMatchObject({ nodeRunId: orchestratorId, role: "orchestrator", status: "queued" });
    const target = routeRepair(runtime, activeNode(runtime), "repair-a");
    runtime.close();

    runtime = new RuntimeDatabase(harness.filename);
    expect(activeNode(runtime)).toMatchObject({ loopRunId: target.loopRunId, role: "work" });
    completeActiveLoop(runtime);
    const returnedId = activeNode(runtime).nodeRunId;
    runtime.close();

    runtime = new RuntimeDatabase(harness.filename);
    expect(activeNode(runtime)).toMatchObject({ nodeRunId: returnedId, role: "validation", loopId: "caller-loop" });
    expect(runtime.connection().prepare("SELECT COUNT(*) FROM repair_requests").pluck().get()).toBe(1);
    expect(runtime.connection().prepare("SELECT COUNT(*) FROM orchestration_frames").pluck().get()).toBe(1);
    expect(runtime.connection().prepare("SELECT COUNT(*) FROM repair_results").pluck().get()).toBe(1);
    expect(runtime.getRepairRequest(requestId)).toMatchObject({ status: "repaired" });
    runtime.close();
    await harness.close();
  });
});

describe("LoopOrchestrator interruption and cancellation recovery", () => {
  it("propagates an interrupted repair target and preserves the last committed revision", async () => {
    const harness = await createOrchestrationHarness();
    const { runtime } = harness;
    runtime.startLoopRun("root-run");
    const requested = requestExternalRepair(runtime);
    const target = routeRepair(runtime, requested.orchestrator, "repair-a");
    const node = activeNode(runtime);
    const timestamp = new Date().toISOString();
    runtime.connection().transaction(() => {
      runtime.connection().prepare(`
        UPDATE node_runs SET status = 'interrupted', state_revision_after = 0,
          error_code = 'interrupted', error_message = 'Process interrupted.', completed_at = ?, updated_at = ?
        WHERE node_run_id = ?
      `).run(timestamp, timestamp, node.nodeRunId);
      runtime.connection().prepare(`
        UPDATE work_loop_node_runs SET status = 'failed', terminal = 'failed', state_revision_after = 0,
          active_node_run_id = NULL, completed_at = ?, updated_at = ? WHERE work_loop_node_run_id = ?
      `).run(timestamp, timestamp, node.workLoopNodeRunId);
      runtime.connection().prepare(`
        UPDATE loop_invocations SET status = 'failed', completion_state_revision = 0,
          completed_at = ?, updated_at = ? WHERE loop_run_id = ?
      `).run(timestamp, timestamp, target.loopRunId);
    })();
    runtime.reconcileTerminalNode(node.nodeRunId);

    expect(runtime.getRepairRequest(requested.request.repairRequestId)).toMatchObject({ status: "failed" });
    expect(runtime.listRepairResults("root-run")).toEqual([
      expect.objectContaining({ status: "failed", stateRevision: 0, targetLoopRunId: target.loopRunId })
    ]);
    expect(runtime.state.current("root-run")).toMatchObject({ revision: 0, state: { repaired: false } });
    expect(runtime.listRootLoopRuns("root-run")[0]).toMatchObject({ status: "failed" });
    runtime.close();
    await harness.close();
  });

  it("fails a pending Repair Request when its running Orchestrator is interrupted", async () => {
    const harness = await createOrchestrationHarness();
    const { runtime } = harness;
    runtime.startLoopRun("root-run");
    const requested = requestExternalRepair(runtime);
    const timestamp = new Date().toISOString();
    runtime.connection().transaction(() => {
      runtime.connection().prepare(`
        UPDATE node_runs SET status = 'interrupted', state_revision_after = 0,
          error_code = 'interrupted', error_message = 'Orchestrator interrupted.', completed_at = ?, updated_at = ?
        WHERE node_run_id = ?
      `).run(timestamp, timestamp, requested.orchestrator.nodeRunId);
      runtime.connection().prepare(`
        UPDATE loop_invocations SET status = 'failed', completion_state_revision = 0,
          completed_at = ?, updated_at = ? WHERE loop_run_id = ?
      `).run(timestamp, timestamp, requested.orchestrator.loopRunId);
    })();
    runtime.reconcileTerminalNode(requested.orchestrator.nodeRunId);

    expect(runtime.getRepairRequest(requested.request.repairRequestId)).toMatchObject({ status: "failed" });
    expect(runtime.listRepairResults("root-run")).toEqual([]);
    expect(runtime.listRootLoopRuns("root-run")[0]).toMatchObject({ status: "failed" });
    expect(rootError(runtime)).toBe("Orchestrator interrupted.");
    runtime.close();
    await harness.close();
  });

  it("cancels every open nested frame and persists failure evidence atomically", async () => {
    const repairA = testLoop("repair-a", testWorkLoopNode("repair-a-work"));
    const repairB = testLoop("repair-b", testWorkLoopNode("repair-b-work"));
    const harness = await createOrchestrationHarness({ targets: [repairA, repairB], edges: [
      { id: "caller-a", source: "caller-loop", target: "repair-a", kind: "repair", capability: "test:loop.transfer", description: "Caller to A." },
      { id: "a-b", source: "repair-a", target: "repair-b", kind: "repair", capability: "test:loop.transfer", description: "A to B." }
    ] });
    const { runtime } = harness;
    runtime.startLoopRun("root-run");
    const outer = requestExternalRepair(runtime);
    routeRepair(runtime, outer.orchestrator, "repair-a");
    const inner = requestExternalRepair(runtime);
    routeRepair(runtime, inner.orchestrator, "repair-b");
    runtime.terminalizeActiveRootRuns("root-run", "cancelled", undefined);

    expect(runtime.repair.openFrames("root-run")).toEqual([]);
    expect(runtime.connection().prepare("SELECT status FROM orchestration_frames ORDER BY nesting_depth").pluck().all())
      .toEqual(["cancelled", "cancelled"]);
    expect(runtime.connection().prepare("SELECT status FROM repair_requests ORDER BY nesting_depth").pluck().all())
      .toEqual(["cancelled", "cancelled"]);
    expect(runtime.listRepairResults("root-run").map(({ status }) => status)).toEqual(["cancelled", "cancelled"]);
    expect(runtime.state.current("root-run")).toMatchObject({ revision: 0 });
    runtime.close();
    await harness.close();
  });
});

const externalFailure = (summary: string) => ({
  role: "validation" as const, state: "completed" as const, decision: "FAIL" as const,
  summary, evidence: {}, checks: [], repair: {
    mode: "ORCHESTRATOR_REPAIR" as const, reason: "Another repair is required.",
    requestedCapability: "test:loop.transfer", evidenceRefs: []
  }
});

const rootError = (runtime: RuntimeDatabase): string => {
  const value = runtime.connection().prepare(`
    SELECT error_message FROM root_runs WHERE root_run_id = 'root-run'
  `).pluck().get();
  return typeof value === "string" ? value : "";
};
