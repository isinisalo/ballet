import { workflowCanvasLayoutConfig, workflowNodeSizes } from "./workflowLayoutConfig";
import { workflowHorizontalLaneYOffsets, workflowNodeOrderIndexes, workflowNodeRanks } from "./workflowLayoutLanes";
import {
  canAlignTerminalOutputEvents,
  outputEventStackHeight,
  outputEventStackStep,
  workflowBranchStackHeight,
  workflowCanvasNodeAnchorY,
  workflowHorizontalEdgeGap,
  workflowPolicyOutputHandleY,
  workflowPolicyStackHeight
} from "./workflowLayoutSizing";
import type { WorkflowCanvasLayoutNode, WorkflowCanvasLayoutNodeDraft, WorkflowDagreEdge, WorkflowLayoutDirection, WorkflowLayoutMetrics } from "./workflowLayoutTypes";

export function positionWorkflowNodes(nodes: WorkflowCanvasLayoutNodeDraft[], edges: WorkflowDagreEdge[], direction: WorkflowLayoutDirection): WorkflowCanvasLayoutNode[] {
  const primaryNodes = nodes.filter((node) => node.kind !== "output-event");
  const outputNodes = nodes.filter((node) => node.kind === "output-event");
  const metrics = workflowLayoutMetrics(primaryNodes, outputNodes, edges);
  const positionedPrimaryNodes = positionPrimaryNodes(primaryNodes, outputNodes, edges, direction, metrics);
  const primaryNodeByKey = new Map(positionedPrimaryNodes.map((node) => [node.key, node]));
  const positionedOutputNodes = positionOutputEventNodes(outputNodes, primaryNodeByKey, edges, direction, metrics);

  return [...positionedPrimaryNodes, ...positionedOutputNodes];
}

function positionPrimaryNodes(
  nodes: WorkflowCanvasLayoutNodeDraft[],
  outputNodes: WorkflowCanvasLayoutNodeDraft[],
  edges: WorkflowDagreEdge[],
  direction: WorkflowLayoutDirection,
  metrics: WorkflowLayoutMetrics
): WorkflowCanvasLayoutNode[] {
  const ranks = workflowNodeRanks(nodes, edges);
  const orderIndexes = workflowNodeOrderIndexes(nodes, edges, direction);
  const horizontalLaneYOffsets = direction === "horizontal"
    ? workflowHorizontalLaneYOffsets(nodes, outputNodes, edges, orderIndexes)
    : new Map<number, number>();
  return nodes.map((node) => {
    const rank = ranks.get(node.key) ?? 0;
    const orderIndex = orderIndexes.get(node.key) ?? 0;

    return {
      ...node,
      x: direction === "horizontal"
        ? horizontalNodeX(rank, metrics)
        : verticalNodeX(node, orderIndex, metrics),
      y: direction === "horizontal"
        ? workflowCanvasLayoutConfig.startY + (horizontalLaneYOffsets.get(orderIndex) ?? orderIndex * metrics.horizontalRowStep)
        : verticalNodeY(rank, metrics)
    };
  });
}

function positionOutputEventNodes(
  nodes: WorkflowCanvasLayoutNodeDraft[],
  nodeByKey: ReadonlyMap<string, WorkflowCanvasLayoutNode>,
  edges: WorkflowDagreEdge[],
  direction: WorkflowLayoutDirection,
  metrics: WorkflowLayoutMetrics
): WorkflowCanvasLayoutNode[] {
  const nodesBySourceKey = new Map<string, WorkflowCanvasLayoutNodeDraft[]>();

  nodes.forEach((node) => {
    const sourceKey = node.record ? `policy-${node.record.index}` : "";
    nodesBySourceKey.set(sourceKey, [...(nodesBySourceKey.get(sourceKey) ?? []), node]);
  });

  return nodes.flatMap((node) => {
    const sourceKey = node.record ? `policy-${node.record.index}` : undefined;
    const sourceNodes = sourceKey ? nodesBySourceKey.get(sourceKey) ?? [] : [];
    const outputOrderIndex = sourceNodes.findIndex((sourceNode) => sourceNode.key === node.key);
    return positionOutputEventNode(node, nodeByKey, edges, direction, metrics, Math.max(0, outputOrderIndex));
  });
}

function positionOutputEventNode(
  node: WorkflowCanvasLayoutNodeDraft,
  nodeByKey: ReadonlyMap<string, WorkflowCanvasLayoutNode>,
  edges: WorkflowDagreEdge[],
  direction: WorkflowLayoutDirection,
  metrics: WorkflowLayoutMetrics,
  outputOrderIndex: number
): WorkflowCanvasLayoutNode {
  const sourceKey = node.record ? `policy-${node.record.index}` : undefined;
  const sourceNode = sourceKey ? nodeByKey.get(sourceKey) : undefined;
  if (!sourceNode) {
    return { ...node, x: workflowCanvasLayoutConfig.startX, y: workflowCanvasLayoutConfig.startY };
  }
  const childNodes = edges
    .filter((edge) => edge.source === sourceKey && edge.target.startsWith("policy-"))
    .map((edge) => nodeByKey.get(edge.target))
    .filter((childNode): childNode is WorkflowCanvasLayoutNode => Boolean(childNode));

  return {
    ...node,
    x: direction === "horizontal"
      ? childNodes[0]?.x ?? sourceNode.x + metrics.horizontalPolicyColumnStep
      : nextVerticalOutputEventsX(childNodes, sourceNode),
    y: direction === "horizontal"
      ? nextHorizontalOutputEventsY(childNodes, sourceNode, node, outputOrderIndex)
      : (childNodes[0]?.y ?? sourceNode.y + metrics.verticalPolicyRankStep) + outputOrderIndex * outputEventStackStep()
  };
}

