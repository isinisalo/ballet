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
  label?: string;
  route?: WorkflowCanvasEdgeRoute;
};

export type WorkflowCanvasEdgeRoute = {
  sourceStepIndex?: number;
  handlerStepIndex?: number;
  sourcePolicyId?: string;
  handlerPolicyId?: string;
  eventType?: string;
  outputId?: string;
};

export type WorkflowHandledEventNode = {
  eventType: string;
  outputId?: string;
  label?: string;
  sourceIndex: number;
  sourcePolicyId?: string;
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

  handledEventNodes.forEach(({ eventType, outputId, label, sourceIndex, sourcePolicyId, sourceNodeKey, sourceHandleId: eventSourceHandleId }) => {
    const handlerRecords = workflowGraph.eventHandlerRecordsByEvent.get(eventType) ?? [];
    handlerRecords.forEach((handlerRecord) => {
      if (handlerRecord.index === sourceIndex) return;
      if (!policyNodeIndexes.has(handlerRecord.index)) return;
      const isReturnEdge = handlerRecord.index < sourceIndex;

      edges.push({
        key: `event-policy-${sourceIndex}-${handlerRecord.index}-${eventType}`,
        sourceNodeKey,
        targetNodeKey: `policy-${handlerRecord.index}`,
        sourceHandleId: isReturnEdge ? sourceHandleId : eventSourceHandleId ?? sourceHandleId,
        targetHandleId: isReturnEdge ? "top" : targetHandleId,
        tone: isReturnEdge ? "return" : undefined,
        eventType,
        label: label ?? workflowEventOutputLabel(eventType),
        route: {
          sourceStepIndex: sourceIndex,
          handlerStepIndex: handlerRecord.index,
          sourcePolicyId,
          handlerPolicyId: handlerRecord.policyId,
          eventType,
          outputId
        }
      });
    });
  });

  return edges;
};

export function workflowEventOutputLabel(eventType: string) {
  const separatorIndex = eventType.lastIndexOf(".");
  return separatorIndex >= 0 ? eventType.slice(separatorIndex + 1) : eventType;
}
