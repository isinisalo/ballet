// The composite layout stays in one pure module because its lane, edge, and cross-Loop
// passes share a single coordinate model; splitting them would duplicate that state.
import type { LoopVisualConfig, LoopVisualLoop, LoopVisualStep } from "./loopVisualProjection";
import { loopEdgeOutputSlotKind } from "./loopEdgeOutputSlot";
import { buildLoopGraph, loopCanonicalRecord, type LoopGraph, type LoopOutputTarget, type LoopStepRecord } from "./loopGraph";
import { loopCanvasLayoutConfig, loopNodeSizes } from "./loopLayoutConfig";
import type { LoopCanvasEdge } from "./loopLayoutEdges";
import { buildLoopLayoutGraphDraft } from "./loopLayoutGraph";
import { positionLoopNodes } from "./loopLayoutPositioning";
import { loopOutputSourceHandleId, loopShortestVerticalHandles } from "./loopLayoutSizing";
import type { LoopCanvasLayout, LoopCanvasLayoutNode, LoopLayoutDirection } from "./loopLayoutTypes";

type LoopLayoutRow = {
  loop: LoopVisualLoop;
  records: LoopStepRecord[];
  loopGraph: LoopGraph;
  layout: LoopCanvasLayout;
};

type LoopEventLink = {
  sourceLoopId: string;
  targetLoopId: string;
  sourceStepIndex: number;
  sourceStepId: string;
  outputId: string;
  eventType: string;
  targetStepId: string;
};

// This module intentionally centralizes loop graph layout rules because
// cross-loop routing depends on the same node, row, and edge geometry.
export { loopCanvasLayoutConfig, loopNodeSizes } from "./loopLayoutConfig";
export type { LoopCanvasEdge } from "./loopLayoutEdges";
export {
  loopCanvasNodeAnchorY,
  loopOutputSourceHandleId,
  loopStepOutputHandleY,
  loopStepStackHeight
} from "./loopLayoutSizing";
export type {
  LoopCanvasLayout,
  LoopCanvasLayoutNode,
  LoopCanvasNodeKind,
  LoopCanvasOutputEvent,
  LoopLayoutDirection
} from "./loopLayoutTypes";

export function calculateLoopCanvasLayout({
  loopGraph,
  editingStepIndex,
  direction = "horizontal"
}: {
  loopGraph: LoopGraph;
  editingStepIndex: number | null;
  direction?: LoopLayoutDirection;
}): LoopCanvasLayout {
  const graphDraft = buildLoopLayoutGraphDraft({
    loopGraph,
    editingStepIndex,
    direction
  });
  const positionedNodes = positionLoopNodes(graphDraft.nodes, graphDraft.dagreEdges, direction);

  return {
    nodes: positionedNodes,
    edges: loopEdgesWithDynamicVerticalHandles(graphDraft.canvasEdges, positionedNodes),
    direction
  };
}

export function calculateCompositeLoopCanvasLayout({
  config,
  selectedLoopId,
  recordsByLoopId,
  editingStepIndexByLoopId = new Map(),
  direction = "horizontal"
}: {
  config: LoopVisualConfig;
  selectedLoopId: string;
  recordsByLoopId: ReadonlyMap<string, LoopStepRecord[]>;
  editingStepIndexByLoopId?: ReadonlyMap<string, number | null>;
  direction?: LoopLayoutDirection;
}): LoopCanvasLayout {
  const selectedLoop = config.loops.find((loop) => loop.id === selectedLoopId);
  if (!selectedLoop) return { nodes: [], edges: [], direction };

  const stepById = new Map(config.steps.map((step) => [step.id, step]));
  return calculateSelectedLoopCanvasLayout({
    config,
    selectedLoop,
    recordsByLoopId,
    editingStepIndexByLoopId,
    direction,
    stepById
  });
}

