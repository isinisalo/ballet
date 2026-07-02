import { workflowOutputEvents, type WorkflowGraph, type WorkflowStepRecord } from "./workflowGraph";
import {
  workflowExistingHandlerEdges,
  type WorkflowCanvasEdge,
  type WorkflowEventNodePosition,
  type WorkflowPolicyNodePosition
} from "./workflowLayoutEdges";

export { workflowConnectorPath } from "./workflowLayoutEdges";
export type { WorkflowCanvasEdge, WorkflowCanvasPoint } from "./workflowLayoutEdges";

export type WorkflowBranchLayout = {
  height: number;
  width: number;
};

export type WorkflowCanvasNodeKind =
  | "trigger"
  | "policy"
  | "save-policy"
  | "edit-policy"
  | "delete-policy"
  | "event-ghost"
  | "handled-event-ghost"
  | "first-policy-ghost";

export type WorkflowCanvasLayoutNode = {
  key: string;
  kind: WorkflowCanvasNodeKind;
  x: number;
  y: number;
  width: number;
  height: number;
  record?: WorkflowStepRecord;
  eventType?: string;
  sourcePolicyId?: string;
  isEditingPolicy?: boolean;
};

export type WorkflowCanvasLayout = {
  nodes: WorkflowCanvasLayoutNode[];
  edges: WorkflowCanvasEdge[];
  width: number;
  height: number;
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

export function calculateWorkflowCanvasLayout({
  workflowGraph,
  editingPolicyIndex
}: {
  workflowGraph: WorkflowGraph;
  editingPolicyIndex: number | null;
}): WorkflowCanvasLayout {
  const nodes: WorkflowCanvasLayoutNode[] = [];
  const edges: WorkflowCanvasEdge[] = [];
  const edgeKeys = new Set<string>();
  const policyNodePositions = new Map<number, WorkflowPolicyNodePosition>();
  const handledEventNodePositions: WorkflowEventNodePosition[] = [];
  let width = workflowCanvasLayoutConfig.startX + workflowNodeSizes.trigger.width;
  let height = workflowCanvasLayoutConfig.startY + workflowNodeSizes.trigger.height;

  const addNode = (node: WorkflowCanvasLayoutNode) => {
    width = Math.max(width, node.x + node.width + workflowCanvasLayoutConfig.startX);
    height = Math.max(height, node.y + node.height + workflowCanvasLayoutConfig.startY);
    nodes.push(node);
  };

  const addEdge = (edge: WorkflowCanvasEdge) => {
    if (edgeKeys.has(edge.key)) return;
    edgeKeys.add(edge.key);
    const edgePoints = [edge.from, edge.to, ...(edge.waypoints ?? [])];
    width = Math.max(width, ...edgePoints.map((point) => point.x + workflowCanvasLayoutConfig.startX));
    height = Math.max(height, ...edgePoints.map((point) => point.y + workflowCanvasLayoutConfig.startY));
    edges.push(edge);
  };

  const layoutPolicyBranch = (record: WorkflowStepRecord, x: number, y: number, visitedPolicyIds = new Set<string>()): WorkflowBranchLayout => {
    const policy = record.policy;
    if (visitedPolicyIds.has(record.policyId)) return { height: 0, width: 0 };
    const nextVisitedPolicyIds = new Set(visitedPolicyIds);
    nextVisitedPolicyIds.add(record.policyId);

    const policyX = x;
    const policyY = y;
    const outputX = policyX + workflowNodeSizes.policy.width + workflowCanvasLayoutConfig.columnGap;
    const deleteX = policyX + workflowNodeSizes.policy.width - workflowNodeSizes.action.width;
    const editX = deleteX - workflowNodeSizes.action.width - 6;
    const actionY = policyY + workflowNodeSizes.policy.height + 6;
    const isEditingPolicy = editingPolicyIndex === record.index;
    let cursorY = y + workflowCanvasLayoutConfig.policyAnchorY - workflowNodeSizes.event.height / 2;
    let branchWidth = workflowNodeSizes.policy.width;

    addNode({
      key: `policy-${record.index}`,
      kind: "policy",
      x: policyX,
      y: policyY,
      width: workflowNodeSizes.policy.width,
      height: workflowNodeSizes.policy.height,
      record,
      isEditingPolicy
    });
    policyNodePositions.set(record.index, { record, position: { x: policyX, y: policyY } });

    addNode({
      key: isEditingPolicy ? `save-${record.index}` : `edit-${record.index}`,
      kind: isEditingPolicy ? "save-policy" : "edit-policy",
      x: isEditingPolicy ? deleteX : editX,
      y: actionY,
      width: workflowNodeSizes.action.width,
      height: workflowNodeSizes.action.height,
      record
    });

    if (!isEditingPolicy) {
      addNode({
        key: `delete-${record.index}`,
        kind: "delete-policy",
        x: deleteX,
        y: actionY,
        width: workflowNodeSizes.action.width,
        height: workflowNodeSizes.action.height,
        record
      });
    }

    workflowOutputEvents(record).forEach((eventType) => {
      const childRecords = (workflowGraph.childRecordsByParentEvent.get(`${record.index}:${eventType}`) ?? [])
        .filter((childRecord) => childRecord.policyId !== record.policyId && !nextVisitedPolicyIds.has(childRecord.policyId));
      const existingHandlerRecords = workflowGraph.eventHandlerRecordsByEvent.get(eventType) ?? [];
      const eventRows = childRecords.length > 0
        ? childRecords
        : [undefined];

      eventRows.forEach((childRecord, childIndex) => {
        const eventY = cursorY;
        const handledByExistingPolicy = !childRecord && existingHandlerRecords.length > 0;

        if (childRecord) {
          const childX = outputX;
          const childY = eventY + workflowNodeSizes.event.height / 2 - workflowCanvasLayoutConfig.policyAnchorY;
          const childLayout = layoutPolicyBranch(childRecord, childX, childY, nextVisitedPolicyIds);
          addEdge({
            key: `policy-policy-${record.index}-${childRecord.index}-${eventType}`,
            sourceNodeKey: `policy-${record.index}`,
            targetNodeKey: `policy-${childRecord.index}`,
            sourceHandleId: "right",
            targetHandleId: "left",
            from: { x: policyX + workflowNodeSizes.policy.width, y: policyY + workflowCanvasLayoutConfig.policyAnchorY },
            to: { x: childX, y: childY + workflowCanvasLayoutConfig.policyAnchorY }
          });
          branchWidth = Math.max(branchWidth, outputX + childLayout.width - x);
          cursorY += Math.max(workflowCanvasLayoutConfig.rowStep, childY + childLayout.height - eventY) + workflowCanvasLayoutConfig.branchGap;
        } else {
          const eventNodeKey = handledByExistingPolicy
            ? `event-${record.index}-${eventType}-handled`
            : `event-${record.index}-${eventType}-ghost-${childIndex}`;
          addEdge({
            key: handledByExistingPolicy
              ? `policy-handled-event-${record.index}-${eventType}`
              : `policy-event-${record.index}-${eventType}-${childIndex}`,
            sourceNodeKey: `policy-${record.index}`,
            targetNodeKey: eventNodeKey,
            sourceHandleId: "right",
            targetHandleId: "left",
            from: { x: policyX + workflowNodeSizes.policy.width, y: policyY + workflowCanvasLayoutConfig.policyAnchorY },
            to: { x: outputX, y: eventY + workflowNodeSizes.event.height / 2 },
            dashed: !policy
          });
          addNode({
            key: eventNodeKey,
            kind: handledByExistingPolicy ? "handled-event-ghost" : "event-ghost",
            x: outputX,
            y: eventY,
            width: workflowNodeSizes.event.width,
            height: workflowNodeSizes.event.height,
            record,
            eventType,
            sourcePolicyId: record.policyId
          });
          if (handledByExistingPolicy) {
            handledEventNodePositions.push({
              nodeKey: eventNodeKey,
              eventType,
              sourceIndex: record.index,
              position: { x: outputX, y: eventY }
            });
          }
          branchWidth = Math.max(branchWidth, outputX + workflowNodeSizes.event.width - x);
          cursorY += workflowCanvasLayoutConfig.rowStep;
        }
      });
    });

    return {
      height: Math.max(workflowNodeSizes.policy.height, cursorY - y, actionY + workflowNodeSizes.action.height - y),
      width: branchWidth
    };
  };

  addNode({
    key: "trigger",
    kind: "trigger",
    x: workflowCanvasLayoutConfig.startX,
    y: workflowCanvasLayoutConfig.startY,
    width: workflowNodeSizes.trigger.width,
    height: workflowNodeSizes.trigger.height
  });

  const rootX = workflowCanvasLayoutConfig.startX + workflowNodeSizes.trigger.width + workflowCanvasLayoutConfig.columnGap;
  let rootY = workflowCanvasLayoutConfig.startY + workflowNodeSizes.trigger.height / 2 - workflowCanvasLayoutConfig.policyAnchorY;

  if (workflowGraph.rootRecords.length > 0) {
    workflowGraph.rootRecords.forEach((record) => {
      const rootLayout = layoutPolicyBranch(record, rootX, rootY);
      addEdge({
        key: `trigger-policy-${record.index}`,
        sourceNodeKey: "trigger",
        targetNodeKey: `policy-${record.index}`,
        sourceHandleId: "right",
        targetHandleId: "left",
        from: { x: workflowCanvasLayoutConfig.startX + workflowNodeSizes.trigger.width, y: workflowCanvasLayoutConfig.startY + workflowNodeSizes.trigger.height / 2 },
        to: { x: rootX, y: rootY + workflowCanvasLayoutConfig.policyAnchorY },
        dashed: !record.policy
      });
      rootY += Math.max(workflowCanvasLayoutConfig.rowStep, rootLayout.height) + workflowCanvasLayoutConfig.branchGap;
    });
  } else {
    const firstGhostY = workflowCanvasLayoutConfig.startY + workflowNodeSizes.trigger.height / 2 - workflowNodeSizes.event.height / 2;
    addEdge({
      key: "trigger-first-policy",
      sourceNodeKey: "trigger",
      targetNodeKey: "first-policy-ghost",
      sourceHandleId: "right",
      targetHandleId: "left",
      from: { x: workflowCanvasLayoutConfig.startX + workflowNodeSizes.trigger.width, y: workflowCanvasLayoutConfig.startY + workflowNodeSizes.trigger.height / 2 },
      to: { x: rootX, y: firstGhostY + workflowNodeSizes.event.height / 2 },
      dashed: true
    });
    addNode({
      key: "first-policy-ghost",
      kind: "first-policy-ghost",
      x: rootX,
      y: firstGhostY,
      width: workflowNodeSizes.event.width,
      height: workflowNodeSizes.event.height
    });
  }

  workflowExistingHandlerEdges({
    workflowGraph,
    policyNodePositions,
    eventNodePositions: handledEventNodePositions,
    policyWidth: workflowNodeSizes.policy.width,
    policyHeight: workflowNodeSizes.policy.height,
    eventWidth: workflowNodeSizes.event.width,
    eventHeight: workflowNodeSizes.event.height,
    policyAnchorY: workflowCanvasLayoutConfig.policyAnchorY,
    branchGap: workflowCanvasLayoutConfig.branchGap,
    edgePad: workflowCanvasLayoutConfig.edgePad
  }).forEach(addEdge);

  return { nodes, edges, width, height };
}
