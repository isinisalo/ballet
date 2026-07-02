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
  | "event-anchor"
  | "first-policy-ghost";

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
  action: { width: 28, height: 28 }
};

export const workflowCanvasLayoutConfig = {
  startX: 32,
  startY: 64,
  columnGap: 36,
  branchGap: 20,
  rowStep: 54,
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

  const addEventAnchorNode = (record: WorkflowStepRecord, eventType: string, childIndex: number) => {
    const key = `event-${record.index}-${eventType}-anchor-${childIndex}`;
    addNode({
      key,
      kind: "event-anchor",
      width: workflowNodeSizes.event.width,
      height: workflowNodeSizes.event.height,
      direction,
      record,
      eventType,
      sourcePolicyId: record.policyId
    });
    return key;
  };

  const layoutPolicyBranch = (record: WorkflowStepRecord, visitedPolicyIds = new Set<string>()) => {
    if (visitedPolicyIds.has(record.policyId)) return;
    const nextVisitedPolicyIds = new Set(visitedPolicyIds);
    nextVisitedPolicyIds.add(record.policyId);
    addPolicyNode(record);

    workflowOutputEvents(record).forEach((eventType, labelSlotIndex) => {
      const childRecords = (workflowGraph.childRecordsByParentEvent.get(`${record.index}:${eventType}`) ?? [])
        .filter((childRecord) => childRecord.policyId !== record.policyId && !nextVisitedPolicyIds.has(childRecord.policyId));
      const existingHandlerRecords = workflowGraph.eventHandlerRecordsByEvent.get(eventType) ?? [];

      if (childRecords.length > 0) {
        childRecords.forEach((childRecord) => {
          layoutPolicyBranch(childRecord, nextVisitedPolicyIds);
          addDagreEdge({ source: `policy-${record.index}`, target: `policy-${childRecord.index}` });
          addCanvasEdge({
            key: `policy-policy-${record.index}-${childRecord.index}-${eventType}`,
            sourceNodeKey: `policy-${record.index}`,
            targetNodeKey: `policy-${childRecord.index}`,
            sourceHandleId,
            targetHandleId
          });
        });
        return;
      }

      if (existingHandlerRecords.length > 0) {
        handledEventNodes.push({
          eventType,
          sourceIndex: record.index,
          sourceNodeKey: `policy-${record.index}`,
          sourcePolicyId: record.policyId,
          labelSlotIndex
        });
        return;
      }

      const eventNodeKey = addEventAnchorNode(record, eventType, 0);
      addDagreEdge({ source: `policy-${record.index}`, target: eventNodeKey });
      addCanvasEdge({
        key: `policy-event-${record.index}-${eventType}-0`,
        sourceNodeKey: `policy-${record.index}`,
        targetNodeKey: eventNodeKey,
        sourceHandleId,
        targetHandleId,
        dashed: !record.policy,
        label: {
          kind: "event-ghost",
          eventType,
          interactive: true,
          sourcePolicyId: record.policyId
        }
      });
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
  const coreNodeByKey = new Map(positionedNodes.map((node) => [node.key, node]));
  const actionNodes = positionedNodes.flatMap((node) => actionNodesForPolicy(node, editingPolicyIndex));
  const positionedEdges = canvasEdges.map((edge) => positionWorkflowEdgeLabel(edge, coreNodeByKey, direction));

  return {
    nodes: [...positionedNodes, ...actionNodes],
    edges: positionedEdges,
    direction
  };
}

function positionWorkflowNodes(nodes: WorkflowCanvasLayoutNodeDraft[], edges: WorkflowDagreEdge[], direction: WorkflowLayoutDirection): WorkflowCanvasLayoutNode[] {
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

  const positioned = nodes.map((node) => {
    const dagreNode = graph.node(node.key) as { x: number; y: number };
    return {
      ...node,
      x: dagreNode.x - node.width / 2,
      y: dagreNode.y - node.height / 2
    };
  });

  const minX = Math.min(...positioned.map((node) => node.x));
  const minY = Math.min(...positioned.map((node) => node.y));

  return positioned.map((node) => ({
    ...node,
    x: node.x - minX + workflowCanvasLayoutConfig.startX,
    y: node.y - minY + workflowCanvasLayoutConfig.startY
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

function positionWorkflowEdgeLabel(edge: WorkflowCanvasEdge, nodeByKey: ReadonlyMap<string, WorkflowCanvasLayoutNode>, direction: WorkflowLayoutDirection): WorkflowCanvasEdge {
  if (!edge.label) return edge;

  const anchorNode = edge.label.kind === "event-ghost" ? nodeByKey.get(edge.targetNodeKey) : undefined;
  if (anchorNode) {
    return {
      ...edge,
      label: {
        ...edge.label,
        x: anchorNode.x + anchorNode.width / 2,
        y: anchorNode.y + anchorNode.height / 2
      }
    };
  }

  const sourceNode = nodeByKey.get(edge.sourceNodeKey);
  if (!sourceNode) return edge;
  const slotIndex = edge.label.slotIndex ?? 0;

  return {
    ...edge,
    label: {
      ...edge.label,
      x: direction === "horizontal"
        ? sourceNode.x + sourceNode.width + workflowCanvasLayoutConfig.columnGap + workflowNodeSizes.event.width / 2
        : sourceNode.x + sourceNode.width / 2 + slotIndex * (workflowNodeSizes.event.width + workflowCanvasLayoutConfig.branchGap),
      y: direction === "horizontal"
        ? sourceNode.y + workflowCanvasLayoutConfig.policyAnchorY + slotIndex * workflowCanvasLayoutConfig.rowStep
        : sourceNode.y + sourceNode.height + workflowCanvasLayoutConfig.branchGap + workflowNodeSizes.event.height / 2
    }
  };
}
