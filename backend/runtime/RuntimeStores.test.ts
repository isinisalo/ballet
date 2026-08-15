import { describe, expect, it } from "vitest";
import { RuntimeDatabase } from "../runtime-db.js";
import { createRuntimeStoreFixture, runtimeTestTimestamp } from "./RuntimeStore.test-fixture.js";

describe("Work Loop runtime stores", () => {
  it("round-trips Root, Loop, Work Loop Node, and role-specific Node Runs", async () => {
    const fixture = await createRuntimeStoreFixture({ count: 0 });
    const loopRun = fixture.loops.createLoopRun({
      loopRunId: "loop-run", rootRunId: "root-run", loop: fixture.loop, source: "manual"
    });
    const workLoopNodeRun = fixture.loops.createWorkLoopNodeRun({
      workLoopNodeRunId: "work-loop-node-run", rootRunId: "root-run", loopRunId: loopRun.loopRunId,
      loopId: fixture.loop.id, workLoopNodeId: fixture.loop.startNodeId, attempt: 1
    });
    const work = fixture.loops.createNodeRun({
      nodeRunId: "work-node-run", rootRunId: "root-run", loopRunId: loopRun.loopRunId,
      workLoopNodeRunId: workLoopNodeRun.workLoopNodeRunId, role: "work", loopId: fixture.loop.id,
      workLoopNodeId: fixture.loop.startNodeId, nodeDefinitionId: "main-loop:work:work",
      input: { instruction: "execute" }, context: { stateRevision: 0 }, attempt: 1
    });

    expect(fixture.roots.require("root-run")).toMatchObject({ stateRevision: 0, transitionCount: 0 });
    expect(fixture.states.current("root-run")).toMatchObject({ revision: 0, state: { count: 0 } });
    expect(fixture.loops.details("loop-run")).toMatchObject({
      loopRunId: "loop-run", entryStateRevision: 0,
      workLoopNodeRuns: [{ workLoopNodeRunId: "work-loop-node-run", activeNodeRunId: "work-node-run" }],
      nodeRuns: [{ nodeRunId: "work-node-run", role: "work", input: { instruction: "execute" } }]
    });
    expect(work).toMatchObject({ status: "queued", stateRevisionBefore: 0 });
    await fixture.close();
  });

  it("persists pending Repair Requests and orchestration continuations across reopen", async () => {
    const fixture = await createRuntimeStoreFixture({ repaired: false });
    const loopRun = fixture.loops.createLoopRun({
      loopRunId: "caller-loop-run", rootRunId: "root-run", loop: fixture.loop, source: "manual"
    });
    const composite = fixture.loops.createWorkLoopNodeRun({
      workLoopNodeRunId: "work-loop-node-run", rootRunId: "root-run", loopRunId: loopRun.loopRunId,
      loopId: fixture.loop.id, workLoopNodeId: fixture.loop.startNodeId, attempt: 1
    });
    const validation = fixture.loops.createNodeRun({
      nodeRunId: "validation-node-run", rootRunId: "root-run", loopRunId: loopRun.loopRunId,
      workLoopNodeRunId: composite.workLoopNodeRunId, role: "validation", loopId: fixture.loop.id,
      workLoopNodeId: fixture.loop.startNodeId, nodeDefinitionId: "main-loop:work:validation", attempt: 1
    });
    const request = fixture.repairs.createRequest({
      repairRequestId: "repair-request", rootRunId: "root-run", requesterLoopRunId: loopRun.loopRunId,
      requesterWorkLoopNodeRunId: composite.workLoopNodeRunId,
      requesterValidationNodeRunId: validation.nodeRunId, requestedCapability: "repair-state",
      requestedOutcome: { repaired: true }, reason: "Validation found a repairable mismatch.",
      evidence: { check: "failed" }, stateRevisionAtRequest: 0, returnLoopId: fixture.loop.id,
      returnWorkLoopNodeId: fixture.loop.startNodeId,
      returnValidationNodeDefinitionId: "main-loop:work:validation", nestingDepth: 1,
      createdAt: runtimeTestTimestamp
    });
    const callee = fixture.loops.createLoopRun({
      loopRunId: "callee-loop-run", rootRunId: "root-run", loop: fixture.loop,
      parentLoopRunId: loopRun.loopRunId, source: "repair", nestingDepth: 1
    });
    const orchestrator = fixture.loops.createNodeRun({
      nodeRunId: "orchestrator-node-run", rootRunId: "root-run", loopRunId: loopRun.loopRunId,
      role: "orchestrator", loopId: fixture.loop.id,
      nodeDefinitionId: "root:orchestrator", attempt: 1
    });
    expect(() => fixture.repairs.routeRequest({
      repairRequestId: request.repairRequestId, loopEdgeId: "not-allowlisted",
      sourceLoopId: fixture.loop.id, targetLoopId: fixture.loop.id,
      orchestratorNodeRunId: orchestrator.nodeRunId
    })).toThrow(/not an allowed repair route/);
    fixture.repairs.routeRequest({
      repairRequestId: request.repairRequestId, loopEdgeId: "self-repair",
      sourceLoopId: fixture.loop.id, targetLoopId: fixture.loop.id,
      orchestratorNodeRunId: orchestrator.nodeRunId, evidence: { route: "allowlisted" }
    });
    fixture.repairs.createFrame({
      frameId: "frame", rootRunId: "root-run", repairRequestId: request.repairRequestId,
      callerLoopRunId: loopRun.loopRunId, calleeLoopRunId: callee.loopRunId,
      returnLoopId: fixture.loop.id, returnWorkLoopNodeId: fixture.loop.startNodeId,
      returnValidationNodeDefinitionId: "main-loop:work:validation",
      stateRevisionAtCall: 0, nestingDepth: 1, createdAt: runtimeTestTimestamp
    });
    fixture.repairs.createRequest({
      repairRequestId: "pending-repair", rootRunId: "root-run", requesterLoopRunId: loopRun.loopRunId,
      requesterWorkLoopNodeRunId: composite.workLoopNodeRunId,
      requesterValidationNodeRunId: validation.nodeRunId, reason: "Awaiting a route.",
      stateRevisionAtRequest: 0, returnLoopId: fixture.loop.id,
      returnWorkLoopNodeId: fixture.loop.startNodeId,
      returnValidationNodeDefinitionId: "main-loop:work:validation", nestingDepth: 1
    });

    const reopened = fixture.reopen();
    expect(reopened.repairs.pending("root-run")).toEqual(expect.arrayContaining([
      expect.objectContaining({
        repairRequestId: "repair-request", status: "routed", routedLoopEdgeId: "self-repair",
        routedTargetLoopId: "main-loop", evidence: { check: "failed" }
      }),
      expect.objectContaining({ repairRequestId: "pending-repair", status: "pending" })
    ]));
    expect(reopened.repairs.openFrames("root-run")).toEqual([expect.objectContaining({
      frameId: "frame", callerLoopRunId: "caller-loop-run", calleeLoopRunId: "callee-loop-run"
    })]);
    expect(reopened.repairs.routeForRequest("repair-request")).toMatchObject({
      rootRunId: "root-run", repairRequestId: "repair-request", loopEdgeId: "self-repair",
      sourceLoopId: "main-loop", targetLoopId: "main-loop", evidence: { route: "allowlisted" }
    });
    expect(reopened.states.current("root-run")).toMatchObject({ revision: 0, state: { repaired: false } });
    await fixture.close();
  });
});

