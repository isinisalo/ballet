import { describe, expect, it } from "vitest";
import type {
  LoopRunDetails, ProjectAutomationConfig, ProjectLoop, RootRunDetail
} from "../../shared/api/workspace-contracts.js";
import { defaultLoopTheme } from "../../shared/api/workspace-contracts.js";
import { resolveLoopRunView } from "../src/workspace/automation/loops/loopRunViewModel.js";
import { workflowAutomation, workflowLoop } from "./workflowFixtures.js";

const loop: ProjectLoop = workflowLoop("human-loop");
loop.workflow.jobNodes[0] = { ...loop.workflow.jobNodes[0]!, type: "human" };

const automation: ProjectAutomationConfig = workflowAutomation(loop);

describe("loopRunViewModel", () => {
  it("selects a waiting Human Job Node for a role-specific response", () => {
    const details = loopRunDetails();
    const root = rootDetail(details);
    const view = resolveLoopRunView(automation, loop, [], defaultLoopTheme, details, root);

    expect(view).toMatchObject({ rootActive: true, terminal: false, responseNode: {
      nodeRunId: "work-node", role: "job", status: "waiting_for_input"
    } });
  });

  it("does not expose a completed Validation Node while external repair is pending", () => {
    const details = loopRunDetails();
    details.nodeRuns[0] = {
      ...details.nodeRuns[0]!,
      role: "validation",
      workflowNodeId: "job-validation",
      nodeDefinitionId: "job-validation",
      status: "completed",
      outcome: {
        role: "validation", state: "completed", decision: "FAIL", summary: "Repair required.",
        evidence: {}, checks: [], feedback: "Repair the value.", expectedCorrection: "Validation passes.",
        escalation: { reason: "Specialist required.", requestedCapability: "repair", evidenceRefs: [] }
      },
      stateRevisionAfter: 0,
      completedAt: timestamp
    };
    const root = rootDetail(details);
    root.current = { ...root.current, nodeRunId: "orchestrator-node", nodeRole: "orchestrator" };
    const view = resolveLoopRunView(automation, loop, [], defaultLoopTheme, details, root);

    expect(view.responseNode).toBeUndefined();
  });

  it("renders the active repair Loop from the immutable snapshot instead of mutable project config", () => {
    const details = loopRunDetails();
    const repairLoop = { ...loop, id: "repair-loop", description: "Repair target." };
    const repairDetails = { ...details, loopId: repairLoop.id, snapshot: repairLoop, source: "repair" as const };
    const root = rootDetail(details);
    root.executionSnapshot.loops.push(repairLoop);
    root.loopRuns.push(repairDetails);
    root.current = { ...root.current, loopRunId: repairDetails.loopRunId, loopId: repairLoop.id };
    const liveConfig = {
      ...automation,
      graph: {
        ...automation.graph,
        transitions: [{
          id: "mutable-edge", source: loop.id, decision: "PASS" as const, outcome: "success",
          target: { loopId: repairLoop.id }, description: "Mutable transition."
        }],
        repairEdges: []
      }
    };
    root.executionSnapshot.graph.repairEdges = [{
      id: "repair-edge", source: loop.id, target: repairLoop.id,
      capability: "test:loop.transfer", description: "Snapshotted allowlist."
    }];

    const view = resolveLoopRunView(liveConfig, loop, [], defaultLoopTheme, repairDetails, root);
    expect(view.canvasLoop.id).toBe("repair-loop");
    expect(view.canvasConfig.graph.repairEdges).toEqual(root.executionSnapshot.graph.repairEdges);
  });
});

const timestamp = "2026-01-01T00:00:00.000Z";

const loopRunDetails = (): LoopRunDetails => ({
  loopRunId: "loop-run", loopId: loop.id, rootRunId: "root-run", source: "manual",
  status: "waiting_for_input", snapshot: loop, themeSnapshot: defaultLoopTheme,
  entryStateRevision: 0, nestingDepth: 0, createdAt: timestamp, updatedAt: timestamp,
  jobRuns: [{
    jobRunId: "composite", rootRunId: "root-run", loopRunId: "loop-run",
    loopId: loop.id, jobNodeId: "job", jobAttempt: 1, status: "waiting_for_input",
    stateRevisionBefore: 0, activeNodeRunId: "work-node", createdAt: timestamp, updatedAt: timestamp
  }],
  nodeRuns: [{
    nodeRunId: "work-node", rootRunId: "root-run", loopRunId: "loop-run",
    jobRunId: "composite", role: "job", loopId: loop.id, jobNodeId: "job",
    workflowNodeId: "job", nodeDefinitionId: "job", status: "waiting_for_input", attempt: 1,
    stateRevisionBefore: 0, createdAt: timestamp, updatedAt: timestamp
  }]
});

const rootDetail = (details: LoopRunDetails): RootRunDetail => ({
  rootRunId: "root-run", kind: "loop", targetId: loop.id, source: "manual",
  status: "waiting_for_input", stateRevision: 0, createdAt: timestamp, updatedAt: timestamp,
  current: {
    loopRunId: details.loopRunId, loopId: details.loopId,
    jobRunId: "composite", jobNodeId: "job", nodeRunId: "work-node", nodeRole: "job"
  },
  executionSnapshot: {
    version: 6,
    rootKind: "loop",
    rootLoopId: loop.id,
    project: { checkoutRoot: "/workspace", headSha: "a".repeat(40), configHash: "b".repeat(64), snapshotHash: "c".repeat(64) },
    orchestrator: automation.orchestrator,
    issueTracker: {
      kind: "tk", testedRevision: "d778bb520ee526c314c26f2bb876447e0a19caa5",
      orchestrationDirectory: ".tickets/orchestration", workDirectory: ".tickets/work"
    },
    graph: structuredClone(automation.graph), loops: [loop],
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
