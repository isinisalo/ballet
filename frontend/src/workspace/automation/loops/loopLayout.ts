import type { ProjectAutomationConfig, ProjectLoop } from "@shared/api/workspace-contracts";
import { loopEdgeOutputSlotKind } from "./loopEdgeOutputSlot";
import { buildLoopGraph, loopCanonicalRecord, type LoopGraph, type LoopOutputTarget, type LoopStepRecord } from "./loopGraph";
import { loopCanvasLayoutConfig, loopNodeSizes } from "./loopLayoutConfig";
import type { LoopCanvasEdge } from "./loopLayoutEdges";
import { buildLoopLayoutGraphDraft } from "./loopLayoutGraph";
import { positionLoopNodes } from "./loopLayoutPositioning";
import { loopOutputSourceHandleId, loopShortestVerticalHandles, loopSummaryNodeWidth } from "./loopLayoutSizing";
import type { LoopCanvasLayout, LoopCanvasLayoutNode, LoopLayoutDirection } from "./loopLayoutTypes";

type LoopLayoutRow = {
  loop: ProjectLoop;
  records: LoopStepRecord[];
  loopGraph: LoopGraph;
  layout: LoopCanvasLayout;
};

type LoopEventLink = {
  sourceLoopId: string;
  targetLoopId: string;
  sourceStepIndex: number;
  sourceActionId: string;
  outputId: string;
  eventType: string;
  targetActionId: string;
};