describe("Work Loop runtime invariants", () => {
  it("enforces one active phase for each Work Loop Node Run", async () => {
    const fixture = await createRuntimeStoreFixture();
    const loop = fixture.loops.createLoopRun({
      loopRunId: "loop-run", rootRunId: "root-run", loop: fixture.loop, source: "manual"
    });
    const composite = fixture.loops.createWorkLoopNodeRun({
      workLoopNodeRunId: "composite", rootRunId: "root-run", loopRunId: loop.loopRunId,
      loopId: fixture.loop.id, workLoopNodeId: fixture.loop.startNodeId, attempt: 1
    });
    fixture.loops.createNodeRun({
      nodeRunId: "phase-one", rootRunId: "root-run", loopRunId: loop.loopRunId,
      workLoopNodeRunId: composite.workLoopNodeRunId, role: "work", loopId: fixture.loop.id,
      workLoopNodeId: fixture.loop.startNodeId, nodeDefinitionId: "main-loop:work:work", attempt: 1
    });

    expect(() => fixture.loops.createNodeRun({
      nodeRunId: "phase-two", rootRunId: "root-run", loopRunId: loop.loopRunId,
      workLoopNodeRunId: composite.workLoopNodeRunId, role: "validation", loopId: fixture.loop.id,
      workLoopNodeId: fixture.loop.startNodeId, nodeDefinitionId: "main-loop:work:validation", attempt: 1
    })).toThrow(/UNIQUE constraint failed/);
    await fixture.close();
  });

  it("keeps terminal Runs and append-only revisions immutable", async () => {
    const fixture = await createRuntimeStoreFixture();
    const loop = fixture.loops.createLoopRun({
      loopRunId: "loop-run", rootRunId: "root-run", loop: fixture.loop, source: "manual"
    });
    const composite = fixture.loops.createWorkLoopNodeRun({
      workLoopNodeRunId: "composite", rootRunId: "root-run", loopRunId: loop.loopRunId,
      loopId: fixture.loop.id, workLoopNodeId: fixture.loop.startNodeId, attempt: 1
    });
    const node = fixture.loops.createNodeRun({
      nodeRunId: "node", rootRunId: "root-run", loopRunId: loop.loopRunId,
      workLoopNodeRunId: composite.workLoopNodeRunId, role: "work", loopId: fixture.loop.id,
      workLoopNodeId: fixture.loop.startNodeId, nodeDefinitionId: "main-loop:work:work", attempt: 1
    });
    fixture.connection().prepare(`
      UPDATE node_runs SET status = 'failed', completed_at = ?, updated_at = ? WHERE node_run_id = ?
    `).run(runtimeTestTimestamp, runtimeTestTimestamp, node.nodeRunId);

    expect(fixture.loops.getWorkLoopNodeRun(composite.workLoopNodeRunId)?.activeNodeRunId).toBeUndefined();
    expect(() => fixture.connection().prepare(`
      UPDATE node_runs SET status = 'running', completed_at = NULL WHERE node_run_id = ?
    `).run(node.nodeRunId)).toThrow("terminal Node Run status is immutable");
    expect(() => fixture.connection().prepare(`
      UPDATE state_revisions SET state_json = '{"changed":true}' WHERE root_run_id = 'root-run' AND revision = 0
    `).run()).toThrow("state revision is immutable");
    expect(() => fixture.connection().prepare(`
      INSERT INTO state_revisions (
        root_run_id, revision, parent_revision, state_json, state_hash,
        patch_json, patch_hash, source_node_run_id, created_at
      ) VALUES ('root-run', 2, 1, '{}', ?, '[]', ?, 'node', ?)
    `).run("a".repeat(64), "b".repeat(64), runtimeTestTimestamp))
      .toThrow("state revision must be the next monotonic revision");
    expect(() => fixture.connection().prepare(`
      UPDATE root_runs SET transition_count = 257 WHERE root_run_id = 'root-run'
    `).run()).toThrow(/CHECK constraint failed/);
    expect(() => fixture.connection().prepare(`
      UPDATE root_runs SET execution_snapshot_json = '{}' WHERE root_run_id = 'root-run'
    `).run()).toThrow("root run execution snapshot is immutable");
    await fixture.close();
  });

  it("terminalizes active runtime records on Root cancellation without changing committed state", async () => {
    const fixture = await createRuntimeStoreFixture({ committed: true });
    const loopRun = fixture.loops.createLoopRun({
      loopRunId: "loop-run", rootRunId: "root-run", loop: fixture.loop, source: "manual"
    });
    const composite = fixture.loops.createWorkLoopNodeRun({
      workLoopNodeRunId: "composite", rootRunId: "root-run", loopRunId: loopRun.loopRunId,
      loopId: fixture.loop.id, workLoopNodeId: fixture.loop.startNodeId, attempt: 1
    });
    const validation = fixture.loops.createNodeRun({
      nodeRunId: "validation", rootRunId: "root-run", loopRunId: loopRun.loopRunId,
      workLoopNodeRunId: composite.workLoopNodeRunId, role: "validation", loopId: fixture.loop.id,
      workLoopNodeId: fixture.loop.startNodeId, nodeDefinitionId: "main-loop:work:validation", attempt: 1
    });
    fixture.repairs.createRequest({
      repairRequestId: "pending-repair", rootRunId: "root-run", requesterLoopRunId: loopRun.loopRunId,
      requesterWorkLoopNodeRunId: composite.workLoopNodeRunId,
      requesterValidationNodeRunId: validation.nodeRunId, reason: "Pending at cancellation.",
      stateRevisionAtRequest: 0, returnLoopId: fixture.loop.id,
      returnWorkLoopNodeId: fixture.loop.startNodeId,
      returnValidationNodeDefinitionId: "main-loop:work:validation", nestingDepth: 1
    });
    fixture.release();

    const runtime = new RuntimeDatabase(fixture.filename);
    runtime.connection().transaction(() => {
      runtime.terminalizeActiveRootRuns("root-run", "cancelled", undefined, runtimeTestTimestamp);
    })();
    expect(runtime.getNodeRun("validation")).toMatchObject({ status: "cancelled" });
    expect(runtime.getWorkLoopNodeRun("composite")).toMatchObject({ status: "cancelled", terminal: "cancelled" });
    expect(runtime.listRootLoopRuns("root-run")).toEqual([
      expect.objectContaining({ loopRunId: "loop-run", status: "cancelled", completionStateRevision: 0 })
    ]);
    expect(runtime.getRepairRequest("pending-repair")).toMatchObject({ status: "cancelled" });
    expect(runtime.state.current("root-run")).toMatchObject({ revision: 0, state: { committed: true } });
    expect(() => runtime.connection().prepare(`
      UPDATE loop_invocations SET status = 'running', completed_at = NULL WHERE loop_run_id = 'loop-run'
    `).run()).toThrow("terminal loop run status is immutable");
    expect(() => runtime.connection().prepare(`
      UPDATE work_loop_node_runs SET status = 'running', terminal = NULL, completed_at = NULL
      WHERE work_loop_node_run_id = 'composite'
    `).run()).toThrow("terminal Work Loop Node Run status is immutable");
    expect(runtime.listControlFlowEvents("root-run")).toEqual([
      expect.objectContaining({ kind: "root_cancelled", stateRevision: 0, sourceNodeRunId: "validation" })
    ]);
    runtime.close();
    await fixture.close();
  });
});
