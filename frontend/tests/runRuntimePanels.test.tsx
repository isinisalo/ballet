import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  defaultLoopTheme,
  type ProjectLoop,
  type RootRunDetail
} from "../../shared/api/workspace-contracts.js";
import { RunLoopMap } from "../src/workspace/automation/loops/RunLoopMap.js";
import { RunStatePanel } from "../src/workspace/automation/loops/RunStatePanel.js";
import { RunStatusSummary } from "../src/workspace/automation/loops/RunStatusSummary.js";
import { RunTimeline } from "../src/workspace/automation/loops/RunTimeline.js";

describe("Run canonical runtime panels", () => {
  it("renders persisted position, repair route, timeline, and State evidence", () => {
    const root = runDetail();
    render(<><RunStatusSummary root={root} /><RunLoopMap root={root} /><RunTimeline root={root} /><RunStatePanel root={root} /></>);

    expect(screen.getByText("main-loop · Main Loop description.")).toBeInTheDocument();
    expect(screen.getAllByText("Validation").length).toBeGreaterThan(0);
    expect(screen.getByText("repair-request")).toBeInTheDocument();
    expect(screen.getAllByText("main-loop").length).toBeGreaterThan(0);
    expect(screen.getByText("Return path (LIFO)")).toBeInTheDocument();
    expect(screen.getByText("Work completed")).toBeInTheDocument();
    expect(screen.getByText("Validation completed · FAIL")).toBeInTheDocument();
    expect(screen.getByText(/"count": 1/)).toBeInTheDocument();
    expect(screen.getByText(/Validation · main-loop:work:validation/)).toBeInTheDocument();
  });
});

const timestamp = "2026-08-16T06:00:00.000Z";
const loop: ProjectLoop = {
  id: "main-loop", description: "Main Loop description.",
  state: { description: "Canonical count.", initial: { count: 0 } }, startNodeId: "work",
  nodes: [{
    id: "work", description: "Composite work.",
    work: { type: "human", task: "Work.", nodeStyle: "terra", nodeSize: "medium" },
    validation: { type: "human", task: "Validate.", nodeStyle: "luna", nodeSize: "small" },
    maxLocalAttempts: 3
  }],
  edges: [{ id: "done", source: "work", target: { terminal: "completed" } }]
};

