import type { LoopLayoutDirection } from "./loopLayoutTypes";

export const loopNodeSizes = {
  loop: { minWidth: 22, maxWidth: 22, height: 22 },
  action: { minWidth: 22, maxWidth: 22, height: 22 },
  event: { width: 22, height: 22 },
  outputEvent: { minWidth: 22, maxWidth: 22, height: 22, rowGap: 32 }
};

export const loopCanvasLayoutConfig = {
  startX: 72,
  startY: 64,
  columnGap: 72,
  horizontalEdgeGap: 184,
  branchGap: 72,
  edgePad: 18,
  actionAnchorY: 11,
  selectedCompactLoopRowGap: 112,
  compactLoopRowGap: 48,
  outputEventsLaneGap: 24,
  outputEventLaneClearance: 24
};

export const loopDirectionHandles: Record<LoopLayoutDirection, { rankdir: "LR" | "TB"; sourceHandleId: string; targetHandleId: string }> = {
  horizontal: { rankdir: "LR", sourceHandleId: "right", targetHandleId: "left" },
  vertical: { rankdir: "TB", sourceHandleId: "right", targetHandleId: "left" }
};
