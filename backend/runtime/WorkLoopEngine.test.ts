import { describe, expect, it } from "vitest";
import { RuntimeDatabase } from "../runtime-db.js";
import { testWorkLoopNode } from "../tests/v10TestConfig.js";
import { createRuntimeStoreFixture } from "./RuntimeStore.test-fixture.js";

describe("WorkLoopEngine", () => {
  it("runs Work -> Validation -> OK -> completed with canonical State readback", async () => {
    const fixture = await createRuntimeStoreFixture({ count: 0 });
    fixture.release();
    const runtime = new RuntimeDatabase(fixture.filename);
    const started = runtime.startLoopRun("root-run");
    const work = started.nodeRuns[0]!;

    const validationPhase = runtime.applyNodeOutcome("root-run", work.nodeRunId, {
      role: "work", state: "completed", summary: "Work completed.", artifacts: {}, checks: [],
      statePatch: [{ op: "replace", path: "/count", value: 1 }]
    });
    const validation = validationPhase.nodeRuns.at(-1)!;
    expect(validation).toMatchObject({ role: "validation", status: "waiting_for_input", stateRevisionBefore: 1 });
    expect(runtime.state.current("root-run")).toMatchObject({ revision: 1, state: { count: 1 } });

    const completed = runtime.applyNodeOutcome("root-run", validation.nodeRunId, {
      role: "validation", state: "completed", decision: "OK", summary: "Accepted.",
      evidence: { check: "ok" }, checks: []
    });
    expect(completed).toMatchObject({ status: "completed", completionStateRevision: 1 });
    expect(completed.workLoopNodeRuns[0]).toMatchObject({ status: "completed", terminal: "completed" });
    expect(runtime.listControlFlowEvents("root-run").map(({ kind }) => kind))
      .toEqual(["work_completed", "validation_ok"]);
    runtime.close();
    await fixture.close();
  });

  it("starts Human Work and accepts a canonical Work outcome", async () => {
    const node = {
      ...testWorkLoopNode(),
      work: { type: "human" as const, task: "Perform human work.", nodeStyle: "terra" as const, nodeSize: "medium" as const }
    };
    const fixture = await createRuntimeStoreFixture({}, { loop: {
      id: "main-loop", description: "Human Work Loop.", state: { description: "State.", initial: {} },
      startNodeId: node.id, nodes: [node],
      edges: [{ id: "done", source: node.id, target: { terminal: "completed" } }]
    } });
    fixture.release();
    const runtime = new RuntimeDatabase(fixture.filename);
    const work = runtime.startLoopRun("root-run").nodeRuns[0]!;
    expect(work).toMatchObject({ role: "work", status: "waiting_for_input", executionTaskId: undefined });
    const next = runtime.applyNodeOutcome("root-run", work.nodeRunId, {
      role: "work", state: "completed", summary: "Human work completed.", artifacts: {}, checks: []
    });
    expect(next.nodeRuns.at(-1)).toMatchObject({ role: "validation", status: "waiting_for_input" });
    runtime.close();
    await fixture.close();
  });
});

