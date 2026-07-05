import dagre from "@dagrejs/dagre";
import { workflowOutputEvents, type WorkflowGraph, type WorkflowOutputTarget, type WorkflowStepRecord } from "./workflowGraph";
import {
  workflowExistingHandlerEdges,
  workflowEventOutputLabel,
  type WorkflowCanvasEdge,
  type WorkflowHandledEventNode
} from "./workflowLayoutEdges";

export type { WorkflowCanvasEdge } from "./workflowLayoutEdges";

export type WorkflowLayoutDirection = "horizontal" | "vertical";

export type WorkflowCanvasNodeKind =
  | "trigger"
  | "policy"
  | "output-event"
  | "first-policy-ghost";

export type WorkflowCanvasOutputEvent = {
  outputId: string;
  eventType: string;
  outputType: "event";
};

export type WorkflowCanvasLayoutNode = {
  key: string;
  kind: WorkflowCanvasNodeKind;
  x: number;
  y: number;
  width: number;
  height: number;
  direction: WorkflowLayoutDirection;
  record?: WorkflowStepRecord;
  eventType?: string;
  outputEvent?: WorkflowCanvasOutputEvent;
  sourcePolicyId?: string;
  isEditingPolicy?: boolean;
  outputIndex?: number;
  outputHandleCount?: number;
};

export type WorkflowCanvasLayout = {
  nodes: WorkflowCanvasLayoutNode[];
  edges: WorkflowCanvasEdge[];
  direction: WorkflowLayoutDirection;
};

export const workflowNodeSizes = {
  trigger: { minWidth: 28, maxWidth: 28, height: 22 },
  policy: { minWidth: 136, maxWidth: 220, height: 22 },
  event: { width: 240, height: 46 },
  outputEvent: { minWidth: 76, maxWidth: 120, height: 22, rowGap: 16 },
  action: { width: 28, height: 28 }
};

export const workflowCanvasLayoutConfig = {
  startX: 32,
  startY: 64,
  columnGap: 72,
  branchGap: 28,
  edgePad: 18,
  triggerAnchorY: 11,
  policyAnchorY: 11,
  outputEventsLaneGap: 24
};

const workflowEdgeLabelLayout = {
  minGap: 80,
  paddingX: 12,
  characterWidth: 6.25,
  clearance: 24
};

export const workflowAddActionGhostLabel = "+ Action";

const workflowDirectionHandles: Record<WorkflowLayoutDirection, { rankdir: "LR" | "TB"; sourceHandleId: string; targetHandleId: string }> = {
  horizontal: { rankdir: "LR", sourceHandleId: "right", targetHandleId: "left" },
  vertical: { rankdir: "TB", sourceHandleId: "right", targetHandleId: "left" }
};

type WorkflowCanvasLayoutNodeDraft = Omit<WorkflowCanvasLayoutNode, "x" | "y">;

type WorkflowDagreEdge = {
  source: string;
  target: string;
  label?: string;
};

type WorkflowActiveOutputTask =
  | { kind: "children"; output: WorkflowOutputTarget; childRecords: WorkflowStepRecord[] }
  | { kind: "existing-handler"; output: WorkflowOutputTarget; hasBackwardHandler: boolean };

type WorkflowLayoutMetrics = {
  horizontalRootPolicyX: number;
  horizontalPolicyColumnStep: number;
  horizontalRowStep: number;
  verticalRootPolicyY: number;
  verticalPolicyRankStep: number;
  verticalColumnStep: number;
};

function workflowPolicyInputEdgeLabel(record: WorkflowStepRecord) {
  if (!record.policy) return undefined;
  if (record.policy.source === "trigger") return record.policy.trigger || "Missing trigger";
  return record.policy.event ? workflowEventOutputLabel(record.policy.event) : "Missing event";
}

function workflowOutputEdgeLabel(output: WorkflowOutputTarget) {
  return output.outputId === output.eventType ? workflowEventOutputLabel(output.eventType) : output.outputId;
}

export function workflowCanvasNodeAnchorY(layoutNode: Pick<WorkflowCanvasLayoutNode, "height" | "kind">) {
  if (layoutNode.kind === "trigger") return workflowCanvasLayoutConfig.triggerAnchorY;
  if (layoutNode.kind === "policy") return workflowCanvasLayoutConfig.policyAnchorY;
  return layoutNode.height / 2;
}