const runDetail = (): RootRunDetail => ({
  rootRunId: "root-run", kind: "loop", targetId: loop.id, source: "manual",
  status: "waiting_for_input", stateRevision: 1, createdAt: timestamp, updatedAt: timestamp,
  current: {
    loopRunId: "loop-run", loopId: loop.id, loopDescription: loop.description,
    workLoopNodeRunId: "composite", workLoopNodeId: "work", workLoopNodeDescription: "Composite work.",
    nodeRunId: "validation", nodeRole: "validation", localRetryAttempt: 1, repairDepth: 1,
    repairRequestId: "repair-request", routedTargetLoopId: loop.id,
    returnDestination: { loopId: loop.id, workLoopNodeId: "work", validationNodeDefinitionId: "main-loop:work:validation" }
  },
  executionSnapshot: {
    version: 3, rootLoopId: loop.id,
    project: { checkoutRoot: "/workspace", headSha: "a".repeat(40), configHash: "b".repeat(64), snapshotHash: "c".repeat(64) },
    orchestrator: { executionProfileId: "profile", primaryInstructionId: "project:orchestrator", skillIds: [], maxRepairDepth: 3, maxRepairAttempts: 3 },
    loops: [loop], loopEdges: [{ id: "repair-edge", source: loop.id, target: loop.id, kind: "repair", description: "Repair self-route." }],
    terminals: ["completed", "blocked", "failed"], theme: defaultLoopTheme,
    executionProfiles: [], runtimes: [], resources: [], createdAt: timestamp
  },
  loopRuns: [{
    loopRunId: "loop-run", loopId: loop.id, rootRunId: "root-run", source: "manual",
    status: "waiting_for_input", snapshot: loop, themeSnapshot: defaultLoopTheme,
    entryStateRevision: 0, nestingDepth: 0, createdAt: timestamp, updatedAt: timestamp,
    workLoopNodeRuns: [{
      workLoopNodeRunId: "composite", rootRunId: "root-run", loopRunId: "loop-run", loopId: loop.id,
      workLoopNodeId: "work", attempt: 1, status: "waiting_for_input", stateRevisionBefore: 0,
      stateRevisionAfter: 1, activeNodeRunId: "validation", createdAt: timestamp, updatedAt: timestamp
    }],
    nodeRuns: [{
      nodeRunId: "work-node", rootRunId: "root-run", loopRunId: "loop-run", workLoopNodeRunId: "composite",
      role: "work", loopId: loop.id, workLoopNodeId: "work", nodeDefinitionId: "main-loop:work:work",
      status: "completed", attempt: 1, stateRevisionBefore: 0, stateRevisionAfter: 1,
      outcome: { role: "work", state: "completed", summary: "Work completed.", artifacts: {}, checks: [] },
      createdAt: timestamp, updatedAt: timestamp, completedAt: timestamp
    }, {
      nodeRunId: "validation", rootRunId: "root-run", loopRunId: "loop-run", workLoopNodeRunId: "composite",
      role: "validation", loopId: loop.id, workLoopNodeId: "work", nodeDefinitionId: "main-loop:work:validation",
      status: "completed", attempt: 1, stateRevisionBefore: 1, stateRevisionAfter: 1,
      outcome: { role: "validation", state: "completed", decision: "FAIL", summary: "External repair.", evidence: {}, checks: [], repair: {
        mode: "ORCHESTRATOR_REPAIR", reason: "Repair required.", requestedCapability: "repair", evidenceRefs: []
      } }, createdAt: timestamp, updatedAt: timestamp, completedAt: timestamp
    }]
  }], tasks: [],
  state: {
    currentRevision: 1, currentState: { count: 1 }, currentStateSha256: "d".repeat(64), totalRevisionCount: 2,
    historyTruncated: false, revisions: [{ rootRunId: "root-run", revision: 1, parentRevision: 0,
      stateSha256: "d".repeat(64), sourceNodeRunId: "validation", patchOmitted: false,
      patch: { patch: [{ op: "replace", path: "/count", value: 1 }], patchSha256: "e".repeat(64) }, createdAt: timestamp }]
  },
  repair: repairProjection(), controlFlowEvents: []
});

const repairProjection = (): RootRunDetail["repair"] => {
  const request = {
    repairRequestId: "repair-request", rootRunId: "root-run", requesterLoopRunId: "loop-run",
    requesterWorkLoopNodeRunId: "composite", requesterValidationNodeRunId: "validation", mode: "orchestrator" as const,
    attempt: 1, validationSummary: "External repair.", requestedCapability: "repair", reason: "Repair required.",
    stateRevisionAtRequest: 1, routedLoopEdgeId: "repair-edge", routedTargetLoopId: "main-loop", status: "routed" as const,
    returnLoopId: "main-loop", returnWorkLoopNodeId: "work", returnValidationNodeDefinitionId: "main-loop:work:validation",
    nestingDepth: 1, createdAt: timestamp, updatedAt: timestamp
  };
  const route = { routeId: "route", rootRunId: "root-run", repairRequestId: request.repairRequestId,
    orchestratorNodeRunId: "orchestrator", loopEdgeId: "repair-edge", sourceLoopId: "main-loop", targetLoopId: "main-loop", createdAt: timestamp };
  const frame = { frameId: "frame", rootRunId: "root-run", repairRequestId: request.repairRequestId, routeId: route.routeId,
    callerLoopRunId: "loop-run", calleeLoopRunId: "repair-run", returnLoopId: "main-loop", returnWorkLoopNodeId: "work",
    returnValidationNodeDefinitionId: "main-loop:work:validation", stateRevisionAtCall: 1, nestingDepth: 1,
    status: "open" as const, createdAt: timestamp, updatedAt: timestamp };
  return { requests: [request], routes: [route], continuations: [frame], results: [], activeContinuationChain: [frame],
    pendingRepair: request, routedTarget: route,
    returnDestination: { loopId: "main-loop", workLoopNodeId: "work", validationNodeDefinitionId: "main-loop:work:validation" } };
};
