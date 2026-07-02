import dagre from "@dagrejs/dagre";
import { workflowOutputEvents, type WorkflowGraph, type WorkflowStepRecord } from "./workflowGraph";
import {
  workflowExistingHandlerEdges,
  type WorkflowCanvasEdge,
  type WorkflowHandledEventNode
} from "./workflowLayoutEdges";

export type { WorkflowCanvasEdge } from "./workflowLayoutEdges";

export type WorkflowLayoutDirection = "horizontal" | "vertical";

export type WorkflowCanvasNodeKind =
  | "trigger"
  | "policy"
  | "save-policy"
  | "edit-policy"
  | "delete-policy"
  | "output-events"
  | "first-policy-ghost";

export type WorkflowCanvasOutputEvent = {
  eventType: string;
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
  outputEvents?: WorkflowCanvasOutputEvent[];
  sourcePolicyId?: string;
  isEditingPolicy?: boolean;
};

export type WorkflowCanvasLayout = {
  nodes: WorkflowCanvasLayoutNode[];
  edges: WorkflowCanvasEdge[];
  direction: WorkflowLayoutDirection;
};

export const workflowNodeSizes = {
  trigger: { width: 176, height: 46 },
  policy: { width: 240, height: 92 },
  event: { width: 240, height: 46 },
  outputEvents: { width: 240, minHeight: 46, paddingY: 16, rowHeight: 24, rowGap: 4 },
  action: { width: 28, height: 28 }
};

export const workflowCanvasLayoutConfig = {
  startX: 32,
  startY: 64,
  columnGap: 36,
  branchGap: 20,
  edgePad: 18,
  policyAnchorY: 18
};

const workflowDirectionHandles: Record<WorkflowLayoutDirection, { rankdir: "LR" | "TB"; sourceHandleId: string; targetHandleId: string }> = {
  horizontal: { rankdir: "LR", sourceHandleId: "right", targetHandleId: "left" },
  vertical: { rankdir: "TB", sourceHandleId: "bottom", targetHandleId: "top" }
};

type WorkflowCanvasLayoutNodeDraft = Omit<WorkflowCanvasLayoutNode, "x" | "y">;

type WorkflowDagreEdge = {
  source: string;
  target: string;
};

