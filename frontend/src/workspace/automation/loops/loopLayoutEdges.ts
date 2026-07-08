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
  sourceActionId?: string;
  handlerActionId?: string;
  eventType?: string;
  outputId?: string;
};

export type LoopHandledEventNode = {
  eventType: string;
  outputId?: string;
  label?: string;
  sourceIndex: number;
  sourceActionId?: string;
  sourceNodeKey: string;
  sourceHandleId?: string;
};

export const loopExistingHandlerEdges = ({
  loopGraph,
  actionNodeIndexes,
  handledEventNodes,
  sourceHandleId,
  targetHandleId
}: {
  loopGraph: LoopGraph;
  actionNodeIndexes: ReadonlySet<number>;
  handledEventNodes: LoopHandledEventNode[];
  sourceHandleId: string;
  targetHandleId: string;
}): LoopCanvasEdge[] => {
  const edges: LoopCanvasEdge[] = [];

  handledEventNodes.forEach(({ eventType, outputId, label, sourceIndex, sourceActionId, sourceNodeKey, sourceHandleId: eventSourceHandleId }) => {
    const handlerRecords = loopGraph.eventHandlerRecordsByEvent.get(eventType) ?? [];
    handlerRecords.forEach((handlerRecord) => {
      if (handlerRecord.index === sourceIndex) return;
      if (!actionNodeIndexes.has(handlerRecord.index)) return;
      const isReturnEdge = handlerRecord.index < sourceIndex;
      const isReworkOutput = loopOutputSlotKindForValues(outputId, label, eventType) === "rework";

      edges.push({
        key: `event-action-${sourceIndex}-${handlerRecord.index}-${eventType}`,
        sourceNodeKey,
        targetNodeKey: `action-${handlerRecord.index}`,
        sourceHandleId: isReturnEdge && !isReworkOutput ? sourceHandleId : eventSourceHandleId ?? sourceHandleId,
        targetHandleId: isReworkOutput ? "top" : isReturnEdge ? "top" : targetHandleId,
        tone: isReturnEdge ? "return" : undefined,
        eventType,
        label: label ?? loopEventOutputLabel(eventType),
        route: {
          sourceStepIndex: sourceIndex,
          handlerStepIndex: handlerRecord.index,
          sourceActionId,
          handlerActionId: handlerRecord.actionId,
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
