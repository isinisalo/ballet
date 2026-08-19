import {
  defaultLoopTheme,
  type LoopRunDetails,
  type OrchestratorRoute,
  type ProjectAutomationConfig,
  type RootRun
} from "@shared/api/workspace-contracts";
import { v11Loop } from "./v11Fixtures";

export function rootEvidence(config: ProjectAutomationConfig): RootRun {
  return {
    rootRunId: "root-run", kind: "loop", targetId: config.loops[0]!.id, source: "manual", status: "running",
    stateRevision: 0, worktreePath: "/tmp/worktree", branch: "codex/test", headSha: "a".repeat(40),
    configHash: "b".repeat(64), snapshotHash: "c".repeat(64), transitionCount: 1,
    executionSnapshot: {
      version: 4, rootLoopId: config.loops[0]!.id,
      project: { checkoutRoot: "/tmp/worktree", headSha: "a".repeat(40), configHash: "b".repeat(64), snapshotHash: "c".repeat(64) },
      orchestrator: structuredClone(config.orchestrator), graph: structuredClone(config.graph), loops: structuredClone(config.loops),
      terminals: ["completed", "blocked", "failed"], theme: structuredClone(defaultLoopTheme), executionProfiles: [], runtimes: [], resources: [],
      createdAt: "2026-08-20T08:00:00.000Z"
    },
    createdAt: "2026-08-20T08:00:00.000Z", updatedAt: "2026-08-20T08:00:01.000Z"
  };
}

export function routeEvidence(loopEdgeId: string, sourceLoopId: string, targetLoopId: string): OrchestratorRoute {
  return {
    routeId: `route-${loopEdgeId}`, rootRunId: "root-run", orchestrationRequestId: "request", kind: "flow",
    orchestratorNodeRunId: "orchestrator-node", loopEdgeId, sourceLoopId, targetLoopId,
    createdAt: "2026-08-20T08:00:01.000Z"
  };
}

export function targetRunEvidence(loop: ReturnType<typeof v11Loop>, route: OrchestratorRoute): LoopRunDetails {
  return {
    loopRunId: "target-loop-run", loopId: loop.id, rootRunId: route.rootRunId, source: "flow", status: "running",
    snapshot: structuredClone(loop), themeSnapshot: structuredClone(defaultLoopTheme), orchestrationRequestId: route.orchestrationRequestId,
    entryStateRevision: 0, nestingDepth: 0, createdAt: "2026-08-20T08:00:01.000Z", updatedAt: "2026-08-20T08:00:02.000Z",
    workLoopNodeRuns: [], nodeRuns: []
  };
}
