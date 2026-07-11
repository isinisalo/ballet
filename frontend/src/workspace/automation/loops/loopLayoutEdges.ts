import type { LoopGraph } from "./loopGraph";
import { loopOutputSlotKindForValues } from "./loopEdgeOutputSlot";

export type LoopCanvasEdge = {
  key: string;
  sourceNodeKey: string;
  targetNodeKey: string;
  sourceHandleId?: string;
  targetHandleId?: string;
  dashed?: boolean;
  tone?: "return" | "cross-loop";
  eventType?: string;
  label?: string;
  route?: LoopCanvasEdgeRoute;
};

export type LoopCanvasEdgeRoute = {
  sourceLoopId?: string;
  handlerLoopId?: string;
  targetLoopId?: string;
  sourceStepIndex?: number;
  handlerStepIndex?: number;
  sourceStepId?: string;
  handlerStepId?: string;
  eventType?: string;
  outputId?: string;
};

export type LoopHandledEventNode = {
  eventType: string;
  outputId?: string;
  label?: string;
  sourceIndex: number;
  sourceStepId?: string;
  sourceNodeKey: string;
  sourceHandleId?: string;
};

export const loopExistingHandlerEdges = ({
  loopGraph,
  stepNodeIndexes,
  handledEventNodes,
  sourceHandleId,
  targetHandleId
}: {
  loopGraph: LoopGraph;
  stepNodeIndexes: ReadonlySet<number>;
  handledEventNodes: LoopHandledEventNode[];
  sourceHandleId: string;
  targetHandleId: string;
}): LoopCanvasEdge[] => {
  const edges: LoopCanvasEdge[] = [];

  handledEventNodes.forEach(({ eventType, outputId, label, sourceIndex, sourceStepId, sourceNodeKey, sourceHandleId: eventSourceHandleId }) => {
    const handlerRecords = loopGraph.eventHandlerRecordsByEvent.get(eventType) ?? [];
    handlerRecords.forEach((handlerRecord) => {
      if (handlerRecord.index === sourceIndex) return;
      if (!stepNodeIndexes.has(handlerRecord.index)) return;
      const isReturnEdge = handlerRecord.index < sourceIndex;
      const isReworkOutput = loopOutputSlotKindForValues(outputId, label, eventType) === "rework";

      edges.push({
        key: `event-step-${sourceIndex}-${handlerRecord.index}-${eventType}`,
        sourceNodeKey,
        targetNodeKey: `step-${handlerRecord.index}`,
        sourceHandleId: isReturnEdge && !isReworkOutput ? sourceHandleId : eventSourceHandleId ?? sourceHandleId,
        targetHandleId: isReworkOutput ? "top" : isReturnEdge ? "top" : targetHandleId,
        tone: isReturnEdge ? "return" : undefined,
        eventType,
        label: label ?? loopEventOutputLabel(eventType),
        route: {
          sourceStepIndex: sourceIndex,
          handlerStepIndex: handlerRecord.index,
          sourceStepId,
          handlerStepId: handlerRecord.stepKey,
          eventType,
          outputId
        }
      });
    });
  });

  return edges;
};

export function loopEventOutputLabel(eventType: string) {
  const separatorIndex = eventType.lastIndexOf(".");
  return separatorIndex >= 0 ? eventType.slice(separatorIndex + 1) : eventType;
}
