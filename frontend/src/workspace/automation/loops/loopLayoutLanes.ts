import dagre from "@dagrejs/dagre";
import { loopCanvasLayoutConfig, loopDirectionHandles, loopNodeSizes } from "./loopLayoutConfig";
import { outputEventStackHeight, loopBranchStackHeight } from "./loopLayoutSizing";
import type { LoopCanvasLayoutNodeDraft, LoopDagreEdge, LoopLayoutDirection } from "./loopLayoutTypes";

export function loopNodeRanks(nodes: LoopCanvasLayoutNodeDraft[], edges: LoopDagreEdge[]) {
  const nodeKeys = new Set(nodes.map((node) => node.key));
  const ranks = new Map(nodes.map((node) => [node.key, 0]));

  for (let pass = 0; pass < nodes.length; pass += 1) {
    edges.forEach((edge) => {
      if (!nodeKeys.has(edge.source) || !nodeKeys.has(edge.target)) return;
      const sourceRank = ranks.get(edge.source) ?? 0;
      const targetRank = ranks.get(edge.target) ?? 0;
      if (targetRank <= sourceRank) ranks.set(edge.target, sourceRank + 1);
    });
  }

  return ranks;
}

export function loopNodeOrderIndexes(nodes: LoopCanvasLayoutNodeDraft[], edges: LoopDagreEdge[], direction: LoopLayoutDirection) {
  if (direction === "horizontal") return loopHorizontalLaneIndexes(nodes, edges);

  const dagrePositions = loopDagrePositions(nodes, edges, direction);
  const orderedNodes = nodes
    .map((node, sourceIndex) => ({
      key: node.key,
      sourceIndex,
      value: dagrePositions.get(node.key)?.x ?? sourceIndex
    }))
    .sort((a, b) => a.value - b.value || a.sourceIndex - b.sourceIndex);
  const orderIndexes = new Map<string, number>();
  let previousValue: number | undefined;
  let orderIndex = -1;

  orderedNodes.forEach((node) => {
    if (previousValue === undefined || Math.abs(node.value - previousValue) > 2) {
      orderIndex += 1;
      previousValue = node.value;
    }
    orderIndexes.set(node.key, orderIndex);
  });

  return orderIndexes;
}

export function loopHorizontalLaneYOffsets(
  nodes: LoopCanvasLayoutNodeDraft[],
  outputNodes: LoopCanvasLayoutNodeDraft[],
  edges: LoopDagreEdge[],
  laneIndexes: ReadonlyMap<string, number>
) {
  const primaryNodeByKey = new Map(nodes.map((node) => [node.key, node]));
  const laneCount = Math.max(0, ...[...laneIndexes.values()]) + 1;
  const laneHeights = Array.from({ length: laneCount }, () => 0);

  nodes.forEach((node) => {
    const laneIndex = laneIndexes.get(node.key);
    if (laneIndex === undefined) return;
    laneHeights[laneIndex] = Math.max(laneHeights[laneIndex], loopBranchStackHeight(node));
  });

  outputNodesBySourceKey(outputNodes).forEach((sourceOutputNodes, sourceKey) => {
    const sourceNode = primaryNodeByKey.get(sourceKey);
    const sourceLaneIndex = laneIndexes.get(sourceKey);
    if (!sourceNode || sourceLaneIndex === undefined) return;
    const outputStackHeightValue = outputEventStackHeight(sourceOutputNodes.length);
    const childNodes = edges
      .filter((edge) => edge.source === sourceKey && edge.target.startsWith("action-"))
      .map((edge) => primaryNodeByKey.get(edge.target))
      .filter((childNode): childNode is LoopCanvasLayoutNodeDraft => Boolean(childNode));

    if (childNodes.length === 0) {
      laneHeights[sourceLaneIndex] = Math.max(
        laneHeights[sourceLaneIndex],
        outputStackHeightValue
      );
      return;
    }

    const lastChildNode = childNodes.reduce((currentLastChildNode, childNode) => {
      const currentLaneIndex = laneIndexes.get(currentLastChildNode.key) ?? 0;
      const childLaneIndex = laneIndexes.get(childNode.key) ?? 0;
      return childLaneIndex > currentLaneIndex ? childNode : currentLastChildNode;
    }, childNodes[0]);
    const childLaneIndex = laneIndexes.get(lastChildNode.key);
    if (childLaneIndex === undefined) return;
    laneHeights[childLaneIndex] = Math.max(
      laneHeights[childLaneIndex],
      loopBranchStackHeight(lastChildNode) +
        loopNodeSizes.outputEvent.rowGap +
        outputStackHeightValue +
        loopCanvasLayoutConfig.outputEventLaneClearance
    );
  });

  const laneYOffsets = new Map<number, number>();
  let nextOffset = 0;
  laneHeights.forEach((laneHeight, laneIndex) => {
    laneYOffsets.set(laneIndex, nextOffset);
    nextOffset += Math.max(laneHeight, loopNodeSizes.action.height) + loopCanvasLayoutConfig.branchGap;
  });
  return laneYOffsets;
}

