import { describe, expect, it } from "vitest";
import { createNodeTaskEnvelope } from "../runs/NodeExecutionPlan.js";
import { RootRunStore } from "../runs/RootRunStore.js";
import { testJobPair, testLoop } from "../tests/v13TestConfig.js";
import {
  activeNode, completeActiveLoop, createOrchestrationHarness,
  requestExternalRepair, routeRepair, validationPass
} from "./LoopOrchestrator.test-support.js";

describe("LoopOrchestrator call and return", () => {
  it("records the Repair Request at the committed post-Validation State revision", async () => {
    const harness = await createOrchestrationHarness();
    const { runtime } = harness;
    runtime.startLoopRun("root-run");
    const job = activeNode(runtime);
    runtime.applyNodeOutcome("root-run", job.nodeRunId, {
      role: "job", state: "completed", summary: "Caller Job updated State.", artifacts: {}, checks: [],
      statePatch: [{ op: "replace", path: "/repaired", value: true }]
    });
    const validation = activeNode(runtime);
    runtime.applyNodeOutcome("root-run", validation.nodeRunId, {
      role: "validation", state: "completed", decision: "FAIL",
      summary: "Caller validation found a repairable problem.", evidence: {}, checks: [],
      feedback: "Fix it.", expectedCorrection: "Correct it.",
      escalation: { reason: "External repair is required.", requestedCapability: "repair capability", evidenceRefs: [] }
    });
    const orchestrator = activeNode(runtime);
    const requestId = runtime.connection().prepare(`
      SELECT repair_request_id FROM repair_requests WHERE orchestrator_node_run_id = ?
    `).pluck().get(orchestrator.nodeRunId);
    if (typeof requestId !== "string") throw new Error("Test Repair Request was not created.");
    const request = runtime.getRepairRequest(requestId)!;

    expect(request).toMatchObject({ stateRevisionAtRequest: 1 });
    expect(runtime.state.current("root-run")).toMatchObject({ revision: 1, state: { repaired: true } });
    expect(runtime.listControlFlowEvents("root-run").at(-1)).toMatchObject({
      kind: "validation_fail_escalated", stateRevision: 1,
      repairRequestId: request.repairRequestId
    });
    runtime.close();
    await harness.close();
  });

  it("routes through the immutable allowlist and returns to the caller Validation with shared State", async () => {
    const harness = await createOrchestrationHarness();
    const { runtime } = harness;
    runtime.startLoopRun("root-run");
    const requested = requestExternalRepair(runtime);

    const root = new RootRunStore(() => runtime.connection()).require("root-run");
    const callerRun = runtime.listRootLoopRuns("root-run")[0]!;
    const envelope = createNodeTaskEnvelope({
      root, run: callerRun, node: requested.orchestrator,
      state: runtime.state.current("root-run"), events: runtime.listControlFlowEvents("root-run"),
      orchestrationRequest: requested.orchestrationRequest
    });
    expect(envelope).toMatchObject({
      role: "orchestrator",
      orchestrationRequest: {
        id: requested.orchestrationRequest.orchestrationRequestId,
        kind: "repair",
        completionSummary: "Caller validation found a repairable problem.",
        requestedCapability: "test:loop.transfer",
      },
      allowedCandidates: [
        { id: "repair-a", route: { kind: "repair", capability: "test:loop.transfer", description: "Allow repair-a." } },
        { id: "repair-b", route: { kind: "repair", capability: "test:loop.transfer", description: "Allow repair-b." } }
      ]
    });

    const target = routeRepair(runtime, requested.orchestrator, "repair-b");
    expect(target).toMatchObject({
      loopId: "repair-b", source: "repair", parentLoopRunId: callerRun.loopRunId,
      repairRequestId: requested.request.repairRequestId, entryStateRevision: 0, nestingDepth: 1
    });
    expect(runtime.getOrchestrationFrame(target.orchestrationFrameId!)).toMatchObject({
      callerLoopRunId: callerRun.loopRunId, calleeLoopRunId: target.loopRunId,
      returnLoopId: "caller-loop", returnJobNodeId: "caller-job", nestingDepth: 1, status: "open"
    });

    completeActiveLoop(runtime, { patch: {
      role: "job", state: "completed", summary: "Repair changed shared State.", artifacts: {}, checks: [],
      statePatch: [{ op: "replace", path: "/repaired", value: true }]
    } });
    const returned = activeNode(runtime);
    expect(returned).toMatchObject({
      role: "validation", loopId: "caller-loop", jobNodeId: "caller-job",
      jobRunId: requested.validation.jobRunId,
      stateRevisionBefore: 1, attempt: 2
    });
    expect(returned.context).toMatchObject({
      repairReturn: {
        repairRequest: { id: requested.request.repairRequestId },
        repairResult: { targetLoopRunId: target.loopRunId, targetLoopId: "repair-b", stateRevision: 1 }
      }
    });
    expect(runtime.state.current("root-run")).toMatchObject({ revision: 1, state: { repaired: true } });
    expect(runtime.listRepairResults("root-run")).toEqual([
      expect.objectContaining({ status: "repaired", targetLoopId: "repair-b", stateRevision: 1 })
    ]);
    expect(runtime.getRepairRequest(requested.request.repairRequestId)).toMatchObject({ status: "repaired" });
    expect(runtime.getOrchestrationFrame(target.orchestrationFrameId!)).toMatchObject({ status: "returned" });

    runtime.applyNodeOutcome("root-run", returned.nodeRunId, validationPass("Caller accepts repaired State."));
    expect(runtime.listRootLoopRuns("root-run")[0]).toMatchObject({ status: "completed" });
    expect(runtime.listControlFlowEvents("root-run").map(({ kind }) => kind)).toEqual([
      "job_completed", "validation_fail_escalated", "repair_call",
      "job_completed", "validation_pass", "repair_return", "validation_pass"
    ]);
    runtime.close();
    await harness.close();
  });
});

