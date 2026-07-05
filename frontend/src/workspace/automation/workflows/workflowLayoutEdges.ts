import type { WorkflowGraph } from "./workflowGraph";

export type WorkflowCanvasEdge = {
  key: string;
  sourceNodeKey: string;
  targetNodeKey: string;
  sourceHandleId?: string;
  targetHandleId?: string;
  dashed?: boolean;
  tone?: "return";
  eventType?: string;
};

export type WorkflowHandledEventNode = {
  eventType: string;
  sourceIndex: number;
  sourceNodeKey: string;
  sourceHandleId?: string;
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

  handledEventNodes.forEach(({ eventType, sourceIndex, sourceNodeKey, sourceHandleId: eventSourceHandleId }) => {
    const handlerRecords = workflowGraph.eventHandlerRecordsByEvent.get(eventType) ?? [];
    handlerRecords.forEach((handlerRecord) => {
      if (handlerRecord.index === sourceIndex) return;
      if (!policyNodeIndexes.has(handlerRecord.index)) return;

      edges.push({
        key: `event-policy-${sourceIndex}-${handlerRecord.index}-${eventType}`,
        sourceNodeKey,
        targetNodeKey: `policy-${handlerRecord.index}`,
        sourceHandleId: eventSourceHandleId ?? sourceHandleId,
        targetHandleId,
        tone: handlerRecord.index < sourceIndex ? "return" : undefined,
        eventType
      });
    });
  });

  return edges;
};