type WorkflowLayoutMetrics = {
  horizontalRootPolicyX: number;
  horizontalPolicyColumnStep: number;
  horizontalRowStep: number;
  verticalRootPolicyY: number;
  verticalPolicyRankStep: number;
  verticalColumnStep: number;
};

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

  const addPolicyNode = (record: WorkflowStepRecord) => {
    const isEditingPolicy = editingPolicyIndex === record.index;
    addNode({
      key: `policy-${record.index}`,
      kind: "policy",
      width: workflowNodeSizes.policy.width,
      height: workflowNodeSizes.policy.height,
      direction,
      record,
      isEditingPolicy
    });
    policyNodeIndexes.add(record.index);
  };

  const addOutputEventsNode = (record: WorkflowStepRecord, outputEvents: string[]) => {
    const key = `output-events-${record.index}`;
    addNode({
      key,
      kind: "output-events",
      width: workflowNodeSizes.outputEvents.width,
      height: workflowOutputEventsNodeHeight(outputEvents.length),
      direction,
      record,
      outputEvents: outputEvents.map((eventType) => ({ eventType })),
      sourcePolicyId: record.policyId
    });
    addCanvasEdge({
      key: `policy-output-events-${record.index}`,
      sourceNodeKey: `policy-${record.index}`,
      targetNodeKey: key,
      sourceHandleId,
      targetHandleId,
      dashed: !record.policy
    });
  };

  const layoutPolicyBranch = (record: WorkflowStepRecord, visitedPolicyIds = new Set<string>()) => {
    if (visitedPolicyIds.has(record.policyId)) return;
    const nextVisitedPolicyIds = new Set(visitedPolicyIds);
    const outputEvents: string[] = [];
    nextVisitedPolicyIds.add(record.policyId);
    addPolicyNode(record);

    workflowOutputEvents(record).forEach((eventType) => {
      const childRecords = (workflowGraph.childRecordsByParentEvent.get(`${record.index}:${eventType}`) ?? [])
        .filter((childRecord) => childRecord.policyId !== record.policyId && !nextVisitedPolicyIds.has(childRecord.policyId));
      const existingHandlerRecords = (workflowGraph.eventHandlerRecordsByEvent.get(eventType) ?? [])
        .filter((handlerRecord) => handlerRecord.index !== record.index);

      if (childRecords.length > 0) {
        childRecords.forEach((childRecord) => {
          layoutPolicyBranch(childRecord, nextVisitedPolicyIds);
          addDagreEdge({ source: `policy-${record.index}`, target: `policy-${childRecord.index}` });
          addCanvasEdge({
            key: `policy-policy-${record.index}-${childRecord.index}-${eventType}`,
            sourceNodeKey: `policy-${record.index}`,
            targetNodeKey: `policy-${childRecord.index}`,
            sourceHandleId,
            targetHandleId,
            eventType
          });
        });
        return;
      }

      if (existingHandlerRecords.length > 0) {
        handledEventNodes.push({
          eventType,
          sourceIndex: record.index,
          sourceNodeKey: `policy-${record.index}`
        });
        return;
      }

      outputEvents.push(eventType);
    });

    if (outputEvents.length > 0) addOutputEventsNode(record, outputEvents);
  };

  addNode({
    key: "trigger",
    kind: "trigger",
    width: workflowNodeSizes.trigger.width,
    height: workflowNodeSizes.trigger.height,
    direction
  });

  if (workflowGraph.rootRecords.length > 0) {
    workflowGraph.rootRecords.forEach((record) => {
      layoutPolicyBranch(record);
      addDagreEdge({ source: "trigger", target: `policy-${record.index}` });
      addCanvasEdge({
        key: `trigger-policy-${record.index}`,
        sourceNodeKey: "trigger",
        targetNodeKey: `policy-${record.index}`,
        sourceHandleId,
        targetHandleId,
        dashed: !record.policy
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

  const positionedNodes = positionWorkflowNodes([...nodeDrafts.values()], dagreEdges, direction);
  const actionNodes = positionedNodes.flatMap((node) => actionNodesForPolicy(node, editingPolicyIndex));

  return {
    nodes: [...positionedNodes, ...actionNodes],
    edges: canvasEdges,
    direction
  };
}

export function workflowOutputEventsNodeHeight(eventCount: number) {
  if (eventCount <= 0) return workflowNodeSizes.outputEvents.minHeight;
  const rowTotal = eventCount * workflowNodeSizes.outputEvents.rowHeight;
  const gapTotal = Math.max(0, eventCount - 1) * workflowNodeSizes.outputEvents.rowGap;
  return Math.max(workflowNodeSizes.outputEvents.minHeight, workflowNodeSizes.outputEvents.paddingY + rowTotal + gapTotal);
}

function positionWorkflowNodes(nodes: WorkflowCanvasLayoutNodeDraft[], edges: WorkflowDagreEdge[], direction: WorkflowLayoutDirection): WorkflowCanvasLayoutNode[] {
  const primaryNodes = nodes.filter((node) => node.kind !== "output-events");
  const outputNodes = nodes.filter((node) => node.kind === "output-events");
  const metrics = workflowLayoutMetrics(outputNodes);
  const positionedPrimaryNodes = positionPrimaryNodes(primaryNodes, edges, direction, metrics);
  const primaryNodeByKey = new Map(positionedPrimaryNodes.map((node) => [node.key, node]));
  const positionedOutputNodes = outputNodes.map((node) => positionOutputEventsNode(node, primaryNodeByKey, edges, direction, metrics));

  return [...positionedPrimaryNodes, ...positionedOutputNodes];
}

function positionPrimaryNodes(
  nodes: WorkflowCanvasLayoutNodeDraft[],
  edges: WorkflowDagreEdge[],
  direction: WorkflowLayoutDirection,
  metrics: WorkflowLayoutMetrics
): WorkflowCanvasLayoutNode[] {
  const ranks = workflowNodeRanks(nodes, edges);
  const orderIndexes = workflowNodeOrderIndexes(nodes, edges, direction);

  return nodes.map((node) => {
    const rank = ranks.get(node.key) ?? 0;
    const orderIndex = orderIndexes.get(node.key) ?? 0;

    return {
      ...node,
      x: direction === "horizontal"
        ? horizontalNodeX(rank, metrics)
        : workflowCanvasLayoutConfig.startX + orderIndex * metrics.verticalColumnStep,
      y: direction === "horizontal"
        ? workflowCanvasLayoutConfig.startY + orderIndex * metrics.horizontalRowStep
        : verticalNodeY(rank, metrics)
    };
  });
}

function positionOutputEventsNode(
  node: WorkflowCanvasLayoutNodeDraft,
  nodeByKey: ReadonlyMap<string, WorkflowCanvasLayoutNode>,
  edges: WorkflowDagreEdge[],
  direction: WorkflowLayoutDirection,
  metrics: WorkflowLayoutMetrics
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
      ? nextHorizontalOutputEventsY(childNodes, sourceNode)
      : childNodes[0]?.y ?? sourceNode.y + metrics.verticalPolicyRankStep
  };
}

function nextHorizontalOutputEventsY(childNodes: WorkflowCanvasLayoutNode[], sourceNode: WorkflowCanvasLayoutNode) {
  if (childNodes.length === 0) return sourceNode.y;
  return Math.max(...childNodes.map((childNode) => childNode.y + workflowPolicyStackHeight()));
}

function nextVerticalOutputEventsX(childNodes: WorkflowCanvasLayoutNode[], sourceNode: WorkflowCanvasLayoutNode) {
  if (childNodes.length === 0) return sourceNode.x;
  return Math.max(...childNodes.map((childNode) => childNode.x + childNode.width + workflowCanvasLayoutConfig.branchGap));
}

function workflowLayoutMetrics(outputNodes: WorkflowCanvasLayoutNodeDraft[]): WorkflowLayoutMetrics {
  const maxOutputHeight = Math.max(workflowNodeSizes.outputEvents.minHeight, ...outputNodes.map((node) => node.height));
  const policyStackHeight = workflowPolicyStackHeight();

  return {
    horizontalRootPolicyX: workflowCanvasLayoutConfig.startX + workflowNodeSizes.trigger.width + workflowCanvasLayoutConfig.columnGap,
    horizontalPolicyColumnStep: workflowNodeSizes.policy.width + workflowCanvasLayoutConfig.columnGap,
    horizontalRowStep: Math.max(policyStackHeight, maxOutputHeight, workflowNodeSizes.trigger.height) + workflowCanvasLayoutConfig.branchGap,
    verticalRootPolicyY: workflowCanvasLayoutConfig.startY + workflowNodeSizes.trigger.height + workflowCanvasLayoutConfig.branchGap,
    verticalPolicyRankStep: policyStackHeight + maxOutputHeight + workflowCanvasLayoutConfig.branchGap,
    verticalColumnStep: Math.max(workflowNodeSizes.policy.width, workflowNodeSizes.outputEvents.width) + workflowCanvasLayoutConfig.branchGap
  };
}

export function workflowPolicyStackHeight() {
  return workflowNodeSizes.policy.height + workflowNodeSizes.action.height + 12;
}

function horizontalNodeX(rank: number, metrics: WorkflowLayoutMetrics) {
  if (rank <= 0) return workflowCanvasLayoutConfig.startX;
  return metrics.horizontalRootPolicyX + (rank - 1) * metrics.horizontalPolicyColumnStep;
}

function verticalNodeY(rank: number, metrics: WorkflowLayoutMetrics) {
  if (rank <= 0) return workflowCanvasLayoutConfig.startY;
  return metrics.verticalRootPolicyY + (rank - 1) * metrics.verticalPolicyRankStep;
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

  return laneIndexes;
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

function actionNodesForPolicy(node: WorkflowCanvasLayoutNode, editingPolicyIndex: number | null): WorkflowCanvasLayoutNode[] {
  if (node.kind !== "policy" || !node.record) return [];

  const deleteX = node.x + workflowNodeSizes.policy.width - workflowNodeSizes.action.width;
  const editX = deleteX - workflowNodeSizes.action.width - 6;
  const actionY = node.y + workflowNodeSizes.policy.height + 6;
  const isEditingPolicy = editingPolicyIndex === node.record.index;
  const saveOrEdit: WorkflowCanvasLayoutNode = {
    key: isEditingPolicy ? `save-${node.record.index}` : `edit-${node.record.index}`,
    kind: isEditingPolicy ? "save-policy" : "edit-policy",
    x: isEditingPolicy ? deleteX : editX,
    y: actionY,
    width: workflowNodeSizes.action.width,
    height: workflowNodeSizes.action.height,
    direction: node.direction,
    record: node.record
  };

  if (isEditingPolicy) return [saveOrEdit];

  return [
    saveOrEdit,
    {
      key: `delete-${node.record.index}`,
      kind: "delete-policy",
      x: deleteX,
      y: actionY,
      width: workflowNodeSizes.action.width,
      height: workflowNodeSizes.action.height,
      direction: node.direction,
      record: node.record
    }
  ];
}
