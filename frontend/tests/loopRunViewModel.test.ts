import { describe, expect, it } from "vitest";
import type {
  LoopRunDetails, ProjectAutomationConfig, ProjectLoop, RootRunDetail
} from "../../shared/api/workspace-contracts.js";
import { defaultLoopTheme } from "../../shared/api/workspace-contracts.js";
import { resolveLoopRunView } from "../src/workspace/automation/loops/loopRunViewModel.js";

const loop: ProjectLoop = {
  id: "human-loop",
  description: "Human Loop.",
  state: { description: "State.", initial: {} },
  startNodeId: "work",
  nodes: [{
    id: "work",
    description: "Human Work Loop Node.",
    work: { type: "human", task: "Do work.", nodeStyle: "terra", nodeSize: "medium" },
    validation: { type: "human", task: "Validate.", nodeStyle: "luna", nodeSize: "small" },
    maxLocalAttempts: 3
  }],
  edges: [{ id: "done", source: "work", target: { terminal: "completed" } }]
};

const automation: ProjectAutomationConfig = {
  version: 10,
  orchestrator: {
    executionProfileId: "profile", primaryInstructionId: "project:orchestrator",
    skillIds: [], maxRepairDepth: 3, maxRepairAttempts: 3
  },
  loops: [loop],
  loopEdges: []
};

describe("loopRunViewModel", () => {
  it("selects a waiting Human Work Node for a role-specific response", () => {
    const details = loopRunDetails();
    const root = rootDetail(details);
    const view = resolveLoopRunView(automation, loop, [], defaultLoopTheme, details, root);

    expect(view).toMatchObject({ rootActive: true, terminal: false, responseNode: {
      nodeRunId: "work-node", role: "work", status: "waiting_for_input"
    } });
  });

  it("does not expose a completed Validation Node while external repair is pending", () => {
    const details = loopRunDetails();
    details.nodeRuns[0] = {
      ...details.nodeRuns[0]!,
      role: "validation",
      nodeDefinitionId: "human-loop:work:validation",
      status: "completed",
      outcome: {
        role: "validation", state: "completed", decision: "FAIL", summary: "Repair required.",
        evidence: {}, checks: [], repair: {
          mode: "ORCHESTRATOR_REPAIR", reason: "Specialist required.",
          requestedCapability: "repair", evidenceRefs: []
        }
      },
      stateRevisionAfter: 0,
      completedAt: timestamp
    };
    const root = rootDetail(details);
    root.current = { ...root.current, nodeRunId: "orchestrator-node", nodeRole: "orchestrator" };
    const view = resolveLoopRunView(automation, loop, [], defaultLoopTheme, details, root);

    expect(view.responseNode).toBeUndefined();
  });
});

const timestamp = "2026-01-01T00:00:00.000Z";

const loopRunDetails = (): LoopRunDetails => ({
  loopRunId: "loop-run", loopId: loop.id, rootRunId: "root-run", source: "manual",
  status: "waiting_for_input", snapshot: loop, themeSnapshot: defaultLoopTheme,
  entryStateRevision: 0, nestingDepth: 0, createdAt: timestamp, updatedAt: timestamp,
  workLoopNodeRuns: [{
    workLoopNodeRunId: "composite", rootRunId: "root-run", loopRunId: "loop-run",
    loopId: loop.id, workLoopNodeId: "work", attempt: 1, status: "waiting_for_input",
    stateRevisionBefore: 0, activeNodeRunId: "work-node", createdAt: timestamp, updatedAt: timestamp
  }],
  nodeRuns: [{
    nodeRunId: "work-node", rootRunId: "root-run", loopRunId: "loop-run",
    workLoopNodeRunId: "composite", role: "work", loopId: loop.id, workLoopNodeId: "work",
    nodeDefinitionId: "human-loop:work:work", status: "waiting_for_input", attempt: 1,
    stateRevisionBefore: 0, createdAt: timestamp, updatedAt: timestamp
  }]
});

const rootDetail = (details: LoopRunDetails): RootRunDetail => ({
  rootRunId: "root-run", kind: "loop", targetId: loop.id, source: "manual",
  status: "waiting_for_input", stateRevision: 0, createdAt: timestamp, updatedAt: timestamp,
  current: {
    loopRunId: details.loopRunId, loopId: details.loopId,
    workLoopNodeRunId: "composite", workLoopNodeId: "work", nodeRunId: "work-node", nodeRole: "work"
  },
  executionSnapshot: {
    version: 3,
    rootLoopId: loop.id,
    project: { checkoutRoot: "/workspace", headSha: "a".repeat(40), configHash: "b".repeat(64), snapshotHash: "c".repeat(64) },
    orchestrator: automation.orchestrator,
    loops: [loop], loopEdges: [], terminals: ["completed", "blocked", "failed"],
    theme: defaultLoopTheme, executionProfiles: [], runtimes: [], resources: [], createdAt: timestamp
  },
  loopRuns: [details],
  tasks: [],
  state: {
    currentRevision: 0, currentState: {}, currentStateSha256: "a".repeat(64),
    revisions: [], totalRevisionCount: 1, historyTruncated: false
  },
  repair: { requests: [], routes: [], continuations: [], results: [], activeContinuationChain: [] },
  controlFlowEvents: []
});
