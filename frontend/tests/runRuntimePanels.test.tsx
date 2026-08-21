import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
import { RunVisualWorkspace, runMissionNarration } from "../src/workspace/automation/loops/RunVisualWorkspace.js";
import { workflowLoop } from "./workflowFixtures.js";

describe("Run canonical runtime panels", () => {
  it("renders persisted position, repair route, timeline, and State evidence", () => {
    const root = runDetail();
    render(<><RunStatusSummary root={root} /><RunLoopMap root={root} /><RunTimeline root={root} /><RunStatePanel root={root} /></>);

    expect(screen.getByText("main-loop · Main Loop description.")).toBeInTheDocument();
    expect(screen.getAllByText("Validation").length).toBeGreaterThan(0);
    expect(screen.getByText("repair-request")).toBeInTheDocument();
    expect(screen.getAllByText("main-loop").length).toBeGreaterThan(0);
    expect(screen.getByText("Return path (LIFO)")).toBeInTheDocument();
    expect(screen.getByText("Job completed")).toBeInTheDocument();
    expect(screen.getByText("Validation completed · FAIL")).toBeInTheDocument();
    expect(screen.getByText(/"count": 1/)).toBeInTheDocument();
    expect(screen.getByText(/Validation · job-validation/)).toBeInTheDocument();
  });

  it("switches between the focused All Loops map and playful mission canvas without inventing telemetry", async () => {
    const user = userEvent.setup();
    const root = runDetail();
    render(<RunVisualWorkspace root={root}><div data-testid="canonical-loop-canvas">Canvas</div></RunVisualWorkspace>);

    expect(screen.getByRole("tab", { name: "All Loops" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "All Loops · focused Run map" })).toBeInTheDocument();
    expect(screen.getByLabelText("Live Run inspector")).toHaveTextContent("waiting_for_input");
    expect(screen.getByLabelText("Live Run inspector")).toHaveTextContent("r1");

    await user.click(screen.getByRole("tab", { name: "Mission" }));
    expect(screen.getByTestId("canonical-loop-canvas")).toBeInTheDocument();
    expect(screen.getByText("Validating “Execute the Job.”")).toBeInTheDocument();
    expect(runMissionNarration(root)).toBe("Validating “Execute the Job.”");
    expect(screen.queryByText(/elapsed|percent|ETA/i)).not.toBeInTheDocument();
  });
});

const timestamp = "2026-08-16T06:00:00.000Z";
const loop: ProjectLoop = workflowLoop("main-loop");
loop.description = "Main Loop description.";
loop.state = { description: "Canonical count.", initial: { count: 0 } };
loop.workflow.jobNodes[0] = { ...loop.workflow.jobNodes[0]!, type: "human" };

