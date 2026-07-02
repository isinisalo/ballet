import type { WorkflowGraph, WorkflowStepRecord } from "./workflowGraph";

export type WorkflowCanvasPoint = {
  x: number;
  y: number;
};

export type WorkflowCanvasEdge = {
  key: string;
  sourceNodeKey: string;
  targetNodeKey: string;
  sourceHandleId?: string;
  targetHandleId?: string;
  from: WorkflowCanvasPoint;
  to: WorkflowCanvasPoint;
  waypoints?: WorkflowCanvasPoint[];
  dashed?: boolean;
};

export type WorkflowPolicyNodePosition = {
  record: WorkflowStepRecord;
  position: WorkflowCanvasPoint;
};

export type WorkflowEventNodePosition = {
  nodeKey: string;
  eventType: string;
  sourceIndex: number;
  position: WorkflowCanvasPoint;
};

export const workflowConnectorPath = (edge: WorkflowCanvasEdge) => {
  if (edge.waypoints?.length) {
    return [edge.from, ...edge.waypoints, edge.to]
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
      .join(" ");
  }

  const midX = edge.from.x + Math.max(18, Math.min(48, (edge.to.x - edge.from.x) / 2));
  return Math.abs(edge.from.y - edge.to.y) <= 2
    ? `M ${edge.from.x} ${edge.from.y} H ${edge.to.x}`
    : `M ${edge.from.x} ${edge.from.y} H ${midX} V ${edge.to.y} H ${edge.to.x}`;
};

const policyAnchor = ({
  position,
  policyWidth,
  policyAnchorY,
  side
}: {
  position: WorkflowCanvasPoint;
  policyWidth: number;
  policyAnchorY: number;
  side: "left" | "right";
}): WorkflowCanvasPoint => ({
  x: position.x + (side === "right" ? policyWidth : 0),
  y: position.y + policyAnchorY
});

export const workflowExistingHandlerEdges = ({
  workflowGraph,
  policyNodePositions,
  eventNodePositions,
  policyWidth,
  policyHeight,
  eventWidth,
  eventHeight,
  policyAnchorY,
  branchGap,
  edgePad
}: {
  workflowGraph: WorkflowGraph;
  policyNodePositions: Map<number, WorkflowPolicyNodePosition>;
  eventNodePositions: WorkflowEventNodePosition[];
  policyWidth: number;
  policyHeight: number;
  eventWidth: number;
  eventHeight: number;
  policyAnchorY: number;
  branchGap: number;
  edgePad: number;
}): WorkflowCanvasEdge[] => {
  const edges: WorkflowCanvasEdge[] = [];
  let routedEdgeIndex = 0;

  eventNodePositions.forEach(({ nodeKey, eventType, sourceIndex, position: eventPosition }) => {
    const handlerRecords = workflowGraph.eventHandlerRecordsByEvent.get(eventType) ?? [];
    handlerRecords.forEach((handlerRecord) => {
      const targetPosition = policyNodePositions.get(handlerRecord.index)?.position;
      if (!targetPosition) return;

      const from = {
        x: eventPosition.x + eventWidth,
        y: eventPosition.y + eventHeight / 2
      };
      const to = policyAnchor({ position: targetPosition, policyWidth, policyAnchorY, side: "left" });
      const laneY = Math.max(
        eventPosition.y + eventHeight,
        targetPosition.y + policyHeight
      ) + branchGap + edgePad + (routedEdgeIndex % 6) * 10;
      const sourceLaneX = from.x + edgePad;
      const targetLaneX = to.x - edgePad;
      routedEdgeIndex += 1;

      edges.push({
        key: `event-policy-${sourceIndex}-${handlerRecord.index}-${eventType}`,
        sourceNodeKey: nodeKey,
        targetNodeKey: `policy-${handlerRecord.index}`,
        sourceHandleId: "right",
        targetHandleId: "left",
        from,
        to,
        waypoints: [
          { x: sourceLaneX, y: from.y },
          { x: sourceLaneX, y: laneY },
          { x: targetLaneX, y: laneY },
          { x: targetLaneX, y: to.y }
        ]
      });
    });
  });

  return edges;
};
