import type { LoopLayoutDirection } from "./loopLayoutTypes";
import type { AgentNodeStyle } from "@shared/api/workspace-contracts";

export const loopPlanetNodeSizes: Record<AgentNodeStyle, number> = {
  luna: 28,
  terra: 44,
  sol: 64
};

export const loopNodeSizes = {
  loop: { minWidth: 22, maxWidth: 22, height: 22 },
  step: { minWidth: 28, maxWidth: 64, height: 64 },
  event: { width: 22, height: 22 },
  outputEvent: { minWidth: 22, maxWidth: 22, height: 22, rowGap: 32 }
};

export const loopCanvasLayoutConfig = {
  startX: 120,
  startY: 64,
  columnGap: 72,
  horizontalEdgeGap: 184,
  branchGap: 72,
  edgePad: 18,
  selectedCompactLoopRowGap: 112,
  compactLoopRowGap: 24,
  outputEventsLaneGap: 24,
  outputEventLaneClearance: 24
};

export const loopDirectionHandles: Record<LoopLayoutDirection, { rankdir: "LR" | "TB"; sourceHandleId: string; targetHandleId: string }> = {
  horizontal: { rankdir: "LR", sourceHandleId: "right", targetHandleId: "left" },
  vertical: { rankdir: "TB", sourceHandleId: "right", targetHandleId: "left" }
};
