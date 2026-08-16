import {
  loopCanonicalRecord,
  loopFoldedOutputTargets,
  loopFoldedRecords,
  type LoopGraph,
  type LoopOutputTarget,
  type LoopNodeRecord
} from "./loopGraph";
import { loopExistingHandlerEdges } from "./loopLayoutEdges";
import { loopDirectionHandles } from "./loopLayoutConfig";
import {
  addCanvasEdge,
  addDagreEdge,
  addFirstNodeGhost,
  addWorkLoopNodeLayout,
  loopOutputEdgeLabel,
  type LoopLayoutGraphDraft,
  type LoopLayoutGraphDraftContext
} from "./loopLayoutGraphDraft";
import {
  loopOutputSourceHandleId,
  loopOutputTargetHandleId
} from "./loopLayoutSizing";
import type { LoopActiveOutputTask, LoopLayoutDirection } from "./loopLayoutTypes";

export function buildLoopLayoutGraphDraft({
  loopGraph,
  editingNodeIndex,
  direction
}: {
  loopGraph: LoopGraph;
  editingNodeIndex: number | null;
  direction: LoopLayoutDirection;
}): LoopLayoutGraphDraft {
  const { sourceHandleId, targetHandleId } = loopDirectionHandles[direction];
  const context: LoopLayoutGraphDraftContext = {
    loopGraph,
    editingNodeIndex,
    direction,
    sourceHandleId,
    targetHandleId,
    nodeDrafts: new Map(),
    dagreEdges: [],
    canvasEdges: [],
    edgeKeys: new Set(),
    workLoopNodeIndexes: new Set(),
    handledEventNodes: []
  };

  if (loopGraph.rootRecords.length > 0) {
    loopGraph.rootRecords.forEach((record) => addRootNodeBranch(context, record));
  } else {
    addFirstNodeGhost(context);
  }
  loopExistingHandlerEdges({
    loopGraph,
    workLoopNodeIndexes: context.workLoopNodeIndexes,
    handledEventNodes: context.handledEventNodes,
    sourceHandleId,
    targetHandleId
  }).forEach((edge) => addCanvasEdge(context, edge));

  return {
    nodes: [...context.nodeDrafts.values()],
    dagreEdges: context.dagreEdges,
    canvasEdges: context.canvasEdges
  };
}

function addRootNodeBranch(context: LoopLayoutGraphDraftContext, record: LoopNodeRecord) {
  const canonicalRecord = loopCanonicalRecord(context.loopGraph, record);
  layoutNodeBranch(context, canonicalRecord);
}

function layoutNodeBranch(context: LoopLayoutGraphDraftContext, record: LoopNodeRecord, visitedNodeIds = new Set<string>()) {
  const canonicalRecord = loopCanonicalRecord(context.loopGraph, record);
  if (canonicalRecord.index !== record.index) return;
  if (visitedNodeIds.has(record.nodeKey)) return;
  const nextVisitedNodeIds = new Set(visitedNodeIds);
  const activeOutputTasks: LoopActiveOutputTask[] = [];
  nextVisitedNodeIds.add(record.nodeKey);

  collectOutputTasks(context, record, nextVisitedNodeIds, activeOutputTasks);
  addWorkLoopNodeLayout(context, record, activeOutputTasks.length);

  activeOutputTasks.forEach((task) => {
    if (task.kind === "existing-handler") {
      addHandledEventNode(context, record, task.output);
      return;
    }
    task.childRecords.forEach((childRecord) => addChildNodeEdge(context, record, task.output, childRecord, nextVisitedNodeIds));
  });
}

function collectOutputTasks(
  context: LoopLayoutGraphDraftContext,
  record: LoopNodeRecord,
  nextVisitedNodeIds: ReadonlySet<string>,
  activeOutputTasks: LoopActiveOutputTask[]
) {
  const recordOutputTargets = loopFoldedOutputTargets(context.loopGraph, record);
  const foldedRecords = loopFoldedRecords(context.loopGraph, record);

  recordOutputTargets.forEach((output) => {
    if (output.type === "node" && output.targetLoopId !== record.loopId) return;
    const { eventType } = output;
    const childRecords = foldedRecords.flatMap((sourceRecord) =>
      context.loopGraph.childRecordsByParentEvent.get(`${sourceRecord.index}:${eventType}`) ?? []
    )
      .filter((childRecord) => childRecord.nodeKey !== record.nodeKey && !nextVisitedNodeIds.has(childRecord.nodeKey));
    const existingHandlerRecords = (context.loopGraph.eventHandlerRecordsByEvent.get(eventType) ?? [])
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
  });
}

function addHandledEventNode(context: LoopLayoutGraphDraftContext, record: LoopNodeRecord, output: LoopOutputTarget) {
  context.handledEventNodes.push({
    eventType: output.eventType,
    outputId: output.outputId,
    label: loopOutputEdgeLabel(output),
    sourceIndex: record.index,
    sourceNodeId: record.nodeKey,
    sourceNodeKey: `node-${record.index}`,
    sourceHandleId: loopOutputSourceHandleId(output)
  });
}

function addChildNodeEdge(
  context: LoopLayoutGraphDraftContext,
  record: LoopNodeRecord,
  output: LoopOutputTarget,
  childRecord: LoopNodeRecord,
  nextVisitedNodeIds: Set<string>
) {
  const canonicalChildRecord = loopCanonicalRecord(context.loopGraph, childRecord);
  const isFoldedChild = canonicalChildRecord.index !== childRecord.index;
  if (isFoldedChild) {
    const isReturnEdge = canonicalChildRecord.index <= record.index;
    layoutNodeBranch(context, canonicalChildRecord, nextVisitedNodeIds);
    addCanvasEdge(context, {
      key: `node-node-${record.index}-${canonicalChildRecord.index}-${childRecord.index}-${output.eventType}`,
      sourceNodeKey: `node-${record.index}`,
      targetNodeKey: `node-${canonicalChildRecord.index}`,
      sourceHandleId: loopOutputSourceHandleId(output),
      targetHandleId: isReturnEdge ? loopOutputTargetHandleId(output, "top") : loopOutputTargetHandleId(output, context.targetHandleId),
      tone: isReturnEdge ? "return" : undefined,
      eventType: output.eventType,
      label: loopOutputEdgeLabel(output),
      route: {
        sourceNodeIndex: record.index,
        handlerNodeIndex: childRecord.index,
        sourceNodeId: record.nodeKey,
        handlerNodeId: childRecord.nodeKey,
        eventType: output.eventType,
        outputId: output.outputId
      }
    });
    return;
  }

  layoutNodeBranch(context, childRecord, nextVisitedNodeIds);
  addDagreEdge(context, {
    source: `node-${record.index}`,
    target: `node-${childRecord.index}`,
    label: loopOutputEdgeLabel(output)
  });
  addCanvasEdge(context, {
    key: `node-node-${record.index}-${childRecord.index}-${output.eventType}`,
    sourceNodeKey: `node-${record.index}`,
    targetNodeKey: `node-${childRecord.index}`,
    sourceHandleId: loopOutputSourceHandleId(output),
    targetHandleId: loopOutputTargetHandleId(output, context.targetHandleId),
    eventType: output.eventType,
    label: loopOutputEdgeLabel(output),
    route: {
      sourceNodeIndex: record.index,
      handlerNodeIndex: childRecord.index,
      sourceNodeId: record.nodeKey,
      handlerNodeId: childRecord.nodeKey,
      eventType: output.eventType,
      outputId: output.outputId
    }
  });
}