describe("WorkLoopEngine normal and local routing", () => {
  it("retries locally in the same composite and persists the fixed Repair Request", async () => {
    const fixture = await createRuntimeStoreFixture({ corrected: false });
    fixture.release();
    const runtime = new RuntimeDatabase(fixture.filename);
    const started = runtime.startLoopRun("root-run");
    const work = started.nodeRuns[0]!;
    const validation = runtime.applyNodeOutcome("root-run", work.nodeRunId, {
      role: "work", state: "completed", summary: "First attempt.", artifacts: {}, checks: []
    }).nodeRuns.at(-1)!;

    const retried = runtime.applyNodeOutcome("root-run", validation.nodeRunId, {
      role: "validation", state: "completed", decision: "FAIL", summary: "Needs correction.",
      evidence: { check: "failed" }, checks: [],
      repair: { mode: "LOCAL_RETRY", feedback: "Correct the value.", expectedCorrection: "Set corrected true." }
    });
    const composite = retried.workLoopNodeRuns[0]!;
    const retryWork = retried.nodeRuns.at(-1)!;
    expect(composite).toMatchObject({ attempt: 2, status: "running", activeNodeRunId: retryWork.nodeRunId });
    expect(retryWork).toMatchObject({ role: "work", attempt: 2, stateRevisionBefore: 0 });
    expect(retryWork.context).toEqual({
      previousValidationFeedback: { feedback: "Correct the value.", expectedCorrection: "Set corrected true." }
    });
    const request = runtime.connection().prepare("SELECT repair_request_id FROM repair_requests").pluck().get();
    expect(typeof request).toBe("string");
    expect(runtime.getRepairRequest(String(request))).toMatchObject({ status: "completed" });
    runtime.close();
    await fixture.close();
  });

  it("follows the single Validation OK Node Edge to a new Work Loop Node Run", async () => {
    const first = testWorkLoopNode("first");
    const second = testWorkLoopNode("second");
    const fixture = await createRuntimeStoreFixture({}, { loop: {
      id: "main-loop", description: "Two-node Loop.", state: { description: "State.", initial: {} },
      startNodeId: first.id, nodes: [first, second], edges: [
        { id: "first-next", source: first.id, target: { nodeId: second.id } },
        { id: "second-done", source: second.id, target: { terminal: "completed" } }
      ]
    } });
    fixture.release();
    const runtime = new RuntimeDatabase(fixture.filename);
    const work = runtime.startLoopRun("root-run").nodeRuns[0]!;
    const validation = runtime.applyNodeOutcome("root-run", work.nodeRunId, {
      role: "work", state: "completed", summary: "First done.", artifacts: {}, checks: []
    }).nodeRuns.at(-1)!;
    const next = runtime.applyNodeOutcome("root-run", validation.nodeRunId, {
      role: "validation", state: "completed", decision: "OK", summary: "First accepted.",
      evidence: {}, checks: []
    });
    expect(next.workLoopNodeRuns).toHaveLength(2);
    expect(next.workLoopNodeRuns[0]).toMatchObject({ workLoopNodeId: "first", status: "completed" });
    expect(next.workLoopNodeRuns[1]).toMatchObject({ workLoopNodeId: "second", status: "running", attempt: 1 });
    expect(next.nodeRuns.at(-1)).toMatchObject({ role: "work", workLoopNodeId: "second", status: "queued" });
    expect(runtime.listControlFlowEvents("root-run").at(-1)).toMatchObject({
      kind: "validation_ok", targetWorkLoopNodeRunId: next.workLoopNodeRuns[1]?.workLoopNodeRunId
    });
    runtime.close();
    await fixture.close();
  });
});

