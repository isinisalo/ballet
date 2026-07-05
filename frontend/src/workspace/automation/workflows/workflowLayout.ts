import dagre from "@dagrejs/dagre";
import { workflowOutputEvents, type WorkflowGraph, type WorkflowOutputTarget, type WorkflowStepRecord } from "./workflowGraph";
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
  | "output-event"
  | "gate-output"
  | "first-policy-ghost";

export type WorkflowCanvasOutputEvent = {
  outputId: string;
  eventType: string;
  outputType: "event" | "gate";
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
  gateOutput?: WorkflowCanvasOutputEvent;
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
  trigger: { width: 176, height: 46 },
  policy: { width: 240, height: 58 },
  event: { width: 240, height: 46 },
  outputEvent: { minWidth: 120, maxWidth: 240, height: 22, rowGap: 16 },
  gateOutput: { minWidth: 64, maxWidth: 180, height: 22 },
  action: { width: 28, height: 28 }
};

export const workflowCanvasLayoutConfig = {
  startX: 32,
  startY: 64,
  columnGap: 72,
  branchGap: 28,
  edgePad: 18,
  policyAnchorY: 18,
  outputEventsLaneGap: 24
};

const workflowDirectionHandles: Record<WorkflowLayoutDirection, { rankdir: "LR" | "TB"; sourceHandleId: string; targetHandleId: string }> = {
  horizontal: { rankdir: "LR", sourceHandleId: "right", targetHandleId: "left" },
  vertical: { rankdir: "TB", sourceHandleId: "right", targetHandleId: "left" }
};

type WorkflowCanvasLayoutNodeDraft = Omit<WorkflowCanvasLayoutNode, "x" | "y">;

type WorkflowDagreEdge = {
  source: string;
  target: string;
};

