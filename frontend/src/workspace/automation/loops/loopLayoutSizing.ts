import { loopCanvasLayoutConfig, loopNodeSizes } from "./loopLayoutConfig";
import type { LoopCanvasLayoutNode } from "./loopLayoutTypes";

export function loopCanvasNodeAnchorY(layoutNode: Pick<LoopCanvasLayoutNode, "height" | "kind">) {
  return layoutNode.height / 2;
}

export function loopOutputSourceHandleId(output?: { outputId?: string; eventType?: string } | string) {
  void output;
  return "right";
}

export function loopOutputTargetHandleId(output?: { outputId?: string; eventType?: string } | string, fallback = "left") {
  void output;
  return fallback;
}

export function loopShortestVerticalHandles(sourceNode: LoopCanvasLayoutNode, targetNode: LoopCanvasLayoutNode, preferBottomOnTie: boolean) {
  const sourceCenterY = sourceNode.y + sourceNode.height / 2;
  const targetCenterY = targetNode.y + targetNode.height / 2;
  if (targetCenterY < sourceCenterY) return { sourceHandleId: "top", targetHandleId: "bottom" };
  if (targetCenterY > sourceCenterY) return { sourceHandleId: "bottom", targetHandleId: "top" };
  const handleId = preferBottomOnTie ? "bottom" : "top";
  return { sourceHandleId: handleId, targetHandleId: handleId };
}

export function loopWorkLoopNodeOutputHandleY(outputIndex: number, outputHandleCount: number, nodeHeight = loopNodeSizes.workLoopNode.height) {
  if (outputHandleCount <= 1) return nodeHeight / 2;
  const firstHandleY = loopCanvasLayoutConfig.edgePad / 2;
  const lastHandleY = nodeHeight - loopCanvasLayoutConfig.edgePad / 2;
  const clampedIndex = Math.min(Math.max(outputIndex, 0), outputHandleCount - 1);
  return firstHandleY + (lastHandleY - firstHandleY) * (clampedIndex / (outputHandleCount - 1));
}

export function loopWorkLoopNodeStackHeight() {
  return loopNodeSizes.workLoopNode.height;
}

export function loopHorizontalEdgeGap() {
  return loopCanvasLayoutConfig.horizontalEdgeGap;
}

export function loopBranchStackHeight(node: Pick<LoopCanvasLayoutNode, "height" | "kind">) {
  return node.kind === "work-loop-node"
    ? loopWorkLoopNodeStackHeight()
    : node.height;
}
