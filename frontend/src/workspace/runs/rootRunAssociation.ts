import type { RootRunDetail } from "@shared/api/workspace-contracts";

export function isRootRunDetailForLoop(root: RootRunDetail, loopId: string, rootRunId?: string): boolean {
  return (!rootRunId || root.rootRunId === rootRunId)
    && root.kind === "loop"
    && root.targetId === loopId
    && root.executionSnapshot.rootLoopId === loopId;
}

export function rootRunLoopMismatchMessage(rootRunId: string, loopId: string): string {
  return `Root Run "${rootRunId}" does not belong to Loop "${loopId}".`;
}