describe("LoopOrchestrator route rejection", () => {
  it.each([
    ["unknown-loop", "unknown snapshot Loop"],
    ["not-allowed", "not an unambiguous allowed repair target"]
  ])("fails closed for invalid target %s", async (targetLoopId, message) => {
    const notAllowed = harnesslessLoop("not-allowed");
    const harness = await createOrchestrationHarness({
      targets: targetLoopId === "not-allowed" ? [harnesslessLoop("repair-a"), notAllowed] : [harnesslessLoop("repair-a")],
      edges: [
        { id: "allowed", source: "caller-loop", target: "repair-a", capability: "test:loop.transfer", description: "Allowed." },
        ...(targetLoopId === "not-allowed" ? [{
          id: "nested-not-allowed", source: "repair-a", target: "not-allowed",
          capability: "test:loop.transfer", description: "Reachable nested target."
        }] : [])
      ],
      transitions: targetLoopId === "not-allowed" ? [{
        id: "reachable-not-allowed", source: "repair-a", decision: "PASS", outcome: "success",
        target: { loopId: "not-allowed" }, description: "Reachable but not a caller repair target."
      }] : []
    });
    const { runtime } = harness;
    runtime.startLoopRun("root-run");
    const { orchestrator, request } = requestExternalRepair(runtime);
    const caller = runtime.applyNodeOutcome("root-run", orchestrator.nodeRunId, {
      role: "orchestrator", state: "completed", targetLoopId,
      routeReason: "Invalid selection.", dispatchInput: {}, expectedOutcome: {}
    });

    expect(caller).toMatchObject({ status: "failed" });
    expect(runtime.getRepairRequest(request.repairRequestId)).toMatchObject({ status: "failed" });
    expect(runtime.listRootLoopRuns("root-run")).toHaveLength(1);
    expect(activeError(runtime)).toContain(message);
    expect(runtime.getNodeRun(orchestrator.nodeRunId)?.outcome).toMatchObject({
      role: "orchestrator", state: "completed", targetLoopId
    });
    expect(runtime.listControlFlowEvents("root-run").at(-1)).toMatchObject({ kind: "orchestrator_terminal" });
    runtime.close();
    await harness.close();
  });
});