function calculateSelectedLoopCanvasLayout({
  config,
  selectedLoop,
  recordsByLoopId,
  editingStepIndexByLoopId,
  direction,
  stepById
}: {
  config: LoopVisualConfig;
  selectedLoop: LoopVisualLoop;
  recordsByLoopId: ReadonlyMap<string, LoopStepRecord[]>;
  editingStepIndexByLoopId: ReadonlyMap<string, number | null>;
  direction: LoopLayoutDirection;
  stepById: ReadonlyMap<string, LoopVisualStep>;
}): LoopCanvasLayout {
  const selectedRow = loopLayoutRow({
    loop: selectedLoop,
    recordsByLoopId,
    editingStepIndexByLoopId,
    direction,
    stepById
  });
  const links = loopEventLinks(config, recordsByLoopId);
  const downstreamLoopIds = linkedLoopIds(config, links, selectedLoop.id, "downstream");
  const downstreamLoopIdSet = new Set(downstreamLoopIds);
  const upstreamLoopIds = linkedLoopIds(config, links, selectedLoop.id, "upstream")
    .filter((loopId) => !downstreamLoopIdSet.has(loopId));
  const visibleCompactLoopIds = new Set([...upstreamLoopIds, ...downstreamLoopIds]);
  const upstreamNodes = compactLoopNodes({
    config,
    loopIds: upstreamLoopIds,
    y: loopCanvasLayoutConfig.startY,
    direction
  });
  const upstreamBounds = loopLayoutBounds(upstreamNodes);
  const selectedStartY = upstreamNodes.length > 0
    ? upstreamBounds.maxY + loopCanvasLayoutConfig.selectedCompactLoopRowGap
    : loopCanvasLayoutConfig.startY;
  const selectedBounds = loopLayoutBounds(selectedRow.layout.nodes);
  const selectedOffsetY = selectedStartY - selectedBounds.minY;
  const nodes: LoopCanvasLayoutNode[] = [...upstreamNodes];
  const edges: LoopCanvasEdge[] = [];

  selectedRow.layout.nodes.forEach((node) => {
    nodes.push({
      ...node,
      key: namespaceLoopKey(selectedLoop.id, node.key),
      loopId: selectedLoop.id,
      y: node.y + selectedOffsetY,
      record: node.record ? { ...node.record, loopId: selectedLoop.id } : undefined,
      records: node.records?.map((record) => ({ ...record, loopId: selectedLoop.id }))
    });
  });

  selectedRow.layout.edges.forEach((edge) => {
    edges.push(namespaceLoopEdge(selectedLoop.id, edge));
  });

  const selectedVisibleBounds = loopLayoutBounds(nodes.filter((node) => node.loopId === selectedLoop.id && node.kind !== "loop"));
  const downstreamNodes = compactLoopNodes({
    config,
    loopIds: downstreamLoopIds,
    y: selectedVisibleBounds.maxY + loopCanvasLayoutConfig.selectedCompactLoopRowGap,
    direction
  });
  nodes.push(...downstreamNodes);

  edges.push(
    ...compactLoopEventEdges({
      links,
      compactLoopIds: visibleCompactLoopIds,
      selectedLoopId: selectedLoop.id,
      selectedRow
    }),
    ...selectedToCompactLoopEventEdges({
      selectedRow,
      targetLoopIds: downstreamLoopIdSet,
      links
    })
  );

  return {
    nodes,
    edges: loopEdgesWithDynamicVerticalHandles(edges, nodes),
    direction
  };
}

function loopLayoutRow({
  loop,
  recordsByLoopId,
  editingStepIndexByLoopId,
  direction,
  stepById
}: {
  loop: LoopVisualLoop;
  recordsByLoopId: ReadonlyMap<string, LoopStepRecord[]>;
  editingStepIndexByLoopId: ReadonlyMap<string, number | null>;
  direction: LoopLayoutDirection;
  stepById: ReadonlyMap<string, LoopVisualStep>;
}): LoopLayoutRow {
  const records = (recordsByLoopId.get(loop.id) ?? []).map((record) => ({
    ...record,
    loopId: loop.id,
    step: record.step ?? stepById.get(record.stepKey)
  }));
  const loopGraph = buildLoopGraph(records);

  return {
    loop,
    records,
    loopGraph,
    layout: calculateLoopCanvasLayout({
      loopGraph,
      editingStepIndex: editingStepIndexByLoopId.get(loop.id) ?? null,
      direction
    })
  };
}

function loopEventLinks(
  config: LoopVisualConfig,
  recordsByLoopId: ReadonlyMap<string, LoopStepRecord[]>
): LoopEventLink[] {
  return config.loops.flatMap((loop) => {
    const records = recordsByLoopId.get(loop.id) ?? [];
    return records.flatMap((record) =>
      (record.outputTargets ?? [])
        .flatMap((target) => {
          if (target.type !== "step") return [];
          const targetLoop = resolveEventTargetLoop(config, target);
          if (!targetLoop || targetLoop.id === loop.id) return [];
          return [{
            sourceLoopId: loop.id,
            targetLoopId: targetLoop.id,
            sourceStepIndex: record.index,
            sourceStepId: record.stepKey,
            outputId: target.outputId,
            eventType: target.eventType,
            targetStepId: target.targetStepKey
          } satisfies LoopEventLink];
        })
    );
  });
}

