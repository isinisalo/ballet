import { loopOutputSlotKindForValues } from "./loopEdgeOutputSlot";
import { loopCanvasLayoutConfig, loopNodeSizes } from "./loopLayoutConfig";
import type { LoopCanvasLayoutNode } from "./loopLayoutTypes";

export function loopCanvasNodeAnchorY(layoutNode: Pick<LoopCanvasLayoutNode, "height" | "kind">) {
  if (layoutNode.kind === "action") return loopCanvasLayoutConfig.actionAnchorY;
  return layoutNode.height / 2;
}

export function loopOutputSourceHandleId(output?: { outputId?: string; eventType?: string } | string) {
  const outputId = typeof output === "string" ? output : output?.outputId;
  const eventType = typeof output === "string" ? undefined : output?.eventType;
  return loopOutputSlotKindForValues(outputId, eventType) === "rework" ? "bottom" : "right";
}

export function loopOutputTargetHandleId(output?: { outputId?: string; eventType?: string } | string, fallback = "left") {
  const outputId = typeof output === "string" ? output : output?.outputId;
  const eventType = typeof output === "string" ? undefined : output?.eventType;
  return loopOutputSlotKindForValues(outputId, eventType) === "rework" ? "top" : fallback;
}

export function loopShortestVerticalHandles(sourceNode: LoopCanvasLayoutNode, targetNode: LoopCanvasLayoutNode, preferBottomOnTie: boolean) {
  const sourceCenterY = sourceNode.y + sourceNode.height / 2;
  const targetCenterY = targetNode.y + targetNode.height / 2;
  if (targetCenterY < sourceCenterY) return { sourceHandleId: "top", targetHandleId: "bottom" };
  if (targetCenterY > sourceCenterY) return { sourceHandleId: "bottom", targetHandleId: "top" };
  const handleId = preferBottomOnTie ? "bottom" : "top";
  return { sourceHandleId: handleId, targetHandleId: handleId };
}

export function loopActionOutputHandleY(outputIndex: number, outputHandleCount: number) {
  if (outputHandleCount <= 1) return loopCanvasLayoutConfig.actionAnchorY;
  const firstHandleY = loopCanvasLayoutConfig.actionAnchorY;
  const lastHandleY = loopNodeSizes.action.height - loopCanvasLayoutConfig.edgePad / 2;
  const clampedIndex = Math.min(Math.max(outputIndex, 0), outputHandleCount - 1);
  return firstHandleY + (lastHandleY - firstHandleY) * (clampedIndex / (outputHandleCount - 1));
}

export function loopActionStackHeight() {
  return loopNodeSizes.action.height;
}

export function loopOutputEventNodeWidth() {
  return loopNodeSizes.outputEvent.minWidth;
}

export function loopHorizontalEdgeGap() {
  return loopCanvasLayoutConfig.horizontalEdgeGap;
}

export function outputEventStackStep() {
  return loopNodeSizes.outputEvent.height + loopNodeSizes.outputEvent.rowGap;
}

export function outputEventStackHeight(count: number) {
  if (count <= 0) return loopNodeSizes.outputEvent.height;
  return count * loopNodeSizes.outputEvent.height + Math.max(0, count - 1) * loopNodeSizes.outputEvent.rowGap;
}

export function canAlignTerminalOutputEvents(outputHandleCount: number) {
  if (outputHandleCount <= 1) return true;
  const firstHandleY = loopActionOutputHandleY(0, outputHandleCount);
  const secondHandleY = loopActionOutputHandleY(1, outputHandleCount);
  const rowGap = secondHandleY - firstHandleY - loopNodeSizes.outputEvent.height;
  return rowGap >= loopNodeSizes.outputEvent.rowGap / 2;
}

export function loopBranchStackHeight(node: Pick<LoopCanvasLayoutNode, "height" | "kind">) {
  return node.kind === "action"
    ? loopActionStackHeight()
    : node.height;
}
