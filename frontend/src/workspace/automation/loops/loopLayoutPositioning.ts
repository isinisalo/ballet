import { loopCanvasLayoutConfig, loopNodeSizes } from "./loopLayoutConfig";
import { loopHorizontalLaneYOffsets, loopNodeOrderIndexes, loopNodeRanks } from "./loopLayoutLanes";
import {
  canAlignTerminalOutputEvents,
  outputEventStackHeight,
  outputEventStackStep,
  loopBranchStackHeight,
  loopCanvasNodeAnchorY,
  loopHorizontalEdgeGap,
  loopStepOutputHandleY,
  loopStepStackHeight
} from "./loopLayoutSizing";
import type { LoopCanvasLayoutNode, LoopCanvasLayoutNodeDraft, LoopDagreEdge, LoopLayoutDirection, LoopLayoutMetrics } from "./loopLayoutTypes";

export function positionLoopNodes(nodes: LoopCanvasLayoutNodeDraft[], edges: LoopDagreEdge[], direction: LoopLayoutDirection): LoopCanvasLayoutNode[] {
  const primaryNodes = nodes.filter((node) => node.kind !== "output-event");
  const outputNodes = nodes.filter((node) => node.kind === "output-event");
  const metrics = loopLayoutMetrics(primaryNodes, outputNodes);
  const positionedPrimaryNodes = positionPrimaryNodes(primaryNodes, outputNodes, edges, direction, metrics);
  const primaryNodeByKey = new Map(positionedPrimaryNodes.map((node) => [node.key, node]));
  const positionedOutputNodes = positionOutputEventNodes(outputNodes, primaryNodeByKey, edges, direction, metrics);

  return [...positionedPrimaryNodes, ...positionedOutputNodes];
}

function positionPrimaryNodes(
  nodes: LoopCanvasLayoutNodeDraft[],
  outputNodes: LoopCanvasLayoutNodeDraft[],
  edges: LoopDagreEdge[],
  direction: LoopLayoutDirection,
  metrics: LoopLayoutMetrics
): LoopCanvasLayoutNode[] {
  const ranks = loopNodeRanks(nodes, edges);
  const orderIndexes = loopNodeOrderIndexes(nodes, edges, direction);
  const horizontalLaneYOffsets = direction === "horizontal"
    ? loopHorizontalLaneYOffsets(nodes, outputNodes, edges, orderIndexes)
    : new Map<number, number>();
  const horizontalLaneNodeHeights = direction === "horizontal"
    ? loopHorizontalLaneNodeHeights(nodes, orderIndexes)
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
        ? loopCanvasLayoutConfig.startY +
          (horizontalLaneYOffsets.get(orderIndex) ?? orderIndex * metrics.horizontalRowStep) +
          ((horizontalLaneNodeHeights.get(orderIndex) ?? node.height) - node.height) / 2
        : verticalNodeY(rank, metrics)
    };
  });
}

function loopHorizontalLaneNodeHeights(
  nodes: LoopCanvasLayoutNodeDraft[],
  orderIndexes: ReadonlyMap<string, number>
) {
  const heights = new Map<number, number>();
  nodes.forEach((node) => {
    const orderIndex = orderIndexes.get(node.key) ?? 0;
    heights.set(orderIndex, Math.max(heights.get(orderIndex) ?? 0, node.height));
  });
  return heights;
}

function positionOutputEventNodes(
  nodes: LoopCanvasLayoutNodeDraft[],
  nodeByKey: ReadonlyMap<string, LoopCanvasLayoutNode>,
  edges: LoopDagreEdge[],
  direction: LoopLayoutDirection,
  metrics: LoopLayoutMetrics
): LoopCanvasLayoutNode[] {
  const nodesBySourceKey = new Map<string, LoopCanvasLayoutNodeDraft[]>();

  nodes.forEach((node) => {
    const sourceKey = node.record ? `step-${node.record.index}` : "";
    nodesBySourceKey.set(sourceKey, [...(nodesBySourceKey.get(sourceKey) ?? []), node]);
  });

  return nodes.flatMap((node) => {
    const sourceKey = node.record ? `step-${node.record.index}` : undefined;
    const sourceNodes = sourceKey ? nodesBySourceKey.get(sourceKey) ?? [] : [];
    const outputOrderIndex = sourceNodes.findIndex((sourceNode) => sourceNode.key === node.key);
    return positionOutputEventNode(node, nodeByKey, edges, direction, metrics, Math.max(0, outputOrderIndex));
  });
}