const runDetail = (): RootRunDetail => ({
  rootRunId: "root-run", kind: "loop", targetId: loop.id, source: "manual",
  status: "waiting_for_input", stateRevision: 1, createdAt: timestamp, updatedAt: timestamp,
  current: {
    loopRunId: "loop-run", loopId: loop.id, loopDescription: loop.description,
    jobRunId: "job-run", jobNodeId: "job", jobNodeDescription: "Execute the Job.",
    nodeRunId: "validation", nodeRole: "validation", jobAttempt: 1, repairDepth: 1,
    repairRequestId: "repair-request", routedTargetLoopId: loop.id,
    returnDestination: { loopId: loop.id, jobNodeId: "job", validationNodeDefinitionId: "job-validation" }
  },
  executionSnapshot: {
    version: 6, rootKind: "loop", rootLoopId: loop.id,
    project: { checkoutRoot: "/workspace", headSha: "a".repeat(40), configHash: "b".repeat(64), snapshotHash: "c".repeat(64) },
    orchestrator: {
      mode: "runbook", maxTransitions: 256,
      repairRouter: { executionProfileId: "profile", primaryInstructionId: "project:orchestrator", skillIds: [], maxRepairDepth: 3, maxRepairAttempts: 3 }
    },
    issueTracker: {
      kind: "tk", testedRevision: "d778bb520ee526c314c26f2bb876447e0a19caa5",
      orchestrationDirectory: ".tickets/orchestration", workDirectory: ".tickets/work"
    },
    graph: {
      id: "test-graph", name: "Test Graph", startLoopId: loop.id, transitions: [], repairEdges: [{
        id: "repair-edge", source: loop.id, target: loop.id,
        capability: "test:loop.transfer", description: "Repair self-route."
      }]
    }, loops: [loop],
    theme: defaultLoopTheme,
    executionProfiles: [], runtimes: [], resources: [], createdAt: timestamp
  },
  loopRuns: [{
    loopRunId: "loop-run", loopId: loop.id, rootRunId: "root-run", source: "manual",
    status: "waiting_for_input", snapshot: loop, themeSnapshot: defaultLoopTheme,
    entryStateRevision: 0, nestingDepth: 0, createdAt: timestamp, updatedAt: timestamp,
    jobRuns: [{
      jobRunId: "job-run", rootRunId: "root-run", loopRunId: "loop-run", loopId: loop.id,
      jobNodeId: "job", jobAttempt: 1, status: "waiting_for_input", stateRevisionBefore: 0,
      stateRevisionAfter: 1, activeNodeRunId: "validation", createdAt: timestamp, updatedAt: timestamp
    }],
    nodeRuns: [{
      nodeRunId: "job-node", rootRunId: "root-run", loopRunId: "loop-run", jobRunId: "job-run",
      role: "job", loopId: loop.id, jobNodeId: "job", workflowNodeId: "job", nodeDefinitionId: "job",
      status: "completed", attempt: 1, stateRevisionBefore: 0, stateRevisionAfter: 1,
      outcome: { role: "job", state: "completed", summary: "Job completed.", artifacts: {}, checks: [] },
      createdAt: timestamp, updatedAt: timestamp, completedAt: timestamp
    }, {
      nodeRunId: "validation", rootRunId: "root-run", loopRunId: "loop-run", jobRunId: "job-run",
      role: "validation", loopId: loop.id, jobNodeId: "job", workflowNodeId: "job-validation", nodeDefinitionId: "job-validation",
      status: "completed", attempt: 1, stateRevisionBefore: 1, stateRevisionAfter: 1,
      outcome: { role: "validation", state: "completed", decision: "FAIL", summary: "External repair.", evidence: {}, checks: [],
        feedback: "Repair the state.", expectedCorrection: "Validation passes.",
        escalation: { reason: "Repair required.", requestedCapability: "repair", evidenceRefs: [] }
      }, createdAt: timestamp, updatedAt: timestamp, completedAt: timestamp
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
    requesterJobRunId: "job-run", requesterValidationNodeRunId: "validation",
    attempt: 1, validationSummary: "External repair.", requestedCapability: "repair", reason: "Repair required.",
    stateRevisionAtRequest: 1, routedLoopEdgeId: "repair-edge", routedTargetLoopId: "main-loop", status: "routed" as const,
    returnLoopId: "main-loop", returnJobNodeId: "job", returnValidationNodeDefinitionId: "job-validation",
    nestingDepth: 1, createdAt: timestamp, updatedAt: timestamp
  };
  const route = { routeId: "route", rootRunId: "root-run", repairRequestId: request.repairRequestId,
    orchestratorNodeRunId: "orchestrator", loopEdgeId: "repair-edge", sourceLoopId: "main-loop", targetLoopId: "main-loop", createdAt: timestamp };
  const frame = { frameId: "frame", rootRunId: "root-run", repairRequestId: request.repairRequestId, routeId: route.routeId,
    callerLoopRunId: "loop-run", calleeLoopRunId: "repair-run", returnLoopId: "main-loop", returnJobNodeId: "job",
    returnValidationNodeDefinitionId: "job-validation", stateRevisionAtCall: 1, nestingDepth: 1,
    status: "open" as const, createdAt: timestamp, updatedAt: timestamp };
  return { requests: [request], routes: [route], continuations: [frame], results: [], activeContinuationChain: [frame],
    pendingRepair: request, routedTarget: route,
    returnDestination: { loopId: "main-loop", jobNodeId: "job", validationNodeDefinitionId: "job-validation" } };
};