function linkedLoopIds(
  config: LoopVisualConfig,
  links: LoopEventLink[],
  selectedLoopId: string,
  direction: "upstream" | "downstream"
): string[] {
  const visited = new Set<string>();
  const queue = [selectedLoopId];

  while (queue.length > 0) {
    const loopId = queue.shift();
    if (!loopId) continue;
    const candidates = links.filter((link) =>
      direction === "downstream"
        ? link.sourceLoopId === loopId
        : link.targetLoopId === loopId
    );
    candidates.forEach((link) => {
      const linkedLoopId = direction === "downstream" ? link.targetLoopId : link.sourceLoopId;
      if (linkedLoopId === selectedLoopId || visited.has(linkedLoopId)) return;
      visited.add(linkedLoopId);
      queue.push(linkedLoopId);
    });
  }

  return config.loops.map((loop) => loop.id).filter((loopId) => visited.has(loopId));
}

function compactLoopNodes({
  config,
  loopIds,
  y,
  direction
}: {
  config: LoopVisualConfig;
  loopIds: string[];
  y: number;
  direction: LoopLayoutDirection;
}): LoopCanvasLayoutNode[] {
  const loops = loopIds
    .map((loopId) => config.loops.find((candidate) => candidate.id === loopId))
    .filter((loop): loop is LoopVisualLoop => Boolean(loop));
  let nextY = y;

  return loops.map((loop) => {
    const node: LoopCanvasLayoutNode = {
      key: compactLoopNodeKey(loop.id),
      loopId: loop.id,
      kind: "loop",
      x: loopCanvasLayoutConfig.startX,
      y: nextY,
      width: loopNodeSizes.loop.minWidth,
      height: loopNodeSizes.loop.height,
      direction,
      loopSummary: {
        loopId: loop.id
      }
    };
    nextY += loopNodeSizes.loop.height + loopCanvasLayoutConfig.compactLoopRowGap;
    return node;
  });
}

function compactLoopEventEdges({
  links,
  compactLoopIds,
  selectedLoopId,
  selectedRow
}: {
  links: LoopEventLink[];
  compactLoopIds: ReadonlySet<string>;
  selectedLoopId: string;
  selectedRow: LoopLayoutRow;
}): LoopCanvasEdge[] {
  return links.flatMap((link) => {
    const sourceIsCompact = compactLoopIds.has(link.sourceLoopId);
    const targetIsCompact = compactLoopIds.has(link.targetLoopId);
    const targetIsSelected = link.targetLoopId === selectedLoopId;
    if (!sourceIsCompact || (!targetIsCompact && !targetIsSelected)) return [];
    const targetNodeKey = targetIsSelected
      ? selectedLoopTargetStepNodeKey(selectedRow, link)
      : compactLoopNodeKey(link.targetLoopId);
    if (!targetNodeKey) return [];

    return [{
      key: `loop:${link.sourceLoopId}:output:${link.sourceStepIndex}:${link.outputId}:to:${link.targetLoopId}:loop`,
      sourceNodeKey: compactLoopNodeKey(link.sourceLoopId),
      targetNodeKey,
      sourceHandleId: "bottom",
      targetHandleId: targetIsSelected ? "left" : "top",
      eventType: link.eventType,
      label: link.outputId,
      tone: "cross-loop",
      route: {
        sourceLoopId: link.sourceLoopId,
        targetLoopId: link.targetLoopId,
        sourceStepIndex: link.sourceStepIndex,
        sourceStepId: link.sourceStepId,
        handlerStepId: targetIsSelected ? link.targetStepId : undefined,
        handlerLoopId: targetIsSelected ? selectedLoopId : undefined,
        eventType: link.eventType,
        outputId: link.outputId
      }
    } satisfies LoopCanvasEdge];
  });
}

function selectedToCompactLoopEventEdges({
  selectedRow,
  targetLoopIds,
  links
}: {
  selectedRow: LoopLayoutRow;
  targetLoopIds: ReadonlySet<string>;
  links: LoopEventLink[];
}): LoopCanvasEdge[] {
  return links
    .filter((link) => link.sourceLoopId === selectedRow.loop.id && targetLoopIds.has(link.targetLoopId))
    .flatMap((link) => {
      const record = selectedRow.records.find((candidate) => candidate.index === link.sourceStepIndex);
      if (!record) return [];
      const canonicalRecord = loopCanonicalRecord(selectedRow.loopGraph, record);

      return [{
        key: `loop:${selectedRow.loop.id}:output:${link.sourceStepIndex}:${link.outputId}:to:${link.targetLoopId}:loop`,
        sourceNodeKey: namespaceLoopKey(selectedRow.loop.id, `step-${canonicalRecord.index}`),
        targetNodeKey: compactLoopNodeKey(link.targetLoopId),
        sourceHandleId: loopOutputSourceHandleId({ outputId: link.outputId, eventType: link.eventType }),
        targetHandleId: "top",
        eventType: link.eventType,
        label: link.outputId,
        tone: "cross-loop",
        route: {
          sourceLoopId: selectedRow.loop.id,
          targetLoopId: link.targetLoopId,
          sourceStepIndex: link.sourceStepIndex,
          sourceStepId: link.sourceStepId,
          eventType: link.eventType,
          outputId: link.outputId
        }
      } satisfies LoopCanvasEdge];
    });
}

