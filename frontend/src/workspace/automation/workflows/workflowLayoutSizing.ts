import type { WorkflowStepRecord } from "./workflowGraph";
import { workflowAddActionGhostLabel, workflowCanvasLayoutConfig, workflowEdgeLabelLayout, workflowNodeSizes } from "./workflowLayoutConfig";
import type { WorkflowCanvasLayoutNode, WorkflowDagreEdge } from "./workflowLayoutTypes";

export function workflowCanvasNodeAnchorY(layoutNode: Pick<WorkflowCanvasLayoutNode, "height" | "kind">) {
  if (layoutNode.kind === "trigger") return workflowCanvasLayoutConfig.triggerAnchorY;
  if (layoutNode.kind === "policy") return workflowCanvasLayoutConfig.policyAnchorY;
  return layoutNode.height / 2;
}

export function workflowOutputSourceHandleId() {
  return "right";
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
  return workflowOutputNodeWidth(`then: ${record.policy?.action || record.policyId || "No policy"}`, workflowNodeSizes.policy.minWidth, workflowNodeSizes.policy.maxWidth);
}

export function workflowTriggerNodeWidth() {
  return workflowOutputNodeWidth("", workflowNodeSizes.trigger.minWidth, workflowNodeSizes.trigger.maxWidth);
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
  return Math.min(
    workflowEdgeLabelLayout.maxWidth,
    workflowEdgeLabelLayout.paddingX + label.length * workflowEdgeLabelLayout.characterWidth
  );
}