describe("WorkLoopEngine retry and suspension", () => {
  it("blocks deterministically when the local retry limit is exhausted", async () => {
    const node = { ...testWorkLoopNode(), maxLocalAttempts: 1 };
    const fixture = await createRuntimeStoreFixture({}, { loop: {
      id: "main-loop", description: "Limited Loop.", state: { description: "State.", initial: {} },
      startNodeId: node.id, nodes: [node],
      edges: [{ id: "done", source: node.id, target: { terminal: "completed" } }]
    } });
    fixture.release();
    const runtime = new RuntimeDatabase(fixture.filename);
    const work = runtime.startLoopRun("root-run").nodeRuns[0]!;
    const validation = runtime.applyNodeOutcome("root-run", work.nodeRunId, {
      role: "work", state: "completed", summary: "Attempted.", artifacts: {}, checks: []
    }).nodeRuns.at(-1)!;
    const blocked = runtime.applyNodeOutcome("root-run", validation.nodeRunId, {
      role: "validation", state: "completed", decision: "FAIL", summary: "Still invalid.",
      evidence: {}, checks: [],
      repair: { mode: "LOCAL_RETRY", feedback: "Retry.", expectedCorrection: "Correct it." }
    });
    expect(blocked).toMatchObject({ status: "blocked" });
    expect(blocked.workLoopNodeRuns[0]).toMatchObject({
      status: "blocked", terminal: "blocked", errorCode: "local_retry_limit"
    });
    expect(runtime.connection().prepare("SELECT status FROM repair_requests").pluck().get()).toBe("failed");
    runtime.close();
    await fixture.close();
  });

  it("parks ORCHESTRATOR_REPAIR without selecting a target or creating a call frame", async () => {
    const fixture = await createRuntimeStoreFixture({ repaired: false });
    fixture.release();
    const runtime = new RuntimeDatabase(fixture.filename);
    const work = runtime.startLoopRun("root-run").nodeRuns[0]!;
    const validation = runtime.applyNodeOutcome("root-run", work.nodeRunId, {
      role: "work", state: "completed", summary: "Work completed.", artifacts: {}, checks: []
    }).nodeRuns.at(-1)!;
    const waiting = runtime.applyNodeOutcome("root-run", validation.nodeRunId, {
      role: "validation", state: "completed", decision: "FAIL", summary: "External repair required.",
      evidence: { ref: "check-1" }, checks: [],
      repair: {
        mode: "ORCHESTRATOR_REPAIR", reason: "A specialist capability is required.",
        requestedCapability: "repair-state", evidenceRefs: ["check-1"]
      }
    });

    expect(waiting.status).toBe("waiting_for_input");
    expect(waiting.workLoopNodeRuns[0]).toMatchObject({ status: "waiting_for_input", activeNodeRunId: undefined });
    const requestId = runtime.connection().prepare("SELECT repair_request_id FROM repair_requests").pluck().get();
    expect(runtime.getRepairRequest(String(requestId))).toMatchObject({
      status: "pending", routedTargetLoopId: undefined,
      requesterValidationNodeRunId: validation.nodeRunId,
      returnValidationNodeDefinitionId: validation.nodeDefinitionId
    });
    expect(runtime.connection().prepare("SELECT COUNT(*) FROM orchestration_frames").pluck().get()).toBe(0);
    runtime.close();
    await fixture.close();
  });

  it("pauses and resumes the same Node role without changing State or local attempt", async () => {
    const fixture = await createRuntimeStoreFixture({ stable: true });
    fixture.release();
    const runtime = new RuntimeDatabase(fixture.filename);
    const work = runtime.startLoopRun("root-run").nodeRuns[0]!;
    runtime.applyNodeOutcome("root-run", work.nodeRunId, {
      role: "work", state: "needs_input", summary: "Need a choice.", checks: [],
      question: "Which option?", context: "A or B"
    });
    const resumed = runtime.resumeNode("root-run", work.nodeRunId, "A");
    const next = resumed.nodeRuns.at(-1)!;
    expect(resumed.workLoopNodeRuns[0]).toMatchObject({ attempt: 1, status: "running" });
    expect(next).toMatchObject({ role: "work", attempt: 2, stateRevisionBefore: 0, status: "queued" });
    expect(next.context).toEqual({ resume: { question: "Which option?", context: "A or B", response: "A" } });
    expect(runtime.state.current("root-run")).toMatchObject({ revision: 0, state: { stable: true } });
    expect(runtime.listControlFlowEvents("root-run")).toEqual([]);
    runtime.close();
    await fixture.close();
  });

  it("resumes Validation at the same State revision with the canonical Work outcome retained", async () => {
    const fixture = await createRuntimeStoreFixture({ stable: true });
    fixture.release();
    const runtime = new RuntimeDatabase(fixture.filename);
    const work = runtime.startLoopRun("root-run").nodeRuns[0]!;
    const validation = runtime.applyNodeOutcome("root-run", work.nodeRunId, {
      role: "work", state: "completed", summary: "Work done.", artifacts: {}, checks: []
    }).nodeRuns.at(-1)!;
    runtime.applyNodeOutcome("root-run", validation.nodeRunId, {
      role: "validation", state: "needs_input", summary: "Need evidence.", checks: [],
      question: "Where is the evidence?", context: "Provide a reference."
    });
    const resumed = runtime.resumeNode("root-run", validation.nodeRunId, "artifact:report");
    expect(resumed.workLoopNodeRuns[0]).toMatchObject({ attempt: 1, status: "waiting_for_input" });
    expect(resumed.nodeRuns.at(-1)).toMatchObject({
      role: "validation", attempt: 2, stateRevisionBefore: 0, status: "waiting_for_input"
    });
    expect(runtime.state.current("root-run")).toMatchObject({ revision: 0, state: { stable: true } });
    runtime.close();
    await fixture.close();
  });
});