function nextHorizontalOutputEventsY(
  childNodes: WorkflowCanvasLayoutNode[],
  sourceNode: WorkflowCanvasLayoutNode,
  node: WorkflowCanvasLayoutNodeDraft,
  outputOrderIndex: number
) {
  if (childNodes.length === 0) {
    return sourceNode.y + workflowCanvasNodeAnchorY(sourceNode) - node.height / 2 + outputOrderIndex * outputEventStackStep();
  }

  const hasPolicyChild = childNodes.some((childNode) => childNode.kind === "policy");
  const childStackBottom = Math.max(...childNodes.map((childNode) => childNode.y + workflowBranchStackHeight(childNode)));
  const outputStackTop = childStackBottom + workflowNodeSizes.outputEvent.rowGap;
  const stackedY = outputStackTop + outputOrderIndex * outputEventStackStep();

  if (hasPolicyChild || !canAlignTerminalOutputEvents(sourceNode.outputHandleCount ?? 0)) return stackedY;
  return sourceNode.y + workflowPolicyOutputHandleY(node.outputIndex ?? outputOrderIndex, sourceNode.outputHandleCount ?? 0) - node.height / 2;
}

function nextVerticalOutputEventsX(childNodes: WorkflowCanvasLayoutNode[], sourceNode: WorkflowCanvasLayoutNode) {
  if (childNodes.length === 0) return sourceNode.x;
  return Math.max(...childNodes.map((childNode) => childNode.x + childNode.width + workflowCanvasLayoutConfig.branchGap));
}

function workflowLayoutMetrics(
  primaryNodes: WorkflowCanvasLayoutNodeDraft[],
  outputNodes: WorkflowCanvasLayoutNodeDraft[],
  edges: WorkflowDagreEdge[]
): WorkflowLayoutMetrics {
  const outputStackHeights = [...new Map(outputNodes.map((node) => {
    const sourceKey = node.record ? `policy-${node.record.index}` : node.key;
    return [sourceKey, outputNodes.filter((candidate) => candidate.record?.index === node.record?.index).length];
  })).values()].map(outputEventStackHeight);
  const maxOutputHeight = Math.max(workflowNodeSizes.outputEvent.height, ...outputStackHeights);
  const policyStackHeight = workflowPolicyStackHeight();
  const triggerWidth = primaryNodes.find((node) => node.kind === "trigger")?.width ?? workflowNodeSizes.trigger.minWidth;
  const horizontalEdgeGap = workflowHorizontalEdgeGap(edges);
  const horizontalPolicyColumnWidth = Math.max(
    workflowNodeSizes.policy.minWidth,
    ...primaryNodes.filter((node) => node.kind === "policy").map((node) => node.width)
  );

  return {
    horizontalRootPolicyX: workflowCanvasLayoutConfig.startX + triggerWidth + horizontalEdgeGap,
    horizontalPolicyColumnStep: horizontalPolicyColumnWidth + horizontalEdgeGap,
    horizontalRowStep: Math.max(policyStackHeight, workflowNodeSizes.trigger.height) + workflowCanvasLayoutConfig.branchGap,
    verticalRootPolicyY: workflowCanvasLayoutConfig.startY + workflowNodeSizes.trigger.height + workflowCanvasLayoutConfig.branchGap,
    verticalPolicyRankStep: policyStackHeight + maxOutputHeight + workflowCanvasLayoutConfig.branchGap,
    verticalColumnStep: Math.max(workflowNodeSizes.policy.maxWidth, workflowNodeSizes.outputEvent.maxWidth) + workflowCanvasLayoutConfig.branchGap
  };
}

function horizontalNodeX(rank: number, metrics: WorkflowLayoutMetrics) {
  if (rank <= 0) return workflowCanvasLayoutConfig.startX;
  return metrics.horizontalRootPolicyX + (rank - 1) * metrics.horizontalPolicyColumnStep;
}

function verticalNodeY(rank: number, metrics: WorkflowLayoutMetrics) {
  if (rank <= 0) return workflowCanvasLayoutConfig.startY;
  return metrics.verticalRootPolicyY + (rank - 1) * metrics.verticalPolicyRankStep;
}

function verticalNodeX(node: WorkflowCanvasLayoutNodeDraft, orderIndex: number, metrics: WorkflowLayoutMetrics) {
  const columnWidth = metrics.verticalColumnStep - workflowCanvasLayoutConfig.branchGap;
  const centeredOffset = Math.max(0, (columnWidth - node.width) / 2);
  return workflowCanvasLayoutConfig.startX + orderIndex * metrics.verticalColumnStep + centeredOffset;
}