// This module intentionally centralizes loop graph layout rules because
// cross-loop routing depends on the same node, row, and edge geometry.
export { loopCanvasLayoutConfig, loopNodeSizes } from "./loopLayoutConfig";
export type { LoopCanvasEdge } from "./loopLayoutEdges";
export {
  loopCanvasNodeAnchorY,
  loopOutputSourceHandleId,
  loopActionOutputHandleY,
  loopActionStackHeight
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
  editingActionIndex,
  direction = "horizontal"
}: {
  loopGraph: LoopGraph;
  editingActionIndex: number | null;
  direction?: LoopLayoutDirection;
}): LoopCanvasLayout {
  const graphDraft = buildLoopLayoutGraphDraft({
    loopGraph,
    editingActionIndex,
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
  editingActionIndexByLoopId = new Map(),
  direction = "horizontal"
}: {
  config: ProjectAutomationConfig;
  selectedLoopId: string;
  recordsByLoopId: ReadonlyMap<string, LoopStepRecord[]>;
  editingActionIndexByLoopId?: ReadonlyMap<string, number | null>;
  direction?: LoopLayoutDirection;
}): LoopCanvasLayout {
  const selectedLoop = config.loops.find((loop) => loop.id === selectedLoopId);
  if (!selectedLoop) return { nodes: [], edges: [], direction };

  const actionById = new Map(config.actions.map((action) => [action.id, action]));
  return calculateSelectedLoopCanvasLayout({
    config,
    selectedLoop,
    recordsByLoopId,
    editingActionIndexByLoopId,
    direction,
    actionById
  });
}

export function calculateAllLoopsCanvasLayout({
  config,
  recordsByLoopId,
  editingActionIndexByLoopId = new Map(),
  direction = "horizontal"
}: {
  config: ProjectAutomationConfig;
  recordsByLoopId: ReadonlyMap<string, LoopStepRecord[]>;
  editingActionIndexByLoopId?: ReadonlyMap<string, number | null>;
  direction?: LoopLayoutDirection;
}): LoopCanvasLayout {
  const actionById = new Map(config.actions.map((action) => [action.id, action]));
  return calculateLoopCanvasLayoutRows({
    config,
    loopIds: new Set(config.loops.map((loop) => loop.id)),
    recordsByLoopId,
    editingActionIndexByLoopId,
    direction,
    actionById
  });
}

function calculateLoopCanvasLayoutRows({
  config,
  loopIds,
  recordsByLoopId,
  editingActionIndexByLoopId,
  direction,
  actionById
}: {
  config: ProjectAutomationConfig;
  loopIds: ReadonlySet<string>;
  recordsByLoopId: ReadonlyMap<string, LoopStepRecord[]>;
  editingActionIndexByLoopId: ReadonlyMap<string, number | null>;
  direction: LoopLayoutDirection;
  actionById: ReadonlyMap<string, ProjectAutomationConfig["actions"][number]>;
}): LoopCanvasLayout {
  const rows = config.loops
    .filter((loop) => loopIds.has(loop.id))
    .map((loop) => loopLayoutRow({
      loop,
      recordsByLoopId,
      editingActionIndexByLoopId,
      direction,
      actionById
    }));
  const rowOffsetByLoopId = loopRowOffsets(rows);
  const rowByLoopId = new Map(rows.map((row) => [row.loop.id, row]));
  const hiddenLocalNodeKeys = new Set<string>();
  const namespacedNodes: LoopCanvasLayoutNode[] = [];
  const namespacedEdges: LoopCanvasEdge[] = [];

  rows.forEach((row) => {
    row.layout.nodes.forEach((node) => {
      if (shouldHideLinkedOutputNode(config, node, loopIds, actionById)) {
        hiddenLocalNodeKeys.add(namespaceLoopKey(row.loop.id, node.key));
        return;
      }
      namespacedNodes.push({
        ...node,
        key: namespaceLoopKey(row.loop.id, node.key),
        loopId: row.loop.id,
        y: node.y + (rowOffsetByLoopId.get(row.loop.id) ?? 0),
        record: node.record ? { ...node.record, loopId: row.loop.id } : undefined,
        records: node.records?.map((record) => ({ ...record, loopId: row.loop.id }))
      });
    });
  });

  rows.forEach((row) => {
    row.layout.edges.forEach((edge) => {
      const sourceNodeKey = namespaceLoopKey(row.loop.id, edge.sourceNodeKey);
      const targetNodeKey = namespaceLoopKey(row.loop.id, edge.targetNodeKey);
      if (hiddenLocalNodeKeys.has(sourceNodeKey) || hiddenLocalNodeKeys.has(targetNodeKey)) return;
      namespacedEdges.push(namespaceLoopEdge(row.loop.id, edge));
    });
  });

  rows.forEach((row) => {
    crossLoopEventEdges(config, row, loopIds, actionById, rowByLoopId).forEach((edge) => namespacedEdges.push(edge));
  });

  return {
    nodes: namespacedNodes,
    edges: loopEdgesWithDynamicVerticalHandles(namespacedEdges, namespacedNodes),
    direction
  };
}

function calculateSelectedLoopCanvasLayout({
  config,
  selectedLoop,
  recordsByLoopId,
  editingActionIndexByLoopId,
  direction,
  actionById
}: {
  config: ProjectAutomationConfig;
  selectedLoop: ProjectLoop;
  recordsByLoopId: ReadonlyMap<string, LoopStepRecord[]>;
  editingActionIndexByLoopId: ReadonlyMap<string, number | null>;
  direction: LoopLayoutDirection;
  actionById: ReadonlyMap<string, ProjectAutomationConfig["actions"][number]>;
}): LoopCanvasLayout {
  const selectedRow = loopLayoutRow({
    loop: selectedLoop,
    recordsByLoopId,
    editingActionIndexByLoopId,
    direction,
    actionById
  });
  const links = loopEventLinks(config, recordsByLoopId, actionById);
  const downstreamLoopIds = linkedLoopIds(config, links, selectedLoop.id, "downstream");
  const downstreamLoopIdSet = new Set(downstreamLoopIds);
  const upstreamLoopIds = linkedLoopIds(config, links, selectedLoop.id, "upstream")
    .filter((loopId) => !downstreamLoopIdSet.has(loopId));
  const visibleCompactLoopIds = new Set([...upstreamLoopIds, ...downstreamLoopIds]);
  const upstreamNodes = compactLoopNodes({
    config,
    loopIds: upstreamLoopIds,
    y: loopCanvasLayoutConfig.startY,
    direction,
    actionById
  });
  const selectedStartY = upstreamNodes.length > 0
    ? loopCanvasLayoutConfig.startY + loopNodeSizes.loop.height + loopCanvasLayoutConfig.selectedCompactLoopRowGap
    : loopCanvasLayoutConfig.startY;
  const selectedBounds = loopLayoutBounds(selectedRow.layout.nodes);
  const selectedOffsetY = selectedStartY - selectedBounds.minY;
  const hiddenSelectedNodeKeys = new Set<string>();
  const nodes: LoopCanvasLayoutNode[] = [...upstreamNodes];
  const edges: LoopCanvasEdge[] = [];

  selectedRow.layout.nodes.forEach((node) => {
    if (shouldHideLinkedOutputNode(config, node, visibleCompactLoopIds, actionById)) {
      hiddenSelectedNodeKeys.add(namespaceLoopKey(selectedLoop.id, node.key));
      return;
    }
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
    const sourceNodeKey = namespaceLoopKey(selectedLoop.id, edge.sourceNodeKey);
    const targetNodeKey = namespaceLoopKey(selectedLoop.id, edge.targetNodeKey);
    if (hiddenSelectedNodeKeys.has(sourceNodeKey) || hiddenSelectedNodeKeys.has(targetNodeKey)) return;
    edges.push(namespaceLoopEdge(selectedLoop.id, edge));
  });

  const selectedVisibleBounds = loopLayoutBounds(nodes.filter((node) => node.loopId === selectedLoop.id && node.kind !== "loop"));
  const downstreamNodes = compactLoopNodes({
    config,
    loopIds: downstreamLoopIds,
    y: selectedVisibleBounds.maxY + loopCanvasLayoutConfig.selectedCompactLoopRowGap,
    direction,
    actionById
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
  editingActionIndexByLoopId,
  direction,
  actionById
}: {
  loop: ProjectLoop;
  recordsByLoopId: ReadonlyMap<string, LoopStepRecord[]>;
  editingActionIndexByLoopId: ReadonlyMap<string, number | null>;
  direction: LoopLayoutDirection;
  actionById: ReadonlyMap<string, ProjectAutomationConfig["actions"][number]>;
}): LoopLayoutRow {
  const records = (recordsByLoopId.get(loop.id) ?? []).map((record) => ({
    ...record,
    loopId: loop.id,
    action: record.action ?? actionById.get(record.actionId)
  }));
  const loopGraph = buildLoopGraph(records);

  return {
    loop,
    records,
    loopGraph,
    layout: calculateLoopCanvasLayout({
      loopGraph,
      editingActionIndex: editingActionIndexByLoopId.get(loop.id) ?? null,
      direction
    })
  };
}

function loopEventLinks(
  config: ProjectAutomationConfig,
  recordsByLoopId: ReadonlyMap<string, LoopStepRecord[]>,
  actionById: ReadonlyMap<string, ProjectAutomationConfig["actions"][number]>
): LoopEventLink[] {
  return config.loops.flatMap((loop) => {
    const records = recordsByLoopId.get(loop.id) ?? [];
    return records.flatMap((record) =>
      (record.outputTargets ?? [])
        .flatMap((target) => {
          if (target.type !== "action") return [];
          const targetLoop = resolveEventTargetLoop(config, target, actionById);
          if (!targetLoop || targetLoop.id === loop.id) return [];
          return [{
            sourceLoopId: loop.id,
            targetLoopId: targetLoop.id,
            sourceStepIndex: record.index,
            sourceActionId: record.actionId,
            outputId: target.outputId,
            eventType: target.eventType,
            targetActionId: target.targetActionId
          } satisfies LoopEventLink];
        })
    );
  });
}

function linkedLoopIds(
  config: ProjectAutomationConfig,
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
  direction,
  actionById
}: {
  config: ProjectAutomationConfig;
  loopIds: string[];
  y: number;
  direction: LoopLayoutDirection;
  actionById: ReadonlyMap<string, ProjectAutomationConfig["actions"][number]>;
}): LoopCanvasLayoutNode[] {
  let nextX = loopCanvasLayoutConfig.startX;

  return loopIds.flatMap((loopId) => {
    const loop = config.loops.find((candidate) => candidate.id === loopId);
    if (!loop) return [];
    const firstAction = actionById.get(loop.steps[0] ?? "");
    const label = compactLoopLabel(loop, firstAction);
    const width = loopSummaryNodeWidth(loop.id);
    const node: LoopCanvasLayoutNode = {
      key: compactLoopNodeKey(loop.id),
      loopId: loop.id,
      kind: "loop",
      x: nextX,
      y,
      width,
      height: loopNodeSizes.loop.height,
      direction,
      loopSummary: {
        loopId: loop.id,
        label,
        action: firstAction?.id
      }
    };
    nextX += width + compactLoopColumnGap();
    return [node];
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
      ? selectedLoopTargetActionNodeKey(selectedRow, link)
      : compactLoopNodeKey(link.targetLoopId);
    if (!targetNodeKey) return [];

    return [{
      key: `loop:${link.sourceLoopId}:output:${link.sourceStepIndex}:${link.outputId}:to:${link.targetLoopId}:loop`,
      sourceNodeKey: compactLoopNodeKey(link.sourceLoopId),
      targetNodeKey,
      sourceHandleId: "right",
      targetHandleId: "left",
      eventType: link.eventType,
      label: link.outputId,
      tone: "cross-loop",
      route: {
        sourceLoopId: link.sourceLoopId,
        targetLoopId: link.targetLoopId,
        sourceStepIndex: link.sourceStepIndex,
        sourceActionId: link.sourceActionId,
        handlerActionId: targetIsSelected ? link.targetActionId : undefined,
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
        sourceNodeKey: namespaceLoopKey(selectedRow.loop.id, `action-${canonicalRecord.index}`),
        targetNodeKey: compactLoopNodeKey(link.targetLoopId),
        sourceHandleId: loopOutputSourceHandleId({ outputId: link.outputId, eventType: link.eventType }),
        targetHandleId: "left",
        eventType: link.eventType,
        label: link.outputId,
        tone: "cross-loop",
        route: {
          sourceLoopId: selectedRow.loop.id,
          targetLoopId: link.targetLoopId,
          sourceStepIndex: link.sourceStepIndex,
          sourceActionId: link.sourceActionId,
          eventType: link.eventType,
          outputId: link.outputId
        }
      } satisfies LoopCanvasEdge];
    });
}

function compactLoopLabel(
  loop: ProjectLoop,
  firstAction: ProjectAutomationConfig["actions"][number] | undefined
) {
  const source = firstAction?.id
    ? firstAction.id.replace(/^create-/, "")
    : loop.id.replace(/\.loop$/, "");
  const label = source
    .split("-")
    .filter(Boolean)
    .join(" ");

  return label ? `${label} loop` : "loop";
}

function compactLoopNodeKey(loopId: string) {
  return `loop:${loopId}:loop`;
}

function compactLoopColumnGap() {
  return loopCanvasLayoutConfig.columnGap * 2;
}

function resolveEventTargetLoop(
  config: ProjectAutomationConfig,
  target: LoopOutputTarget,
  actionById: ReadonlyMap<string, ProjectAutomationConfig["actions"][number]>
): ProjectLoop | undefined {
  void actionById;
  if (target.type === "action") return config.loops.find((loop) => loop.id === target.targetLoopId);
  return undefined;
}

function loopRowOffsets(rows: Array<{ loop: ProjectLoop; layout: LoopCanvasLayout }>) {
  const offsets = new Map<string, number>();
  let nextRowY = loopCanvasLayoutConfig.startY;

  rows.forEach(({ loop, layout }) => {
    const bounds = loopLayoutBounds(layout.nodes);
    offsets.set(loop.id, nextRowY - bounds.minY);
    nextRowY += bounds.height + compositeLoopRowGap();
  });

  return offsets;
}

function loopLayoutBounds(nodes: LoopCanvasLayoutNode[]) {
  if (nodes.length === 0) {
    return {
      minY: loopCanvasLayoutConfig.startY,
      maxY: loopCanvasLayoutConfig.startY,
      height: loopNodeSizes.action.height
    };
  }
  const minY = Math.min(...nodes.map((node) => node.y));
  const maxY = Math.max(...nodes.map((node) => node.y + node.height));
  return { minY, maxY, height: maxY - minY };
}

function compositeLoopRowGap() {
  return loopCanvasLayoutConfig.branchGap * 2 + loopNodeSizes.action.height;
}

function shouldHideLinkedOutputNode(
  config: ProjectAutomationConfig,
  node: LoopCanvasLayoutNode,
  loopIds: ReadonlySet<string>,
  actionById: ReadonlyMap<string, ProjectAutomationConfig["actions"][number]>
) {
  if (node.kind !== "output-event" || !node.outputEvent?.eventType) return false;
  const targetLoop = resolveEventTargetLoop(config, {
    outputId: node.outputEvent.outputId,
    eventType: node.outputEvent.eventType,
    type: "event"
  }, actionById);
  return Boolean(targetLoop && loopIds.has(targetLoop.id));
}

function crossLoopEventEdges(
  config: ProjectAutomationConfig,
  row: {
    loop: ProjectLoop;
    records: LoopStepRecord[];
    loopGraph: LoopGraph;
  },
  loopIds: ReadonlySet<string>,
  actionById: ReadonlyMap<string, ProjectAutomationConfig["actions"][number]>,
  rowByLoopId: ReadonlyMap<string, LoopLayoutRow>
): LoopCanvasEdge[] {
  return row.records.flatMap((record) =>
    (record.outputTargets ?? [])
      .flatMap((target) => {
        if (target.type !== "action") return [];
        const targetLoop = resolveEventTargetLoop(config, target, actionById);
        if (!targetLoop || !loopIds.has(targetLoop.id)) return [];
        const targetNodeKey = targetLoopActionNodeKey(targetLoop.id, target.targetActionId, rowByLoopId);
        if (!targetNodeKey) return [];
        const canonicalRecord = loopCanonicalRecord(row.loopGraph, record);
        const sourceNodeKey = namespaceLoopKey(row.loop.id, `action-${canonicalRecord.index}`);
        return [{
          key: `loop:${row.loop.id}:output:${record.index}:${target.outputId}:to:${targetLoop.id}:action:${target.targetActionId}`,
          sourceNodeKey,
          targetNodeKey,
          sourceHandleId: loopOutputSourceHandleId(target),
          targetHandleId: "left",
          eventType: target.eventType,
          label: target.outputId,
          tone: "cross-loop",
          route: {
            sourceLoopId: row.loop.id,
            targetLoopId: targetLoop.id,
            sourceStepIndex: record.index,
            sourceActionId: record.actionId,
            handlerActionId: target.targetActionId,
            handlerLoopId: targetLoop.id,
            eventType: target.eventType,
            outputId: target.outputId
          }
        } satisfies LoopCanvasEdge];
      })
  );
}

function selectedLoopTargetActionNodeKey(row: LoopLayoutRow, link: LoopEventLink) {
  if (row.loop.id !== link.targetLoopId) return undefined;
  return targetLoopActionNodeKey(row.loop.id, link.targetActionId, new Map([[row.loop.id, row]]));
}

function targetLoopActionNodeKey(
  loopId: string,
  actionId: string,
  rowByLoopId: ReadonlyMap<string, LoopLayoutRow>
) {
  const row = rowByLoopId.get(loopId);
  const targetRecord = row?.records.find((record) => record.actionId === actionId);
  if (!row || !targetRecord) return undefined;
  const canonicalTargetRecord = loopCanonicalRecord(row.loopGraph, targetRecord);
  return namespaceLoopKey(loopId, `action-${canonicalTargetRecord.index}`);
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
    if (outputSlotKind === "approval") {
      return {
        ...edge,
        sourceHandleId: "right",
        targetHandleId: "left"
      };
    }
    const isDynamicVerticalEdge = edge.tone === "return" || outputSlotKind === "rework";
    if (!isDynamicVerticalEdge) return edge;
    const sourceNode = nodeByKey.get(edge.sourceNodeKey);
    const targetNode = nodeByKey.get(edge.targetNodeKey);
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
