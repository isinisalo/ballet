import { loopCanvasLayoutConfig, loopNodeSizes } from "./loopLayoutConfig";
import { loopHorizontalLaneYOffsets, loopNodeOrderIndexes, loopNodeRanks } from "./loopLayoutLanes";
import {
  loopHorizontalEdgeGap,
  loopStepStackHeight
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

function loopLayoutMetrics(
  primaryNodes: LoopCanvasLayoutNodeDraft[]
): LoopLayoutMetrics {
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
    verticalStepRankGap: stepStackHeight + loopCanvasLayoutConfig.branchGap,
    verticalColumnStep: loopNodeSizes.step.maxWidth + loopCanvasLayoutConfig.branchGap
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