describe("LoopOrchestrator self and flow precedence", () => {
  it("allows an explicit repair self-edge as a nested invocation", async () => {
    const harness = await createOrchestrationHarness({ targets: [], edges: [{
      id: "self", source: "caller-loop", target: "caller-loop", capability: "test:loop.transfer", description: "Self repair."
    }] });
    const { runtime } = harness;
    runtime.startLoopRun("root-run");
    const { orchestrator } = requestExternalRepair(runtime);
    const target = routeRepair(runtime, orchestrator, "caller-loop");
    expect(target).toMatchObject({ loopId: "caller-loop", source: "repair", nestingDepth: 1 });
    expect(target.loopRunId).not.toBe(runtime.listRootLoopRuns("root-run")[0]?.loopRunId);
    runtime.close();
    await harness.close();
  });

  it("returns from a repair target before considering that target's normal flow Loop Edge", async () => {
    const repairA = harnesslessLoop("repair-a");
    const repairB = harnesslessLoop("repair-b");
    const harness = await createOrchestrationHarness({
      targets: [repairA, repairB],
      edges: [{
        id: "caller-a", source: "caller-loop", target: "repair-a",
        capability: "test:loop.transfer", description: "Repair in A."
      }, {
        id: "a-b-repair", source: "repair-a", target: "repair-b",
        capability: "test:loop.transfer", description: "Keep B in the repair snapshot."
      }],
      transitions: [{
        id: "a-b-flow", source: "repair-a", decision: "PASS", outcome: "success",
        target: { loopId: "repair-b" }, description: "Normal A to B transition."
      }]
    });
    const { runtime } = harness;
    runtime.startLoopRun("root-run");
    const requested = requestExternalRepair(runtime);
    routeRepair(runtime, requested.orchestrator, "repair-a");
    completeActiveLoop(runtime);

    expect(runtime.listRootLoopRuns("root-run").map(({ loopId }) => loopId))
      .toEqual(["caller-loop", "repair-a"]);
    expect(activeNode(runtime)).toMatchObject({ role: "validation", loopId: "caller-loop" });
    runtime.close();
    await harness.close();
  });
});

describe("LoopOrchestrator terminal outcomes", () => {
  it.each(["blocked", "failed"] as const)("propagates Orchestrator %s without fallback routing", async (state) => {
    const harness = await createOrchestrationHarness();
    const { runtime } = harness;
    runtime.startLoopRun("root-run");
    const { orchestrator, request } = requestExternalRepair(runtime);
    const caller = runtime.applyNodeOutcome("root-run", orchestrator.nodeRunId, {
      role: "orchestrator", state, summary: `Orchestrator ${state}.`
    });
    expect(caller).toMatchObject({ status: state });
    expect(runtime.getRepairRequest(request.repairRequestId)).toMatchObject({ status: "failed" });
    expect(runtime.listRootLoopRuns("root-run")).toHaveLength(1);
    runtime.close();
    await harness.close();
  });

  it.each(["blocked", "failed"] as const)("persists repair target %s and propagates it to caller", async (state) => {
    const harness = await createOrchestrationHarness();
    const { runtime } = harness;
    runtime.startLoopRun("root-run");
    const { orchestrator, request } = requestExternalRepair(runtime);
    const target = routeRepair(runtime, orchestrator, "repair-a");
    const job = activeNode(runtime);
    runtime.applyNodeOutcome("root-run", job.nodeRunId, {
      role: "job", state, summary: `Target ${state}.`, checks: []
    });
    const runs = runtime.listRootLoopRuns("root-run");
    expect(runs.find(({ loopRunId }) => loopRunId === target.loopRunId)).toMatchObject({ status: state });
    expect(runs[0]).toMatchObject({ status: state });
    expect(runtime.getRepairRequest(request.repairRequestId)).toMatchObject({ status: "failed" });
    expect(runtime.listRepairResults("root-run")).toEqual([
      expect.objectContaining({ status: state, targetLoopRunId: target.loopRunId })
    ]);
    expect(runtime.listControlFlowEvents("root-run").at(-1)).toMatchObject({ kind: "repair_terminal" });
    runtime.close();
    await harness.close();
  });
});

const harnesslessLoop = (id: string) => testLoop(id, testJobPair(`${id}-job`, { maxRetries: 0 }));

const activeError = (runtime: import("../runtime-db.js").RuntimeDatabase): string => {
  const value = runtime.connection().prepare(`
    SELECT error_message FROM root_runs WHERE root_run_id = 'root-run'
  `).pluck().get();
  return typeof value === "string" ? value : "";
};