describe("WorkLoopEngine failure boundaries", () => {
  it.each(["blocked", "failed"] as const)("propagates a Work %s outcome without following an Edge", async (state) => {
    const fixture = await createRuntimeStoreFixture({ stable: true });
    fixture.release();
    const runtime = new RuntimeDatabase(fixture.filename);
    const work = runtime.startLoopRun("root-run").nodeRuns[0]!;
    const terminal = runtime.applyNodeOutcome("root-run", work.nodeRunId, {
      role: "work", state, summary: `Work ${state}.`, checks: []
    });
    expect(terminal).toMatchObject({ status: state, completionStateRevision: 0 });
    expect(terminal.nodeRuns).toHaveLength(1);
    expect(terminal.nodeRuns[0]).toMatchObject({ status: state, stateRevisionAfter: 0 });
    runtime.close();
    await fixture.close();
  });

  it.each(["blocked", "failed"] as const)("propagates a Validation %s outcome without following an Edge", async (state) => {
    const fixture = await createRuntimeStoreFixture({ stable: true });
    fixture.release();
    const runtime = new RuntimeDatabase(fixture.filename);
    const work = runtime.startLoopRun("root-run").nodeRuns[0]!;
    const validation = runtime.applyNodeOutcome("root-run", work.nodeRunId, {
      role: "work", state: "completed", summary: "Work done.", artifacts: {}, checks: []
    }).nodeRuns.at(-1)!;
    const terminal = runtime.applyNodeOutcome("root-run", validation.nodeRunId, {
      role: "validation", state, summary: `Validation ${state}.`, checks: []
    });
    expect(terminal).toMatchObject({ status: state, completionStateRevision: 0 });
    expect(terminal.nodeRuns.at(-1)).toMatchObject({ role: "validation", status: state });
    runtime.close();
    await fixture.close();
  });

  it("rolls back an invalid Work patch and does not create Validation", async () => {
    const fixture = await createRuntimeStoreFixture({ count: 0 });
    fixture.release();
    const runtime = new RuntimeDatabase(fixture.filename);
    const work = runtime.startLoopRun("root-run").nodeRuns[0]!;
    expect(() => runtime.applyNodeOutcome("root-run", work.nodeRunId, {
      role: "work", state: "completed", summary: "Invalid patch.", artifacts: {}, checks: [],
      statePatch: [{ op: "replace", path: "/missing", value: true }]
    })).toThrow(/does not exist/);
    expect(runtime.state.current("root-run")).toMatchObject({ revision: 0, state: { count: 0 } });
    expect(runtime.listRootLoopRuns("root-run")[0]?.nodeRuns).toEqual([
      expect.objectContaining({ nodeRunId: work.nodeRunId, status: "queued", outcome: undefined })
    ]);
    expect(runtime.listControlFlowEvents("root-run")).toEqual([]);
    runtime.close();
    await fixture.close();
  });

  it("rejects an outcome when the Node Run is not the Root Run active cursor", async () => {
    const fixture = await createRuntimeStoreFixture({ stable: true });
    fixture.release();
    const runtime = new RuntimeDatabase(fixture.filename);
    const work = runtime.startLoopRun("root-run").nodeRuns[0]!;
    runtime.connection().prepare(`
      UPDATE root_runs SET active_node_run_id = NULL WHERE root_run_id = 'root-run'
    `).run();

    expect(() => runtime.applyNodeOutcome("root-run", work.nodeRunId, {
      role: "work", state: "completed", summary: "Stale completion.", artifacts: {}, checks: []
    })).toThrow(/not the active cursor/);
    expect(runtime.state.current("root-run")).toMatchObject({ revision: 0, state: { stable: true } });
    expect(runtime.listControlFlowEvents("root-run")).toEqual([]);
    runtime.close();
    await fixture.close();
  });

  it("blocks at the Root transition limit without exposing an uncommitted patch", async () => {
    const fixture = await createRuntimeStoreFixture({ count: 0 });
    fixture.release();
    const runtime = new RuntimeDatabase(fixture.filename);
    const work = runtime.startLoopRun("root-run").nodeRuns[0]!;
    runtime.connection().prepare("UPDATE root_runs SET transition_count = 256 WHERE root_run_id = 'root-run'").run();

    const blocked = runtime.applyNodeOutcome("root-run", work.nodeRunId, {
      role: "work", state: "completed", summary: "Too late.", artifacts: {}, checks: [],
      statePatch: [{ op: "replace", path: "/count", value: 1 }]
    });
    expect(blocked).toMatchObject({ status: "blocked" });
    expect(blocked.nodeRuns[0]).toMatchObject({ status: "blocked", errorCode: "transition_limit" });
    expect(runtime.state.current("root-run")).toMatchObject({ revision: 0, state: { count: 0 } });
    expect(runtime.listControlFlowEvents("root-run")).toEqual([]);
    runtime.close();
    await fixture.close();
  });
});