function positionOutputEventNode(
  node: LoopCanvasLayoutNodeDraft,
  nodeByKey: ReadonlyMap<string, LoopCanvasLayoutNode>,
  edges: LoopDagreEdge[],
  direction: LoopLayoutDirection,
  metrics: LoopLayoutMetrics,
  outputOrderIndex: number
): LoopCanvasLayoutNode {
  const sourceKey = node.record ? `step-${node.record.index}` : undefined;
  const sourceNode = sourceKey ? nodeByKey.get(sourceKey) : undefined;
  if (!sourceNode) {
    return { ...node, x: loopCanvasLayoutConfig.startX, y: loopCanvasLayoutConfig.startY };
  }
  const childNodes = edges
    .filter((edge) => edge.source === sourceKey && edge.target.startsWith("step-"))
    .map((edge) => nodeByKey.get(edge.target))
    .filter((childNode): childNode is LoopCanvasLayoutNode => Boolean(childNode));

  return {
    ...node,
    x: direction === "horizontal"
      ? childNodes[0]?.x ?? sourceNode.x + metrics.horizontalStepColumnGap
      : nextVerticalOutputEventsX(childNodes, sourceNode),
    y: direction === "horizontal"
      ? nextHorizontalOutputEventsY(childNodes, sourceNode, node, outputOrderIndex)
      : (childNodes[0]?.y ?? sourceNode.y + metrics.verticalStepRankGap) + outputOrderIndex * outputEventStackStep()
  };
}

function nextHorizontalOutputEventsY(
  childNodes: LoopCanvasLayoutNode[],
  sourceNode: LoopCanvasLayoutNode,
  node: LoopCanvasLayoutNodeDraft,
  outputOrderIndex: number
) {
  if (childNodes.length === 0) {
    return sourceNode.y + loopCanvasNodeAnchorY(sourceNode) - node.height / 2 + outputOrderIndex * outputEventStackStep();
  }

  const hasStepChild = childNodes.some((childNode) => childNode.kind === "step");
  const childStackBottom = Math.max(...childNodes.map((childNode) => childNode.y + loopBranchStackHeight(childNode)));
  const outputStackTop = childStackBottom + loopNodeSizes.outputEvent.rowGap;
  const stackedY = outputStackTop + outputOrderIndex * outputEventStackStep();

  if (hasStepChild || !canAlignTerminalOutputEvents(sourceNode.outputHandleCount ?? 0)) return stackedY;
  return sourceNode.y + loopStepOutputHandleY(node.outputIndex ?? outputOrderIndex, sourceNode.outputHandleCount ?? 0, sourceNode.height) - node.height / 2;
}

function nextVerticalOutputEventsX(childNodes: LoopCanvasLayoutNode[], sourceNode: LoopCanvasLayoutNode) {
  if (childNodes.length === 0) return sourceNode.x;
  return Math.max(...childNodes.map((childNode) => childNode.x + childNode.width + loopCanvasLayoutConfig.branchGap));
}

function loopLayoutMetrics(
  primaryNodes: LoopCanvasLayoutNodeDraft[],
  outputNodes: LoopCanvasLayoutNodeDraft[]
): LoopLayoutMetrics {
  const outputStackHeights = [...new Map(outputNodes.map((node) => {
    const sourceKey = node.record ? `step-${node.record.index}` : node.key;
    return [sourceKey, outputNodes.filter((candidate) => candidate.record?.index === node.record?.index).length];
  })).values()].map(outputEventStackHeight);
  const maxOutputHeight = Math.max(loopNodeSizes.outputEvent.height, ...outputStackHeights);
  const stepStackHeight = loopStepStackHeight();
  const horizontalEdgeGap = loopHorizontalEdgeGap();
  const horizontalStepColumnWidth = Math.max(
    loopNodeSizes.step.minWidth,
    ...primaryNodes.filter((node) => node.kind === "step").map((node) => node.width)
  );

  return {
    horizontalRootStepX: loopCanvasLayoutConfig.startX + horizontalStepColumnWidth + horizontalEdgeGap,
    horizontalStepColumnGap: horizontalStepColumnWidth + horizontalEdgeGap,
    horizontalRowStep: stepStackHeight + loopCanvasLayoutConfig.branchGap,
    verticalRootStepY: loopCanvasLayoutConfig.startY + stepStackHeight + loopCanvasLayoutConfig.branchGap,
    verticalStepRankGap: stepStackHeight + maxOutputHeight + loopCanvasLayoutConfig.branchGap,
    verticalColumnStep: Math.max(loopNodeSizes.step.maxWidth, loopNodeSizes.outputEvent.maxWidth) + loopCanvasLayoutConfig.branchGap
  };
}

function horizontalNodeX(rank: number, metrics: LoopLayoutMetrics) {
  if (rank <= 0) return loopCanvasLayoutConfig.startX;
  return metrics.horizontalRootStepX + (rank - 1) * metrics.horizontalStepColumnGap;
}

function verticalNodeY(rank: number, metrics: LoopLayoutMetrics) {
  if (rank <= 0) return loopCanvasLayoutConfig.startY;
  return metrics.verticalRootStepY + (rank - 1) * metrics.verticalStepRankGap;
}

function verticalNodeX(node: LoopCanvasLayoutNodeDraft, orderIndex: number, metrics: LoopLayoutMetrics) {
  const columnWidth = metrics.verticalColumnStep - loopCanvasLayoutConfig.branchGap;
  const centeredOffset = Math.max(0, (columnWidth - node.width) / 2);
  return loopCanvasLayoutConfig.startX + orderIndex * metrics.verticalColumnStep + centeredOffset;
}
