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
  sourcePolicyId: string;
  outputId: string;
  eventType: string;
};

// This module intentionally centralizes loop graph layout rules because
// cross-loop routing depends on the same node, row, and edge geometry.
export { loopAddActionGhostLabel, loopCanvasLayoutConfig, loopNodeSizes } from "./loopLayoutConfig";
export type { LoopCanvasEdge } from "./loopLayoutEdges";
export {
  loopCanvasNodeAnchorY,
  loopOutputSourceHandleId,
  loopPolicyOutputHandleY,
  loopPolicyStackHeight
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
  editingPolicyIndex,
  direction = "horizontal"
}: {
  loopGraph: LoopGraph;
  editingPolicyIndex: number | null;
  direction?: LoopLayoutDirection;
}): LoopCanvasLayout {
  const graphDraft = buildLoopLayoutGraphDraft({
    loopGraph,
    editingPolicyIndex,
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
  editingPolicyIndexByLoopId = new Map(),
  direction = "horizontal"
}: {
  config: ProjectAutomationConfig;
  selectedLoopId: string;
  recordsByLoopId: ReadonlyMap<string, LoopStepRecord[]>;
  editingPolicyIndexByLoopId?: ReadonlyMap<string, number | null>;
  direction?: LoopLayoutDirection;
}): LoopCanvasLayout {
  const selectedLoop = config.loops.find((loop) => loop.id === selectedLoopId);
  if (!selectedLoop) return { nodes: [], edges: [], direction };

  const policyById = new Map(config.policies.map((policy) => [policy.id, policy]));
  return calculateSelectedLoopCanvasLayout({
    config,
    selectedLoop,
    recordsByLoopId,
    editingPolicyIndexByLoopId,
    direction,
    policyById
  });
}

export function calculateAllLoopsCanvasLayout({
  config,
  recordsByLoopId,
  editingPolicyIndexByLoopId = new Map(),
  direction = "horizontal"
}: {
  config: ProjectAutomationConfig;
  recordsByLoopId: ReadonlyMap<string, LoopStepRecord[]>;
  editingPolicyIndexByLoopId?: ReadonlyMap<string, number | null>;
  direction?: LoopLayoutDirection;
}): LoopCanvasLayout {
  const policyById = new Map(config.policies.map((policy) => [policy.id, policy]));
  return calculateLoopCanvasLayoutRows({
    config,
    loopIds: new Set(config.loops.map((loop) => loop.id)),
    recordsByLoopId,
    editingPolicyIndexByLoopId,
    direction,
    policyById
  });
}

function calculateLoopCanvasLayoutRows({
  config,
  loopIds,
  recordsByLoopId,
  editingPolicyIndexByLoopId,
  direction,
  policyById
}: {
  config: ProjectAutomationConfig;
  loopIds: ReadonlySet<string>;
  recordsByLoopId: ReadonlyMap<string, LoopStepRecord[]>;
  editingPolicyIndexByLoopId: ReadonlyMap<string, number | null>;
  direction: LoopLayoutDirection;
  policyById: ReadonlyMap<string, ProjectAutomationConfig["policies"][number]>;
}): LoopCanvasLayout {
  const rows = config.loops
    .filter((loop) => loopIds.has(loop.id))
    .map((loop) => loopLayoutRow({
      loop,
      recordsByLoopId,
      editingPolicyIndexByLoopId,
      direction,
      policyById
    }));
  const rowOffsetByLoopId = loopRowOffsets(rows);
  const hiddenLocalNodeKeys = new Set<string>();
  const namespacedNodes: LoopCanvasLayoutNode[] = [];
  const namespacedEdges: LoopCanvasEdge[] = [];

  rows.forEach((row) => {
    row.layout.nodes.forEach((node) => {
      if (shouldHideLinkedOutputNode(config, node, loopIds, policyById)) {
        hiddenLocalNodeKeys.add(namespaceLoopKey(row.loop.id, node.key));
        return;
      }
      namespacedNodes.push({
        ...node,
        key: namespaceLoopKey(row.loop.id, node.key),
        loopId: row.loop.id,
        y: node.y + (rowOffsetByLoopId.get(row.loop.id) ?? 0),
        record: node.record ? { ...node.record, loopId: row.loop.id } : undefined,
        records: node.records?.map((record) => ({ ...record, loopId: row.loop.id })),
        inputEventPolicy: node.kind === "input-event" ? policyById.get(row.loop.steps[0] ?? "") : node.inputEventPolicy
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
    crossLoopEventEdges(config, row, loopIds, policyById).forEach((edge) => namespacedEdges.push(edge));
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
  editingPolicyIndexByLoopId,
  direction,
  policyById
}: {
  config: ProjectAutomationConfig;
  selectedLoop: ProjectLoop;
  recordsByLoopId: ReadonlyMap<string, LoopStepRecord[]>;
  editingPolicyIndexByLoopId: ReadonlyMap<string, number | null>;
  direction: LoopLayoutDirection;
  policyById: ReadonlyMap<string, ProjectAutomationConfig["policies"][number]>;
}): LoopCanvasLayout {
  const selectedRow = loopLayoutRow({
    loop: selectedLoop,
    recordsByLoopId,
    editingPolicyIndexByLoopId,
    direction,
    policyById
  });
  const links = loopEventLinks(config, recordsByLoopId, policyById);
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
    policyById
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
    if (shouldHideLinkedOutputNode(config, node, visibleCompactLoopIds, policyById)) {
      hiddenSelectedNodeKeys.add(namespaceLoopKey(selectedLoop.id, node.key));
      return;
    }
    nodes.push({
      ...node,
      key: namespaceLoopKey(selectedLoop.id, node.key),
      loopId: selectedLoop.id,
      y: node.y + selectedOffsetY,
      record: node.record ? { ...node.record, loopId: selectedLoop.id } : undefined,
      records: node.records?.map((record) => ({ ...record, loopId: selectedLoop.id })),
      inputEventPolicy: node.kind === "input-event" ? policyById.get(selectedLoop.steps[0] ?? "") : node.inputEventPolicy
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
    policyById
  });
  nodes.push(...downstreamNodes);

  edges.push(
    ...compactLoopEventEdges({
      links,
      compactLoopIds: visibleCompactLoopIds,
      selectedLoopId: selectedLoop.id
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
  editingPolicyIndexByLoopId,
  direction,
  policyById
}: {
  loop: ProjectLoop;
  recordsByLoopId: ReadonlyMap<string, LoopStepRecord[]>;
  editingPolicyIndexByLoopId: ReadonlyMap<string, number | null>;
  direction: LoopLayoutDirection;
  policyById: ReadonlyMap<string, ProjectAutomationConfig["policies"][number]>;
}): LoopLayoutRow {
  const records = (recordsByLoopId.get(loop.id) ?? []).map((record) => ({
    ...record,
    loopId: loop.id,
    policy: record.policy ?? policyById.get(record.policyId)
  }));
  const loopGraph = buildLoopGraph(records);

  return {
    loop,
    records,
    loopGraph,
    layout: calculateLoopCanvasLayout({
      loopGraph,
      editingPolicyIndex: editingPolicyIndexByLoopId.get(loop.id) ?? null,
      direction
    })
  };
}

function loopEventLinks(
  config: ProjectAutomationConfig,
  recordsByLoopId: ReadonlyMap<string, LoopStepRecord[]>,
  policyById: ReadonlyMap<string, ProjectAutomationConfig["policies"][number]>
): LoopEventLink[] {
  return config.loops.flatMap((loop) => {
    const records = recordsByLoopId.get(loop.id) ?? [];
    return records.flatMap((record) =>
      (record.outputTargets ?? [])
        .flatMap((target) => {
          const targetLoop = resolveEventTargetLoop(config, target, policyById);
          if (!targetLoop || targetLoop.id === loop.id) return [];
          return [{
            sourceLoopId: loop.id,
            targetLoopId: targetLoop.id,
            sourceStepIndex: record.index,
            sourcePolicyId: record.policyId,
            outputId: target.outputId,
            eventType: target.eventType
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
  policyById
}: {
  config: ProjectAutomationConfig;
  loopIds: string[];
  y: number;
  direction: LoopLayoutDirection;
  policyById: ReadonlyMap<string, ProjectAutomationConfig["policies"][number]>;
}): LoopCanvasLayoutNode[] {
  let nextX = loopCanvasLayoutConfig.startX;

  return loopIds.flatMap((loopId) => {
    const loop = config.loops.find((candidate) => candidate.id === loopId);
    if (!loop) return [];
    const firstPolicy = policyById.get(loop.steps[0] ?? "");
    const label = compactLoopLabel(loop, firstPolicy);
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
        inputEvent: firstPolicy?.event,
        action: firstPolicy?.action
      }
    };
    nextX += width + compactLoopColumnGap();
    return [node];
  });
}

function compactLoopEventEdges({
  links,
  compactLoopIds,
  selectedLoopId
}: {
  links: LoopEventLink[];
  compactLoopIds: ReadonlySet<string>;
  selectedLoopId: string;
}): LoopCanvasEdge[] {
  return links.flatMap((link) => {
    const sourceIsCompact = compactLoopIds.has(link.sourceLoopId);
    const targetIsCompact = compactLoopIds.has(link.targetLoopId);
    const targetIsSelected = link.targetLoopId === selectedLoopId;
    if (!sourceIsCompact || (!targetIsCompact && !targetIsSelected)) return [];

    return [{
      key: `loop:${link.sourceLoopId}:output:${link.sourceStepIndex}:${link.outputId}:to:${link.targetLoopId}:loop`,
      sourceNodeKey: compactLoopNodeKey(link.sourceLoopId),
      targetNodeKey: targetIsSelected ? namespaceLoopKey(selectedLoopId, "input-event") : compactLoopNodeKey(link.targetLoopId),
      sourceHandleId: "right",
      targetHandleId: "left",
      eventType: link.eventType,
      label: link.outputId,
      tone: "cross-loop",
      route: {
        sourceLoopId: link.sourceLoopId,
        targetLoopId: link.targetLoopId,
        sourceStepIndex: link.sourceStepIndex,
        sourcePolicyId: link.sourcePolicyId,
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
        sourceNodeKey: namespaceLoopKey(selectedRow.loop.id, `policy-${canonicalRecord.index}`),
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
          sourcePolicyId: link.sourcePolicyId,
          eventType: link.eventType,
          outputId: link.outputId
        }
      } satisfies LoopCanvasEdge];
    });
}

function compactLoopLabel(
  loop: ProjectLoop,
  firstPolicy: ProjectAutomationConfig["policies"][number] | undefined
) {
  const source = firstPolicy?.action
    ? firstPolicy.action.replace(/^create-/, "")
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
  policyById: ReadonlyMap<string, ProjectAutomationConfig["policies"][number]>
): ProjectLoop | undefined {
  return config.loops.find((loop) => {
    const firstPolicy = policyById.get(loop.steps[0] ?? "");
    return firstPolicy?.event === target.eventType;
  });
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
      height: loopNodeSizes.inputEvent.height
    };
  }
  const minY = Math.min(...nodes.map((node) => node.y));
  const maxY = Math.max(...nodes.map((node) => node.y + node.height));
  return { minY, maxY, height: maxY - minY };
}

function compositeLoopRowGap() {
  return loopCanvasLayoutConfig.branchGap * 2 + loopNodeSizes.policy.height;
}

function shouldHideLinkedOutputNode(
  config: ProjectAutomationConfig,
  node: LoopCanvasLayoutNode,
  loopIds: ReadonlySet<string>,
  policyById: ReadonlyMap<string, ProjectAutomationConfig["policies"][number]>
) {
  if (node.kind !== "output-event" || !node.outputEvent?.eventType) return false;
  const targetLoop = resolveEventTargetLoop(config, {
    outputId: node.outputEvent.outputId,
    eventType: node.outputEvent.eventType,
    type: "event"
  }, policyById);
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
  policyById: ReadonlyMap<string, ProjectAutomationConfig["policies"][number]>
): LoopCanvasEdge[] {
  return row.records.flatMap((record) =>
    (record.outputTargets ?? [])
      .flatMap((target) => {
        const targetLoop = resolveEventTargetLoop(config, target, policyById);
        if (!targetLoop || !loopIds.has(targetLoop.id)) return [];
        const canonicalRecord = loopCanonicalRecord(row.loopGraph, record);
        const sourceNodeKey = namespaceLoopKey(row.loop.id, `policy-${canonicalRecord.index}`);
        const targetNodeKey = namespaceLoopKey(targetLoop.id, "input-event");
        return [{
          key: `loop:${row.loop.id}:output:${record.index}:${target.outputId}:to:${targetLoop.id}:input-event`,
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
            sourcePolicyId: record.policyId,
            eventType: target.eventType,
            outputId: target.outputId
          }
        } satisfies LoopCanvasEdge];
      })
  );
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