function loopHorizontalLaneIndexes(nodes: LoopCanvasLayoutNodeDraft[], edges: LoopDagreEdge[]) {
  const nodeKeys = new Set(nodes.map((node) => node.key));
  const laneIndexes = new Map<string, number>();
  const outgoingEdges = new Map<string, LoopDagreEdge[]>();
  let nextLaneIndex = 1;

  edges.forEach((edge) => {
    if (!nodeKeys.has(edge.source) || !nodeKeys.has(edge.target)) return;
    const outgoing = outgoingEdges.get(edge.source) ?? [];
    outgoing.push(edge);
    outgoingEdges.set(edge.source, outgoing);
  });

  const assignLane = (nodeKey: string, laneIndex: number, visited = new Set<string>()) => {
    if (!nodeKeys.has(nodeKey) || visited.has(nodeKey)) return;
    const existingLaneIndex = laneIndexes.get(nodeKey);
    if (existingLaneIndex !== undefined && existingLaneIndex <= laneIndex) return;
    laneIndexes.set(nodeKey, laneIndex);
    const nextVisited = new Set(visited);
    nextVisited.add(nodeKey);

    (outgoingEdges.get(nodeKey) ?? []).forEach((edge, edgeIndex) => {
      const targetLaneIndex = edgeIndex === 0 ? laneIndex : nextLaneIndex++;
      assignLane(edge.target, targetLaneIndex, nextVisited);
    });
  };

  nodes.forEach((node) => {
    if (!laneIndexes.has(node.key)) assignLane(node.key, nextLaneIndex++);
  });

  return compactLoopLaneIndexes(laneIndexes);
}

function compactLoopLaneIndexes(laneIndexes: ReadonlyMap<string, number>) {
  const compactIndexByLaneIndex = new Map(
    [...new Set(laneIndexes.values())]
      .sort((firstLaneIndex, secondLaneIndex) => firstLaneIndex - secondLaneIndex)
      .map((laneIndex, compactIndex) => [laneIndex, compactIndex])
  );

  return new Map([...laneIndexes].map(([nodeKey, laneIndex]) => [
    nodeKey,
    compactIndexByLaneIndex.get(laneIndex) ?? laneIndex
  ]));
}

function outputNodesBySourceKey(outputNodes: LoopCanvasLayoutNodeDraft[]) {
  const nodesBySourceKey = new Map<string, LoopCanvasLayoutNodeDraft[]>();

  outputNodes.forEach((node) => {
    const sourceKey = node.record ? `action-${node.record.index}` : "";
    if (!sourceKey) return;
    nodesBySourceKey.set(sourceKey, [...(nodesBySourceKey.get(sourceKey) ?? []), node]);
  });

  return nodesBySourceKey;
}

function loopDagrePositions(nodes: LoopCanvasLayoutNodeDraft[], edges: LoopDagreEdge[], direction: LoopLayoutDirection) {
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: loopDirectionHandles[direction].rankdir,
    ranksep: loopCanvasLayoutConfig.columnGap,
    nodesep: loopCanvasLayoutConfig.branchGap,
    marginx: 0,
    marginy: 0
  });

  nodes.forEach((node) => graph.setNode(node.key, { width: node.width, height: node.height }));
  edges.forEach((edge) => graph.setEdge(edge.source, edge.target));
  dagre.layout(graph);

  return new Map(nodes.map((node) => {
    const dagreNode = graph.node(node.key) as { x: number; y: number } | undefined;
    return [node.key, { x: dagreNode?.x ?? 0, y: dagreNode?.y ?? 0 }];
  }));
}
