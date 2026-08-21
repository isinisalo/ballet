import {
  defaultLoopTheme,
  type LoopRunDetails,
  type OrchestratorRoute,
  type ProjectAutomationConfig,
  type RootRun
} from "@shared/api/workspace-contracts";
import { workflowLoop } from "./workflowFixtures";

export function rootEvidence(config: ProjectAutomationConfig): RootRun {
  return {
    rootRunId: "root-run", kind: "loop", targetId: config.loops[0]!.id, source: "manual", status: "running",
    stateRevision: 0, worktreePath: "/tmp/worktree", branch: "codex/test", headSha: "a".repeat(40),
    configHash: "b".repeat(64), snapshotHash: "c".repeat(64), transitionCount: 1,
    executionSnapshot: {
      version: 6, rootKind: "loop", rootLoopId: config.loops[0]!.id,
      project: { checkoutRoot: "/tmp/worktree", headSha: "a".repeat(40), configHash: "b".repeat(64), snapshotHash: "c".repeat(64) },
      orchestrator: structuredClone(config.orchestrator), graph: structuredClone(config.graph), loops: structuredClone(config.loops),
      issueTracker: {
        kind: "tk", testedRevision: "d778bb520ee526c314c26f2bb876447e0a19caa5",
        orchestrationDirectory: ".tickets/orchestration", workDirectory: ".tickets/work"
      },
      theme: structuredClone(defaultLoopTheme), executionProfiles: [], runtimes: [], resources: [],
      createdAt: "2026-08-20T08:00:00.000Z"
    },
    createdAt: "2026-08-20T08:00:00.000Z", updatedAt: "2026-08-20T08:00:01.000Z"
  };
}

export function routeEvidence(loopEdgeId: string, sourceLoopId: string, targetLoopId: string): OrchestratorRoute {
  return {
    routeId: `route-${loopEdgeId}`, rootRunId: "root-run", orchestrationRequestId: "request", kind: "repair",
    orchestratorNodeRunId: "orchestrator-node", loopEdgeId, sourceLoopId, targetLoopId,
    createdAt: "2026-08-20T08:00:01.000Z"
  };
}

export function targetRunEvidence(loop: ReturnType<typeof workflowLoop>, route: OrchestratorRoute): LoopRunDetails {
  return {
    loopRunId: "target-loop-run", loopId: loop.id, rootRunId: route.rootRunId, source: "repair", status: "running",
    snapshot: structuredClone(loop), themeSnapshot: structuredClone(defaultLoopTheme), orchestrationRequestId: route.orchestrationRequestId,
    entryStateRevision: 0, nestingDepth: 1, createdAt: "2026-08-20T08:00:01.000Z", updatedAt: "2026-08-20T08:00:02.000Z",
    jobRuns: [], nodeRuns: []
  };
}
