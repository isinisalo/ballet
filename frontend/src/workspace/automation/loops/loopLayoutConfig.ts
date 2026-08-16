import { loopNodeSizeCatalog } from "@shared/api/workspace-contracts";
import type { LoopLayoutDirection } from "./loopLayoutTypes";

export const loopNodeSizes = {
  loop: { minWidth: 22, maxWidth: 22, height: 22 },
  workLoopNode: {
    minWidth: loopNodeSizeCatalog.tiny.pixels,
    maxWidth: loopNodeSizeCatalog.large.pixels,
    height: loopNodeSizeCatalog.large.pixels
  },
  event: { width: 22, height: 22 }
};

export const loopCanvasLayoutConfig = {
  startX: 120,
  startY: 64,
  columnGap: 72,
  horizontalEdgeGap: 208,
  branchGap: 72,
  selectedCompactLoopRowGap: 112,
  compactLoopRowGap: 24
};

export const loopDirectionHandles: Record<LoopLayoutDirection, { rankdir: "LR" | "TB"; sourceHandleId: string; targetHandleId: string }> = {
  horizontal: { rankdir: "LR", sourceHandleId: "right", targetHandleId: "left" },
  vertical: { rankdir: "TB", sourceHandleId: "right", targetHandleId: "left" }
};