function compactLoopNodeKey(loopId: string) {
  return `loop:${loopId}:loop`;
}

function resolveEventTargetLoop(config: LoopVisualConfig, target: LoopOutputTarget): LoopVisualLoop | undefined {
  if (target.type === "step") return config.loops.find((loop) => loop.id === target.targetLoopId);
  return undefined;
}

function loopLayoutBounds(nodes: LoopCanvasLayoutNode[]) {
  if (nodes.length === 0) {
    return {
      minY: loopCanvasLayoutConfig.startY,
      maxY: loopCanvasLayoutConfig.startY,
      height: loopNodeSizes.step.height
    };
  }
  const minY = Math.min(...nodes.map((node) => node.y));
  const maxY = Math.max(...nodes.map((node) => node.y + node.height));
  return { minY, maxY, height: maxY - minY };
}

function selectedLoopTargetStepNodeKey(row: LoopLayoutRow, link: LoopEventLink) {
  if (row.loop.id !== link.targetLoopId) return undefined;
  return targetLoopStepNodeKey(row.loop.id, link.targetStepId, new Map([[row.loop.id, row]]));
}

function targetLoopStepNodeKey(
  loopId: string,
  stepId: string,
  rowByLoopId: ReadonlyMap<string, LoopLayoutRow>
) {
  const row = rowByLoopId.get(loopId);
  const targetRecord = row?.records.find((record) => record.stepKey === stepId);
  if (!row || !targetRecord) return undefined;
  const canonicalTargetRecord = loopCanonicalRecord(row.loopGraph, targetRecord);
  return namespaceLoopKey(loopId, `step-${canonicalTargetRecord.index}`);
}

function namespaceLoopEdge(loopId: string, edge: LoopCanvasEdge): LoopCanvasEdge {
  return {
    ...edge,
    key: namespaceLoopKey(loopId, edge.key),
    sourceNodeKey: namespaceLoopKey(loopId, edge.sourceNodeKey),
    targetNodeKey: namespaceLoopKey(loopId, edge.targetNodeKey),
    route: edge.route
      ? {
        ...edge.route,
        sourceLoopId: edge.route.sourceLoopId ?? loopId,
        handlerLoopId: edge.route.handlerLoopId ?? loopId
      }
      : undefined
  };
}

function namespaceLoopKey(loopId: string, key: string) {
  return `loop:${loopId}:${key}`;
}

function loopEdgesWithDynamicVerticalHandles(
  edges: LoopCanvasEdge[],
  nodes: LoopCanvasLayoutNode[]
) {
  const nodeByKey = new Map(nodes.map((node) => [node.key, node]));

  return edges.map((edge) => {
    const outputSlotKind = loopEdgeOutputSlotKind(edge);
    const sourceNode = nodeByKey.get(edge.sourceNodeKey);
    const targetNode = nodeByKey.get(edge.targetNodeKey);
    if (outputSlotKind === "approval") {
      return {
        ...edge,
        sourceHandleId: sourceNode?.kind === "loop" ? "bottom" : "right",
        targetHandleId: targetNode?.kind === "loop" ? "top" : "left"
      };
    }
    const isDynamicVerticalEdge = edge.tone === "return" || outputSlotKind === "rework";
    if (!isDynamicVerticalEdge) return edge;
    if (!sourceNode || !targetNode) return edge;
    const isUpwardEdge = targetNode.y + targetNode.height / 2 < sourceNode.y + sourceNode.height / 2;
    if (outputSlotKind === "rework" && (edge.tone === "return" || isUpwardEdge)) {
      return {
        ...edge,
        sourceHandleId: "top",
        targetHandleId: "top"
      };
    }
    const { sourceHandleId, targetHandleId } = loopShortestVerticalHandles(
      sourceNode,
      targetNode,
      outputSlotKind === "rework"
    );

    return {
      ...edge,
      sourceHandleId,
      targetHandleId
    };
  });
}
