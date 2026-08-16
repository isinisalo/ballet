import type { LoopGraph } from "./loopGraph";
import { loopOutputSlotKindForValues } from "./loopEdgeOutputSlot";

export type LoopCanvasEdge = {
  key: string;
  sourceNodeKey: string;
  targetNodeKey: string;
  sourceHandleId?: string;
  targetHandleId?: string;
  tone?: "return" | "cross-loop";
  eventType?: string;
  label?: string;
  route?: LoopCanvasEdgeRoute;
};

export type LoopCanvasEdgeRoute = {
  sourceLoopId?: string;
  handlerLoopId?: string;
  targetLoopId?: string;
  sourceNodeIndex?: number;
  handlerNodeIndex?: number;
  sourceNodeId?: string;
  handlerNodeId?: string;
  eventType?: string;
  outputId?: string;
};

export type LoopHandledEventNode = {
  eventType: string;
  outputId?: string;
  label?: string;
  sourceIndex: number;
  sourceNodeId?: string;
  sourceNodeKey: string;
  sourceHandleId?: string;
};

export const loopExistingHandlerEdges = ({
  loopGraph,
  workLoopNodeIndexes,
  handledEventNodes,
  sourceHandleId,
  targetHandleId
}: {
  loopGraph: LoopGraph;
  workLoopNodeIndexes: ReadonlySet<number>;
  handledEventNodes: LoopHandledEventNode[];
  sourceHandleId: string;
  targetHandleId: string;
}): LoopCanvasEdge[] => {
  const edges: LoopCanvasEdge[] = [];

  handledEventNodes.forEach(({ eventType, outputId, label, sourceIndex, sourceNodeId, sourceNodeKey, sourceHandleId: eventSourceHandleId }) => {
    const handlerRecords = loopGraph.eventHandlerRecordsByEvent.get(eventType) ?? [];
    handlerRecords.forEach((handlerRecord) => {
      if (handlerRecord.index === sourceIndex) return;
      if (!workLoopNodeIndexes.has(handlerRecord.index)) return;
      const isReturnEdge = handlerRecord.index < sourceIndex;
      const isNormalOutput = loopOutputSlotKindForValues(outputId, label, eventType) === "normal";

      edges.push({
        key: `event-node-${sourceIndex}-${handlerRecord.index}-${eventType}`,
        sourceNodeKey,
        targetNodeKey: `node-${handlerRecord.index}`,
        sourceHandleId: isReturnEdge && isNormalOutput ? sourceHandleId : eventSourceHandleId ?? sourceHandleId,
        targetHandleId: isReturnEdge ? "top" : targetHandleId,
        tone: isReturnEdge ? "return" : undefined,
        eventType,
        label: label ?? loopEventOutputLabel(eventType),
        route: {
          sourceNodeIndex: sourceIndex,
          handlerNodeIndex: handlerRecord.index,
          sourceNodeId,
          handlerNodeId: handlerRecord.nodeKey,
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
