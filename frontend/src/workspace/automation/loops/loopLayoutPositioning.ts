import { loopCanvasLayoutConfig, loopNodeSizes } from "./loopLayoutConfig";
import { loopHorizontalLaneYOffsets, loopNodeOrderIndexes, loopNodeRanks } from "./loopLayoutLanes";
import {
  loopHorizontalEdgeGap,
  loopWorkLoopNodeStackHeight
} from "./loopLayoutSizing";
import type { LoopCanvasLayoutNode, LoopCanvasLayoutNodeDraft, LoopDagreEdge, LoopLayoutDirection, LoopLayoutMetrics } from "./loopLayoutTypes";

export function positionLoopNodes(nodes: LoopCanvasLayoutNodeDraft[], edges: LoopDagreEdge[], direction: LoopLayoutDirection): LoopCanvasLayoutNode[] {
  const metrics = loopLayoutMetrics(nodes);
  return positionPrimaryNodes(nodes, edges, direction, metrics);
}

function positionPrimaryNodes(
  nodes: LoopCanvasLayoutNodeDraft[],
  edges: LoopDagreEdge[],
  direction: LoopLayoutDirection,
  metrics: LoopLayoutMetrics
): LoopCanvasLayoutNode[] {
  const ranks = loopNodeRanks(nodes, edges);
  const orderIndexes = loopNodeOrderIndexes(nodes, edges, direction);
  const horizontalLaneYOffsets = direction === "horizontal"
    ? loopHorizontalLaneYOffsets(nodes, orderIndexes)
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
          (horizontalLaneYOffsets.get(orderIndex) ?? orderIndex * metrics.horizontalRowNodeGap) +
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

function loopLayoutMetrics(
  primaryNodes: LoopCanvasLayoutNodeDraft[]
): LoopLayoutMetrics {
  const nodeStackHeight = loopWorkLoopNodeStackHeight();
  const horizontalEdgeGap = loopHorizontalEdgeGap();
  const horizontalNodeColumnWidth = Math.max(
    loopNodeSizes.workLoopNode.minWidth,
    ...primaryNodes.filter((node) => node.kind === "work-loop-node").map((node) => node.width)
  );

  return {
    horizontalRootNodeX: loopCanvasLayoutConfig.startX + horizontalNodeColumnWidth + horizontalEdgeGap,
    horizontalNodeColumnGap: horizontalNodeColumnWidth + horizontalEdgeGap,
    horizontalRowNodeGap: nodeStackHeight + loopCanvasLayoutConfig.branchGap,
    verticalRootNodeY: loopCanvasLayoutConfig.startY + nodeStackHeight + loopCanvasLayoutConfig.branchGap,
    verticalNodeRankGap: nodeStackHeight + loopCanvasLayoutConfig.branchGap,
    verticalColumnNodeGap: loopNodeSizes.workLoopNode.maxWidth + loopCanvasLayoutConfig.branchGap
  };
}

function horizontalNodeX(rank: number, metrics: LoopLayoutMetrics) {
  if (rank <= 0) return loopCanvasLayoutConfig.startX;
  return metrics.horizontalRootNodeX + (rank - 1) * metrics.horizontalNodeColumnGap;
}

function verticalNodeY(rank: number, metrics: LoopLayoutMetrics) {
  if (rank <= 0) return loopCanvasLayoutConfig.startY;
  return metrics.verticalRootNodeY + (rank - 1) * metrics.verticalNodeRankGap;
}

function verticalNodeX(node: LoopCanvasLayoutNodeDraft, orderIndex: number, metrics: LoopLayoutMetrics) {
  const columnWidth = metrics.verticalColumnNodeGap - loopCanvasLayoutConfig.branchGap;
  const centeredOffset = Math.max(0, (columnWidth - node.width) / 2);
  return loopCanvasLayoutConfig.startX + orderIndex * metrics.verticalColumnNodeGap + centeredOffset;
}
