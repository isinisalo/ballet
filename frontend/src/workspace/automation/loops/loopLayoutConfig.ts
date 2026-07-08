import type { LoopLayoutDirection } from "./loopLayoutTypes";

export const loopNodeSizes = {
  loop: { minWidth: 112, maxWidth: 260, height: 22 },
  inputEvent: { minWidth: 28, maxWidth: 28, height: 22 },
  action: { minWidth: 112, maxWidth: 188, height: 22 },
  event: { width: 240, height: 46 },
  outputEvent: { minWidth: 76, maxWidth: 120, height: 22, rowGap: 32 }
};

export const loopCanvasLayoutConfig = {
  startX: 72,
  startY: 64,
  columnGap: 72,
  horizontalEdgeGap: 64,
  branchGap: 72,
  edgePad: 18,
  inputEventAnchorY: 11,
  actionAnchorY: 11,
  selectedCompactLoopRowGap: 112,
  outputEventsLaneGap: 24,
  outputEventLaneClearance: 24
};

export const loopAddActionGhostLabel = "+ Action";

export const loopDirectionHandles: Record<LoopLayoutDirection, { rankdir: "LR" | "TB"; sourceHandleId: string; targetHandleId: string }> = {
  horizontal: { rankdir: "LR", sourceHandleId: "right", targetHandleId: "left" },
  vertical: { rankdir: "TB", sourceHandleId: "right", targetHandleId: "left" }
};
