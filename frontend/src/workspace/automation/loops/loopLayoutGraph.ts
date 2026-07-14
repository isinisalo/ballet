import {
  loopCanonicalRecord,
  loopFoldedOutputTargets,
  loopFoldedRecords,
  type LoopGraph,
  type LoopOutputTarget,
  type LoopStepRecord
} from "./loopGraph";
import { loopExistingHandlerEdges } from "./loopLayoutEdges";
import { loopDirectionHandles } from "./loopLayoutConfig";
import {
  addCanvasEdge,
  addDagreEdge,
  addFirstStepGhost,
  addStepNode,
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
  editingStepIndex,
  direction
}: {
  loopGraph: LoopGraph;
  editingStepIndex: number | null;
  direction: LoopLayoutDirection;
}): LoopLayoutGraphDraft {
  const { sourceHandleId, targetHandleId } = loopDirectionHandles[direction];
  const context: LoopLayoutGraphDraftContext = {
    loopGraph,
    editingStepIndex,
    direction,
    sourceHandleId,
    targetHandleId,
    nodeDrafts: new Map(),
    dagreEdges: [],
    canvasEdges: [],
    edgeKeys: new Set(),
    stepNodeIndexes: new Set(),
    handledEventNodes: []
  };

  if (loopGraph.rootRecords.length > 0) {
    loopGraph.rootRecords.forEach((record) => addRootStepBranch(context, record));
  } else {
    addFirstStepGhost(context);
  }
  loopExistingHandlerEdges({
    loopGraph,
    stepNodeIndexes: context.stepNodeIndexes,
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

function addRootStepBranch(context: LoopLayoutGraphDraftContext, record: LoopStepRecord) {
  const canonicalRecord = loopCanonicalRecord(context.loopGraph, record);
  layoutStepBranch(context, canonicalRecord);
}

function layoutStepBranch(context: LoopLayoutGraphDraftContext, record: LoopStepRecord, visitedStepIds = new Set<string>()) {
  const canonicalRecord = loopCanonicalRecord(context.loopGraph, record);
  if (canonicalRecord.index !== record.index) return;
  if (visitedStepIds.has(record.stepKey)) return;
  const nextVisitedStepIds = new Set(visitedStepIds);
  const activeOutputTasks: LoopActiveOutputTask[] = [];
  nextVisitedStepIds.add(record.stepKey);

  collectOutputTasks(context, record, nextVisitedStepIds, activeOutputTasks);
  addStepNode(context, record, activeOutputTasks.length);

  activeOutputTasks.forEach((task) => {
    if (task.kind === "existing-handler") {
      addHandledEventNode(context, record, task.output);
      return;
    }
    task.childRecords.forEach((childRecord) => addChildStepEdge(context, record, task.output, childRecord, nextVisitedStepIds));
  });
}

function collectOutputTasks(
  context: LoopLayoutGraphDraftContext,
  record: LoopStepRecord,
  nextVisitedStepIds: ReadonlySet<string>,
  activeOutputTasks: LoopActiveOutputTask[]
) {
  const recordOutputTargets = loopFoldedOutputTargets(context.loopGraph, record);
  const foldedRecords = loopFoldedRecords(context.loopGraph, record);

  recordOutputTargets.forEach((output) => {
    if (output.type === "step" && output.targetLoopId !== record.loopId) return;
    const { eventType } = output;
    const childRecords = foldedRecords.flatMap((sourceRecord) =>
      context.loopGraph.childRecordsByParentEvent.get(`${sourceRecord.index}:${eventType}`) ?? []
    )
      .filter((childRecord) => childRecord.stepKey !== record.stepKey && !nextVisitedStepIds.has(childRecord.stepKey));
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

function addHandledEventNode(context: LoopLayoutGraphDraftContext, record: LoopStepRecord, output: LoopOutputTarget) {
  context.handledEventNodes.push({
    eventType: output.eventType,
    outputId: output.outputId,
    label: loopOutputEdgeLabel(output),
    sourceIndex: record.index,
    sourceStepId: record.stepKey,
    sourceNodeKey: `step-${record.index}`,
    sourceHandleId: loopOutputSourceHandleId(output)
  });
}

function addChildStepEdge(
  context: LoopLayoutGraphDraftContext,
  record: LoopStepRecord,
  output: LoopOutputTarget,
  childRecord: LoopStepRecord,
  nextVisitedStepIds: Set<string>
) {
  const canonicalChildRecord = loopCanonicalRecord(context.loopGraph, childRecord);
  const isFoldedChild = canonicalChildRecord.index !== childRecord.index;
  if (isFoldedChild) {
    const isReturnEdge = canonicalChildRecord.index <= record.index;
    layoutStepBranch(context, canonicalChildRecord, nextVisitedStepIds);
    addCanvasEdge(context, {
      key: `step-step-${record.index}-${canonicalChildRecord.index}-${childRecord.index}-${output.eventType}`,
      sourceNodeKey: `step-${record.index}`,
      targetNodeKey: `step-${canonicalChildRecord.index}`,
      sourceHandleId: loopOutputSourceHandleId(output),
      targetHandleId: isReturnEdge ? loopOutputTargetHandleId(output, "top") : loopOutputTargetHandleId(output, context.targetHandleId),
      tone: isReturnEdge ? "return" : undefined,
      eventType: output.eventType,
      label: loopOutputEdgeLabel(output),
      route: {
        sourceStepIndex: record.index,
        handlerStepIndex: childRecord.index,
        sourceStepId: record.stepKey,
        handlerStepId: childRecord.stepKey,
        eventType: output.eventType,
        outputId: output.outputId
      }
    });
    return;
  }

  layoutStepBranch(context, childRecord, nextVisitedStepIds);
  addDagreEdge(context, {
    source: `step-${record.index}`,
    target: `step-${childRecord.index}`,
    label: loopOutputEdgeLabel(output)
  });
  addCanvasEdge(context, {
    key: `step-step-${record.index}-${childRecord.index}-${output.eventType}`,
    sourceNodeKey: `step-${record.index}`,
    targetNodeKey: `step-${childRecord.index}`,
    sourceHandleId: loopOutputSourceHandleId(output),
    targetHandleId: loopOutputTargetHandleId(output, context.targetHandleId),
    eventType: output.eventType,
    label: loopOutputEdgeLabel(output),
    route: {
      sourceStepIndex: record.index,
      handlerStepIndex: childRecord.index,
      sourceStepId: record.stepKey,
      handlerStepId: childRecord.stepKey,
      eventType: output.eventType,
      outputId: output.outputId
    }
  });
}