export function calculateWorkflowCanvasLayout({
  workflowGraph,
  editingPolicyIndex,
  direction = "horizontal"
}: {
  workflowGraph: WorkflowGraph;
  editingPolicyIndex: number | null;
  direction?: WorkflowLayoutDirection;
}): WorkflowCanvasLayout {
  const nodeDrafts = new Map<string, WorkflowCanvasLayoutNodeDraft>();
  const dagreEdges: WorkflowDagreEdge[] = [];
  const canvasEdges: WorkflowCanvasEdge[] = [];
  const edgeKeys = new Set<string>();
  const policyNodeIndexes = new Set<number>();
  const handledEventNodes: WorkflowHandledEventNode[] = [];
  const { sourceHandleId, targetHandleId } = workflowDirectionHandles[direction];

  const addNode = (node: WorkflowCanvasLayoutNodeDraft) => {
    if (nodeDrafts.has(node.key)) return;
    nodeDrafts.set(node.key, node);
  };

  const addDagreEdge = (edge: WorkflowDagreEdge) => {
    dagreEdges.push(edge);
  };

  const addCanvasEdge = (edge: WorkflowCanvasEdge) => {
    if (edgeKeys.has(edge.key)) return;
    edgeKeys.add(edge.key);
    canvasEdges.push(edge);
  };

  const addPolicyNode = (record: WorkflowStepRecord, outputHandleCount: number) => {
    const isEditingPolicy = editingPolicyIndex === record.index;
    addNode({
      key: `policy-${record.index}`,
      kind: "policy",
      width: workflowPolicyNodeWidth(record),
      height: workflowNodeSizes.policy.height,
      direction,
      record,
      isEditingPolicy,
      outputHandleCount
    });
    policyNodeIndexes.add(record.index);
  };

  const addOutputEventNode = (record: WorkflowStepRecord, output: WorkflowOutputTarget, outputIndex: number) => {
    const key = `output-event-${record.index}-${output.outputId}`;
    addNode({
      key,
      kind: "output-event",
      width: workflowOutputEventNodeWidth(),
      height: workflowNodeSizes.outputEvent.height,
      direction,
      record,
      outputEvent: {
        outputId: output.outputId,
        eventType: output.eventType,
        outputType: output.type
      },
      sourcePolicyId: record.policyId,
      outputIndex
    });
    addDagreEdge({ source: `policy-${record.index}`, target: key });
    addCanvasEdge({
      key: `policy-output-event-${record.index}-${output.outputId}`,
      sourceNodeKey: `policy-${record.index}`,
      targetNodeKey: key,
      sourceHandleId: workflowOutputSourceHandleId(),
      targetHandleId,
      dashed: true,
      eventType: output.eventType,
      label: workflowOutputEdgeLabel(output)
    });
  };

  const layoutPolicyBranch = (record: WorkflowStepRecord, visitedPolicyIds = new Set<string>()) => {
    if (visitedPolicyIds.has(record.policyId)) return;
    const nextVisitedPolicyIds = new Set(visitedPolicyIds);
    const activeOutputTasks: WorkflowActiveOutputTask[] = [];
    const inactiveOutputTargets: WorkflowOutputTarget[] = [];
    nextVisitedPolicyIds.add(record.policyId);

    const recordOutputTargets = record.outputTargets ?? workflowOutputEvents(record).map((eventType) => ({
      outputId: eventType,
      eventType,
      type: "event" as const
    }));

    recordOutputTargets.forEach((output) => {
      const { eventType } = output;
      const childRecords = (workflowGraph.childRecordsByParentEvent.get(`${record.index}:${eventType}`) ?? [])
        .filter((childRecord) => childRecord.policyId !== record.policyId && !nextVisitedPolicyIds.has(childRecord.policyId));
      const existingHandlerRecords = (workflowGraph.eventHandlerRecordsByEvent.get(eventType) ?? [])
        .filter((handlerRecord) => handlerRecord.index !== record.index);

      if (childRecords.length > 0) {
        activeOutputTasks.push({ kind: "children", output, childRecords });
        return;
      }

      if (existingHandlerRecords.length > 0) {
        activeOutputTasks.push({
          kind: "existing-handler",
          output,
          hasBackwardHandler: existingHandlerRecords.some((handlerRecord) => handlerRecord.index < record.index)
        });
        return;
      }

      inactiveOutputTargets.push(output);
    });

    const visibleInactiveOutputTargets = activeOutputTasks.some((task) => task.kind === "existing-handler" && task.hasBackwardHandler)
      ? []
      : inactiveOutputTargets;
    addPolicyNode(record, activeOutputTasks.length + visibleInactiveOutputTargets.length);

    activeOutputTasks.forEach((task) => {
      if (task.kind === "existing-handler") {
        handledEventNodes.push({
          eventType: task.output.eventType,
          label: workflowOutputEdgeLabel(task.output),
          sourceIndex: record.index,
          sourceNodeKey: `policy-${record.index}`,
          sourceHandleId: workflowOutputSourceHandleId()
        });
        return;
      }

      task.childRecords.forEach((childRecord) => {
        layoutPolicyBranch(childRecord, nextVisitedPolicyIds);
        addDagreEdge({
          source: `policy-${record.index}`,
          target: `policy-${childRecord.index}`,
          label: workflowOutputEdgeLabel(task.output)
        });
        addCanvasEdge({
          key: `policy-policy-${record.index}-${childRecord.index}-${task.output.eventType}`,
          sourceNodeKey: `policy-${record.index}`,
          targetNodeKey: `policy-${childRecord.index}`,
          sourceHandleId: workflowOutputSourceHandleId(),
          targetHandleId,
          eventType: task.output.eventType,
          label: workflowOutputEdgeLabel(task.output)
        });
      });
    });

    visibleInactiveOutputTargets.forEach((output, inactiveIndex) => {
      addOutputEventNode(record, output, activeOutputTasks.length + inactiveIndex);
    });
  };

  addNode({
    key: "trigger",
    kind: "trigger",
    width: workflowTriggerNodeWidth(),
    height: workflowNodeSizes.trigger.height,
    direction
  });

  if (workflowGraph.rootRecords.length > 0) {
    workflowGraph.rootRecords.forEach((record) => {
      layoutPolicyBranch(record);
      addDagreEdge({
        source: "trigger",
        target: `policy-${record.index}`,
        label: workflowPolicyInputEdgeLabel(record)
      });
      addCanvasEdge({
        key: `trigger-policy-${record.index}`,
        sourceNodeKey: "trigger",
        targetNodeKey: `policy-${record.index}`,
        sourceHandleId,
        targetHandleId,
        dashed: !record.policy,
        label: workflowPolicyInputEdgeLabel(record)
      });
    });
  } else {
    addNode({
      key: "first-policy-ghost",
      kind: "first-policy-ghost",
      width: workflowNodeSizes.event.width,
      height: workflowNodeSizes.event.height,
      direction
    });
    addDagreEdge({ source: "trigger", target: "first-policy-ghost" });
    addCanvasEdge({
      key: "trigger-first-policy",
      sourceNodeKey: "trigger",
      targetNodeKey: "first-policy-ghost",
      sourceHandleId,
      targetHandleId,
      dashed: true
    });
  }

  workflowExistingHandlerEdges({
    workflowGraph,
    policyNodeIndexes,
    handledEventNodes,
    sourceHandleId,
    targetHandleId
  }).forEach(addCanvasEdge);

  return {
    nodes: positionWorkflowNodes([...nodeDrafts.values()], dagreEdges, direction),
    edges: canvasEdges,
    direction
  };
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

function positionWorkflowNodes(nodes: WorkflowCanvasLayoutNodeDraft[], edges: WorkflowDagreEdge[], direction: WorkflowLayoutDirection): WorkflowCanvasLayoutNode[] {
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

export function workflowPolicyStackHeight() {
  return workflowNodeSizes.policy.height;
}

function workflowOutputEventNodeWidth() {
  return workflowOutputNodeWidth(workflowAddActionGhostLabel, workflowNodeSizes.outputEvent.minWidth, workflowNodeSizes.outputEvent.maxWidth);
}

function workflowPolicyNodeWidth(record: WorkflowStepRecord) {
  return workflowOutputNodeWidth(`then: ${record.policy?.action || record.policyId || "No policy"}`, workflowNodeSizes.policy.minWidth, workflowNodeSizes.policy.maxWidth);
}

function workflowTriggerNodeWidth() {
  return workflowOutputNodeWidth("", workflowNodeSizes.trigger.minWidth, workflowNodeSizes.trigger.maxWidth);
}

function workflowOutputNodeWidth(value: string, minWidth: number, maxWidth: number) {
  const iconAndGapWidth = 20;
  const estimatedCharacterWidth = 7;
  return Math.min(
    maxWidth,
    Math.max(minWidth, iconAndGapWidth + value.length * estimatedCharacterWidth)
  );
}

function workflowHorizontalEdgeGap(edges: WorkflowDagreEdge[]) {
  const maxLabelWidth = Math.max(
    0,
    ...edges.map((edge) => edge.label ? workflowEdgeLabelWidth(edge.label) : 0)
  );
  return Math.max(
    workflowEdgeLabelLayout.minGap,
    Math.ceil(maxLabelWidth + workflowEdgeLabelLayout.clearance)
  );
}

function workflowEdgeLabelWidth(label: string) {
  return workflowEdgeLabelLayout.paddingX + label.length * workflowEdgeLabelLayout.characterWidth;
}

function outputEventStackStep() {
  return workflowNodeSizes.outputEvent.height + workflowNodeSizes.outputEvent.rowGap;
}

function outputEventStackHeight(count: number) {
  if (count <= 0) return workflowNodeSizes.outputEvent.height;
  return count * workflowNodeSizes.outputEvent.height + Math.max(0, count - 1) * workflowNodeSizes.outputEvent.rowGap;
}

function canAlignTerminalOutputEvents(outputHandleCount: number) {
  if (outputHandleCount <= 1) return true;
  const firstHandleY = workflowPolicyOutputHandleY(0, outputHandleCount);
  const secondHandleY = workflowPolicyOutputHandleY(1, outputHandleCount);
  const rowGap = secondHandleY - firstHandleY - workflowNodeSizes.outputEvent.height;
  return rowGap >= workflowNodeSizes.outputEvent.rowGap / 2;
}

function workflowBranchStackHeight(node: Pick<WorkflowCanvasLayoutNode, "height" | "kind">) {
  return node.kind === "policy"
    ? workflowPolicyStackHeight()
    : node.height;
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

function workflowNodeRanks(nodes: WorkflowCanvasLayoutNodeDraft[], edges: WorkflowDagreEdge[]) {
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

function workflowNodeOrderIndexes(nodes: WorkflowCanvasLayoutNodeDraft[], edges: WorkflowDagreEdge[], direction: WorkflowLayoutDirection) {
  if (direction === "horizontal") return workflowHorizontalLaneIndexes(nodes, edges);

  const dagrePositions = workflowDagrePositions(nodes, edges, direction);
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

function workflowHorizontalLaneIndexes(nodes: WorkflowCanvasLayoutNodeDraft[], edges: WorkflowDagreEdge[]) {
  const nodeKeys = new Set(nodes.map((node) => node.key));
  const laneIndexes = new Map<string, number>();
  const outgoingEdges = new Map<string, WorkflowDagreEdge[]>();
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

  assignLane("trigger", 0);
  nodes.forEach((node) => {
    if (!laneIndexes.has(node.key)) assignLane(node.key, nextLaneIndex++);
  });

  return compactWorkflowLaneIndexes(laneIndexes);
}

function compactWorkflowLaneIndexes(laneIndexes: ReadonlyMap<string, number>) {
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

function workflowHorizontalLaneYOffsets(
  nodes: WorkflowCanvasLayoutNodeDraft[],
  outputNodes: WorkflowCanvasLayoutNodeDraft[],
  edges: WorkflowDagreEdge[],
  laneIndexes: ReadonlyMap<string, number>
) {
  const primaryNodeByKey = new Map(nodes.map((node) => [node.key, node]));
  const laneCount = Math.max(0, ...[...laneIndexes.values()]) + 1;
  const laneHeights = Array.from({ length: laneCount }, () => 0);

  nodes.forEach((node) => {
    const laneIndex = laneIndexes.get(node.key);
    if (laneIndex === undefined) return;
    laneHeights[laneIndex] = Math.max(laneHeights[laneIndex], workflowBranchStackHeight(node));
  });

  outputNodesBySourceKey(outputNodes).forEach((sourceOutputNodes, sourceKey) => {
    const sourceNode = primaryNodeByKey.get(sourceKey);
    const sourceLaneIndex = laneIndexes.get(sourceKey);
    if (!sourceNode || sourceLaneIndex === undefined) return;
    const outputStackHeightValue = outputEventStackHeight(sourceOutputNodes.length);
    const childNodes = edges
      .filter((edge) => edge.source === sourceKey && edge.target.startsWith("policy-"))
      .map((edge) => primaryNodeByKey.get(edge.target))
      .filter((childNode): childNode is WorkflowCanvasLayoutNodeDraft => Boolean(childNode));

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
      workflowBranchStackHeight(lastChildNode) + workflowNodeSizes.outputEvent.rowGap + outputStackHeightValue
    );
  });

  const laneYOffsets = new Map<number, number>();
  let nextOffset = 0;
  laneHeights.forEach((laneHeight, laneIndex) => {
    laneYOffsets.set(laneIndex, nextOffset);
    nextOffset += Math.max(laneHeight, workflowNodeSizes.trigger.height) + workflowCanvasLayoutConfig.branchGap;
  });
  return laneYOffsets;
}

function outputNodesBySourceKey(outputNodes: WorkflowCanvasLayoutNodeDraft[]) {
  const nodesBySourceKey = new Map<string, WorkflowCanvasLayoutNodeDraft[]>();

  outputNodes.forEach((node) => {
    const sourceKey = node.record ? `policy-${node.record.index}` : "";
    if (!sourceKey) return;
    nodesBySourceKey.set(sourceKey, [...(nodesBySourceKey.get(sourceKey) ?? []), node]);
  });

  return nodesBySourceKey;
}

function workflowDagrePositions(nodes: WorkflowCanvasLayoutNodeDraft[], edges: WorkflowDagreEdge[], direction: WorkflowLayoutDirection) {
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: workflowDirectionHandles[direction].rankdir,
    ranksep: workflowCanvasLayoutConfig.columnGap,
    nodesep: workflowCanvasLayoutConfig.branchGap,
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