type WorkflowActiveOutputTask =
  | { kind: "gate"; output: WorkflowOutputTarget }
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
      width: workflowNodeSizes.policy.width,
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
      width: workflowOutputEventNodeWidth(output.eventType),
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
      sourceHandleId: workflowOutputSourceHandleId(direction, outputIndex),
      targetHandleId,
      dashed: true
    });
  };

  const addGateOutputNode = (record: WorkflowStepRecord, output: WorkflowOutputTarget, outputIndex: number) => {
    const key = `gate-output-${record.index}-${output.outputId}`;
    addNode({
      key,
      kind: "gate-output",
      width: workflowGateOutputNodeWidth(output.outputId),
      height: workflowNodeSizes.gateOutput.height,
      direction,
      record,
      gateOutput: {
        outputId: output.outputId,
        eventType: output.eventType,
        outputType: output.type
      },
      sourcePolicyId: record.policyId
    });
    addDagreEdge({ source: `policy-${record.index}`, target: key });
    addCanvasEdge({
      key: `policy-gate-output-${record.index}-${output.outputId}`,
      sourceNodeKey: `policy-${record.index}`,
      targetNodeKey: key,
      sourceHandleId: workflowOutputSourceHandleId(direction, outputIndex),
      targetHandleId,
      dashed: !record.policy
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
      if (output.type === "gate") {
        activeOutputTasks.push({ kind: "gate", output });
        return;
      }
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

    activeOutputTasks.forEach((task, outputIndex) => {
      if (task.kind === "gate") {
        addGateOutputNode(record, task.output, outputIndex);
        return;
      }
      if (task.kind === "existing-handler") {
        handledEventNodes.push({
          eventType: task.output.eventType,
          sourceIndex: record.index,
          sourceNodeKey: `policy-${record.index}`,
          sourceHandleId: workflowOutputSourceHandleId(direction, outputIndex)
        });
        return;
      }

      task.childRecords.forEach((childRecord) => {
        layoutPolicyBranch(childRecord, nextVisitedPolicyIds);
        addDagreEdge({ source: `policy-${record.index}`, target: `policy-${childRecord.index}` });
        addCanvasEdge({
          key: `policy-policy-${record.index}-${childRecord.index}-${task.output.eventType}`,
          sourceNodeKey: `policy-${record.index}`,
          targetNodeKey: `policy-${childRecord.index}`,
          sourceHandleId: workflowOutputSourceHandleId(direction, outputIndex),
          targetHandleId,
          eventType: task.output.eventType
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

export function workflowOutputSourceHandleId(_direction: WorkflowLayoutDirection, outputIndex: number) {
  return `right-output-${outputIndex}`;
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
  const metrics = workflowLayoutMetrics(outputNodes);
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
  const sourceKeyByTargetKey = new Map(edges.map((edge) => [edge.target, edge.source]));

  const positionedNodes = nodes.map((node) => {
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

  const positionedNodeByKey = new Map(positionedNodes.map((node) => [node.key, node]));

  return positionedNodes.map((node) => {
    if (node.kind !== "gate-output") return node;
    const sourceNode = positionedNodeByKey.get(sourceKeyByTargetKey.get(node.key) ?? "");
    if (!sourceNode) return node;
    return positionGateOutputNode(node, sourceNode, positionedNodes, direction);
  });
}

function positionGateOutputNode(
  node: WorkflowCanvasLayoutNode,
  sourceNode: WorkflowCanvasLayoutNode,
  positionedNodes: WorkflowCanvasLayoutNode[],
  direction: WorkflowLayoutDirection
): WorkflowCanvasLayoutNode {
  const positionedNode = {
    ...node,
    x: direction === "vertical"
      ? sourceNode.x + sourceNode.width / 2 - node.width / 2
      : node.x,
    y: direction === "horizontal"
      ? sourceNode.y + workflowCanvasLayoutConfig.policyAnchorY - node.height / 2
      : node.y
  };

  if (direction !== "horizontal") return positionedNode;
  return avoidPolicyOverlapForGateOutput(positionedNode, sourceNode, positionedNodes);
}

function avoidPolicyOverlapForGateOutput(
  node: WorkflowCanvasLayoutNode,
  sourceNode: WorkflowCanvasLayoutNode,
  positionedNodes: WorkflowCanvasLayoutNode[]
): WorkflowCanvasLayoutNode {
  const policyNodes = positionedNodes
    .filter((candidate) => candidate.kind === "policy" && candidate.key !== sourceNode.key)
    .sort((firstNode, secondNode) => firstNode.y - secondNode.y || firstNode.x - secondNode.x);
  let positionedNode = node;

  for (let passIndex = 0; passIndex < policyNodes.length; passIndex += 1) {
    const collidingPolicyNode = policyNodes.find((candidate) => workflowNodeRectsOverlap(positionedNode, candidate));
    if (!collidingPolicyNode) return positionedNode;
    positionedNode = {
      ...positionedNode,
      y: collidingPolicyNode.y + collidingPolicyNode.height + workflowNodeSizes.outputEvent.rowGap
    };
  }

  return positionedNode;
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
    .filter((edge) => edge.source === sourceKey && (edge.target.startsWith("policy-") || edge.target.startsWith("gate-output-")))
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
  const sourceStackBottom = sourceNode.y + workflowPolicyStackHeight();
  const hasPolicyChild = childNodes.some((childNode) => childNode.kind === "policy");
  const childStackBottom = childNodes.length === 0
    ? sourceStackBottom
    : Math.max(...childNodes.map((childNode) => childNode.y + workflowBranchStackHeight(childNode)));
  const outputStackTop = childNodes.length === 0
    ? sourceStackBottom + workflowCanvasLayoutConfig.outputEventsLaneGap
    : childStackBottom + workflowNodeSizes.outputEvent.rowGap;
  const stackedY = outputStackTop + outputOrderIndex * outputEventStackStep();

  if (hasPolicyChild || !canAlignTerminalOutputEvents(sourceNode.outputHandleCount ?? 0)) return stackedY;
  return sourceNode.y + workflowPolicyOutputHandleY(node.outputIndex ?? outputOrderIndex, sourceNode.outputHandleCount ?? 0) - node.height / 2;
}

function nextVerticalOutputEventsX(childNodes: WorkflowCanvasLayoutNode[], sourceNode: WorkflowCanvasLayoutNode) {
  if (childNodes.length === 0) return sourceNode.x;
  return Math.max(...childNodes.map((childNode) => childNode.x + childNode.width + workflowCanvasLayoutConfig.branchGap));
}

function workflowLayoutMetrics(outputNodes: WorkflowCanvasLayoutNodeDraft[]): WorkflowLayoutMetrics {
  const outputStackHeights = [...new Map(outputNodes.map((node) => {
    const sourceKey = node.record ? `policy-${node.record.index}` : node.key;
    return [sourceKey, outputNodes.filter((candidate) => candidate.record?.index === node.record?.index).length];
  })).values()].map(outputEventStackHeight);
  const maxOutputHeight = Math.max(workflowNodeSizes.outputEvent.height, ...outputStackHeights);
  const policyStackHeight = workflowPolicyStackHeight();

  return {
    horizontalRootPolicyX: workflowCanvasLayoutConfig.startX + workflowNodeSizes.trigger.width + workflowCanvasLayoutConfig.columnGap,
    horizontalPolicyColumnStep: workflowNodeSizes.policy.width + workflowCanvasLayoutConfig.columnGap,
    horizontalRowStep: Math.max(policyStackHeight, workflowNodeSizes.trigger.height) + workflowCanvasLayoutConfig.branchGap,
    verticalRootPolicyY: workflowCanvasLayoutConfig.startY + workflowNodeSizes.trigger.height + workflowCanvasLayoutConfig.branchGap,
    verticalPolicyRankStep: policyStackHeight + maxOutputHeight + workflowCanvasLayoutConfig.branchGap,
    verticalColumnStep: Math.max(workflowNodeSizes.policy.width, workflowNodeSizes.outputEvent.maxWidth, workflowNodeSizes.gateOutput.maxWidth) + workflowCanvasLayoutConfig.branchGap
  };
}

export function workflowPolicyStackHeight() {
  return workflowNodeSizes.policy.height + workflowNodeSizes.action.height + 12;
}

function workflowGateOutputNodeWidth(outputId: string) {
  return workflowOutputNodeWidth(outputId, workflowNodeSizes.gateOutput.minWidth, workflowNodeSizes.gateOutput.maxWidth);
}

function workflowOutputEventNodeWidth(eventType: string) {
  return workflowOutputNodeWidth(eventType, workflowNodeSizes.outputEvent.minWidth, workflowNodeSizes.outputEvent.maxWidth);
}

function workflowOutputNodeWidth(value: string, minWidth: number, maxWidth: number) {
  const iconAndGapWidth = 20;
  const estimatedCharacterWidth = 7;
  return Math.min(
    maxWidth,
    Math.max(minWidth, iconAndGapWidth + value.length * estimatedCharacterWidth)
  );
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

function workflowNodeRectsOverlap(
  firstNode: Pick<WorkflowCanvasLayoutNode, "x" | "y" | "width" | "height">,
  secondNode: Pick<WorkflowCanvasLayoutNode, "x" | "y" | "width" | "height">
) {
  return firstNode.x < secondNode.x + secondNode.width &&
    firstNode.x + firstNode.width > secondNode.x &&
    firstNode.y < secondNode.y + secondNode.height &&
    firstNode.y + firstNode.height > secondNode.y;
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
      .filter((edge) => edge.source === sourceKey && (edge.target.startsWith("policy-") || edge.target.startsWith("gate-output-")))
      .map((edge) => primaryNodeByKey.get(edge.target))
      .filter((childNode): childNode is WorkflowCanvasLayoutNodeDraft => Boolean(childNode));

    if (childNodes.length === 0) {
      if (canAlignTerminalOutputEvents(sourceNode.outputHandleCount ?? 0)) return;
      laneHeights[sourceLaneIndex] = Math.max(
        laneHeights[sourceLaneIndex],
        workflowBranchStackHeight(sourceNode) + workflowCanvasLayoutConfig.outputEventsLaneGap + outputStackHeightValue
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
