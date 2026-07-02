import type { WorkflowGraph } from "./workflowGraph";

export type WorkflowCanvasEdge = {
  key: string;
  sourceNodeKey: string;
  targetNodeKey: string;
  sourceHandleId?: string;
  targetHandleId?: string;
  dashed?: boolean;
  label?: WorkflowCanvasEdgeLabel;
};

export type WorkflowHandledEventNode = {
  eventType: string;
  sourceIndex: number;
  sourceNodeKey: string;
  sourcePolicyId?: string;
  labelSlotIndex: number;
};

export type WorkflowCanvasEdgeLabel = {
  kind: "event-ghost" | "handled-event";
  eventType: string;
  interactive: boolean;
  sourcePolicyId?: string;
  x?: number;
  y?: number;
  slotIndex?: number;
};

export const workflowExistingHandlerEdges = ({
  workflowGraph,
  policyNodeIndexes,
  handledEventNodes,
  sourceHandleId,
  targetHandleId
}: {
  workflowGraph: WorkflowGraph;
  policyNodeIndexes: ReadonlySet<number>;
  handledEventNodes: WorkflowHandledEventNode[];
  sourceHandleId: string;
  targetHandleId: string;
}): WorkflowCanvasEdge[] => {
  const edges: WorkflowCanvasEdge[] = [];

  handledEventNodes.forEach(({ eventType, sourceIndex, sourceNodeKey, sourcePolicyId, labelSlotIndex }) => {
    const handlerRecords = workflowGraph.eventHandlerRecordsByEvent.get(eventType) ?? [];
    handlerRecords.forEach((handlerRecord) => {
      if (handlerRecord.index === sourceIndex) return;
      if (!policyNodeIndexes.has(handlerRecord.index)) return;

      edges.push({
        key: `event-policy-${sourceIndex}-${handlerRecord.index}-${eventType}`,
        sourceNodeKey,
        targetNodeKey: `policy-${handlerRecord.index}`,
        sourceHandleId,
        targetHandleId,
        label: {
          kind: "handled-event",
          eventType,
          interactive: false,
          sourcePolicyId,
          slotIndex: labelSlotIndex
        }
      });
    });
  });

  return edges;
};
