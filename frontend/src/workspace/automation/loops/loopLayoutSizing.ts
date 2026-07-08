import type { LoopStepRecord } from "./loopGraph";
import { loopOutputSlotKindForValues } from "./loopEdgeOutputSlot";
import { loopAddActionGhostLabel, loopCanvasLayoutConfig, loopNodeSizes } from "./loopLayoutConfig";
import type { LoopCanvasLayoutNode } from "./loopLayoutTypes";

export function loopCanvasNodeAnchorY(layoutNode: Pick<LoopCanvasLayoutNode, "height" | "kind">) {
  if (layoutNode.kind === "trigger") return loopCanvasLayoutConfig.triggerAnchorY;
  if (layoutNode.kind === "policy") return loopCanvasLayoutConfig.policyAnchorY;
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

export function loopPolicyOutputHandleY(outputIndex: number, outputHandleCount: number) {
  if (outputHandleCount <= 1) return loopCanvasLayoutConfig.policyAnchorY;
  const firstHandleY = loopCanvasLayoutConfig.policyAnchorY;
  const lastHandleY = loopNodeSizes.policy.height - loopCanvasLayoutConfig.edgePad / 2;
  const clampedIndex = Math.min(Math.max(outputIndex, 0), outputHandleCount - 1);
  return firstHandleY + (lastHandleY - firstHandleY) * (clampedIndex / (outputHandleCount - 1));
}

export function loopPolicyStackHeight() {
  return loopNodeSizes.policy.height;
}

export function loopOutputEventNodeWidth() {
  return loopOutputNodeWidth(loopAddActionGhostLabel, loopNodeSizes.outputEvent.minWidth, loopNodeSizes.outputEvent.maxWidth);
}

export function loopPolicyNodeWidth(record: LoopStepRecord) {
  return loopOutputNodeWidth(record.policy?.action || record.policyId || "No policy", loopNodeSizes.policy.minWidth, loopNodeSizes.policy.maxWidth);
}

export function loopTriggerNodeWidth() {
  return loopOutputNodeWidth("", loopNodeSizes.trigger.minWidth, loopNodeSizes.trigger.maxWidth);
}

export function loopSummaryNodeWidth(value: string) {
  return loopOutputNodeWidth(value, loopNodeSizes.loop.minWidth, loopNodeSizes.loop.maxWidth);
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
  const firstHandleY = loopPolicyOutputHandleY(0, outputHandleCount);
  const secondHandleY = loopPolicyOutputHandleY(1, outputHandleCount);
  const rowGap = secondHandleY - firstHandleY - loopNodeSizes.outputEvent.height;
  return rowGap >= loopNodeSizes.outputEvent.rowGap / 2;
}

export function loopBranchStackHeight(node: Pick<LoopCanvasLayoutNode, "height" | "kind">) {
  return node.kind === "policy"
    ? loopPolicyStackHeight()
    : node.height;
}

function loopOutputNodeWidth(value: string, minWidth: number, maxWidth: number) {
  const iconAndGapWidth = 20;
  const estimatedCharacterWidth = 7;
  return Math.min(
    maxWidth,
    Math.max(minWidth, iconAndGapWidth + value.length * estimatedCharacterWidth)
  );
}
