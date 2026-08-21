import type { RootRunDetail, RootRunKind } from "@shared/api/workspace-contracts";

export function isRootRunDetailForTarget(
  root: RootRunDetail,
  kind: RootRunKind,
  targetId: string,
  rootRunId?: string
): boolean {
  return (!rootRunId || root.rootRunId === rootRunId)
    && root.kind === kind
    && root.targetId === targetId
    && (kind === "graph"
      ? root.executionSnapshot.graph.id === targetId
      : root.executionSnapshot.rootLoopId === targetId);
}

export function isRootRunDetailForLoop(root: RootRunDetail, loopId: string, rootRunId?: string): boolean {
  return isRootRunDetailForTarget(root, "loop", loopId, rootRunId);
}

export function rootRunLoopMismatchMessage(rootRunId: string, loopId: string): string {
  return `Root Run "${rootRunId}" does not belong to Loop "${loopId}".`;
}
