import type { WorkflowLayoutDirection } from "./workflowLayoutTypes";

export const workflowNodeSizes = {
  trigger: { minWidth: 28, maxWidth: 28, height: 22 },
  policy: { minWidth: 136, maxWidth: 220, height: 22 },
  event: { width: 240, height: 46 },
  outputEvent: { minWidth: 76, maxWidth: 120, height: 22, rowGap: 16 },
  action: { width: 28, height: 28 }
};

export const workflowCanvasLayoutConfig = {
  startX: 32,
  startY: 64,
  columnGap: 72,
  branchGap: 28,
  edgePad: 18,
  triggerAnchorY: 11,
  policyAnchorY: 11,
  outputEventsLaneGap: 24
};

export const workflowEdgeLabelLayout = {
  minGap: 80,
  maxWidth: 160,
  paddingX: 12,
  characterWidth: 6.25,
  clearance: 24
};

export const workflowAddActionGhostLabel = "+ Action";

export const workflowDirectionHandles: Record<WorkflowLayoutDirection, { rankdir: "LR" | "TB"; sourceHandleId: string; targetHandleId: string }> = {
  horizontal: { rankdir: "LR", sourceHandleId: "right", targetHandleId: "left" },
  vertical: { rankdir: "TB", sourceHandleId: "right", targetHandleId: "left" }
};
