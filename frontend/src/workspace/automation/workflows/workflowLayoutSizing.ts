import type { WorkflowStepRecord } from "./workflowGraph";
import { workflowOutputSlotKindForValues } from "./workflowEdgeOutputSlot";
import { workflowAddActionGhostLabel, workflowCanvasLayoutConfig, workflowEdgeLabelLayout, workflowNodeSizes } from "./workflowLayoutConfig";
import type { WorkflowCanvasLayoutNode, WorkflowDagreEdge } from "./workflowLayoutTypes";

export function workflowCanvasNodeAnchorY(layoutNode: Pick<WorkflowCanvasLayoutNode, "height" | "kind">) {
  if (layoutNode.kind === "trigger") return workflowCanvasLayoutConfig.triggerAnchorY;
  if (layoutNode.kind === "policy") return workflowCanvasLayoutConfig.policyAnchorY;
  return layoutNode.height / 2;
}

export function workflowOutputSourceHandleId(output?: { outputId?: string; eventType?: string } | string) {
  const outputId = typeof output === "string" ? output : output?.outputId;
  const eventType = typeof output === "string" ? undefined : output?.eventType;
  return workflowOutputSlotKindForValues(outputId, eventType) === "rework" ? "bottom" : "right";
}

export function workflowOutputTargetHandleId(output?: { outputId?: string; eventType?: string } | string, fallback = "left") {
  const outputId = typeof output === "string" ? output : output?.outputId;
  const eventType = typeof output === "string" ? undefined : output?.eventType;
  return workflowOutputSlotKindForValues(outputId, eventType) === "rework" ? "top" : fallback;
}

export function workflowShortestVerticalHandles(sourceNode: WorkflowCanvasLayoutNode, targetNode: WorkflowCanvasLayoutNode, preferBottomOnTie: boolean) {
  const sourceCenterY = sourceNode.y + sourceNode.height / 2;
  const targetCenterY = targetNode.y + targetNode.height / 2;
  if (targetCenterY < sourceCenterY) return { sourceHandleId: "top", targetHandleId: "bottom" };
  if (targetCenterY > sourceCenterY) return { sourceHandleId: "bottom", targetHandleId: "top" };
  const handleId = preferBottomOnTie ? "bottom" : "top";
  return { sourceHandleId: handleId, targetHandleId: handleId };
}

export function workflowPolicyOutputHandleY(outputIndex: number, outputHandleCount: number) {
  if (outputHandleCount <= 1) return workflowCanvasLayoutConfig.policyAnchorY;
  const firstHandleY = workflowCanvasLayoutConfig.policyAnchorY;
  const lastHandleY = workflowNodeSizes.policy.height - workflowCanvasLayoutConfig.edgePad / 2;
  const clampedIndex = Math.min(Math.max(outputIndex, 0), outputHandleCount - 1);
  return firstHandleY + (lastHandleY - firstHandleY) * (clampedIndex / (outputHandleCount - 1));
}

export function workflowPolicyStackHeight() {
  return workflowNodeSizes.policy.height;
}

export function workflowOutputEventNodeWidth() {
  return workflowOutputNodeWidth(workflowAddActionGhostLabel, workflowNodeSizes.outputEvent.minWidth, workflowNodeSizes.outputEvent.maxWidth);
}

export function workflowPolicyNodeWidth(record: WorkflowStepRecord) {
  return workflowOutputNodeWidth(record.policy?.action || record.policyId || "No policy", workflowNodeSizes.policy.minWidth, workflowNodeSizes.policy.maxWidth);
}

export function workflowTriggerNodeWidth() {
  return workflowOutputNodeWidth("", workflowNodeSizes.trigger.minWidth, workflowNodeSizes.trigger.maxWidth);
}

export function workflowSummaryNodeWidth(value: string) {
  return workflowOutputNodeWidth(value, workflowNodeSizes.workflow.minWidth, workflowNodeSizes.workflow.maxWidth);
}

export function workflowHorizontalEdgeGap(edges: WorkflowDagreEdge[]) {
  const maxLabelWidth = Math.max(
    0,
    ...edges.map((edge) => edge.label ? workflowEdgeLabelWidth(edge.label) : 0)
  );
  return Math.max(
    workflowEdgeLabelLayout.minGap,
    Math.ceil(maxLabelWidth + workflowEdgeLabelLayout.clearance)
  );
}

export function outputEventStackStep() {
  return workflowNodeSizes.outputEvent.height + workflowNodeSizes.outputEvent.rowGap;
}

export function outputEventStackHeight(count: number) {
  if (count <= 0) return workflowNodeSizes.outputEvent.height;
  return count * workflowNodeSizes.outputEvent.height + Math.max(0, count - 1) * workflowNodeSizes.outputEvent.rowGap;
}

export function canAlignTerminalOutputEvents(outputHandleCount: number) {
  if (outputHandleCount <= 1) return true;
  const firstHandleY = workflowPolicyOutputHandleY(0, outputHandleCount);
  const secondHandleY = workflowPolicyOutputHandleY(1, outputHandleCount);
  const rowGap = secondHandleY - firstHandleY - workflowNodeSizes.outputEvent.height;
  return rowGap >= workflowNodeSizes.outputEvent.rowGap / 2;
}

export function workflowBranchStackHeight(node: Pick<WorkflowCanvasLayoutNode, "height" | "kind">) {
  return node.kind === "policy"
    ? workflowPolicyStackHeight()
    : node.height;
}

function workflowOutputNodeWidth(value: string, minWidth: number, maxWidth: number) {
  const iconAndGapWidth = 20;
  const estimatedCharacterWidth = 7;
  return Math.min(
    maxWidth,
    Math.max(minWidth, iconAndGapWidth + value.length * estimatedCharacterWidth)
  );
}

function workflowEdgeLabelWidth(label: string) {
  const renderedLabel = `on: ${label} then`;
  return Math.min(
    workflowEdgeLabelLayout.maxWidth,
    workflowEdgeLabelLayout.paddingX + renderedLabel.length * workflowEdgeLabelLayout.characterWidth
  );
}
