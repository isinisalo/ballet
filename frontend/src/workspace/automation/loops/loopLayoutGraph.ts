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
  addFirstActionGhost,
  addInputEventNode,
  addOutputEventNode,
  addActionNode,
  loopOutputEdgeLabel,
  loopActionInputEdgeLabel,
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
  editingActionIndex,
  direction
}: {
  loopGraph: LoopGraph;
  editingActionIndex: number | null;
  direction: LoopLayoutDirection;
}): LoopLayoutGraphDraft {
  const { sourceHandleId, targetHandleId } = loopDirectionHandles[direction];
  const context: LoopLayoutGraphDraftContext = {
    loopGraph,
    editingActionIndex,
    direction,
    sourceHandleId,
    targetHandleId,
    nodeDrafts: new Map(),
    dagreEdges: [],
    canvasEdges: [],
    edgeKeys: new Set(),
    actionNodeIndexes: new Set(),
    handledEventNodes: []
  };

  addInputEventNode(context);
  if (loopGraph.rootRecords.length > 0) {
    loopGraph.rootRecords.forEach((record) => addRootPolicyBranch(context, record));
  } else {
    addFirstActionGhost(context);
  }
  loopExistingHandlerEdges({
    loopGraph,
    actionNodeIndexes: context.actionNodeIndexes,
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

function addRootPolicyBranch(context: LoopLayoutGraphDraftContext, record: LoopStepRecord) {
  const canonicalRecord = loopCanonicalRecord(context.loopGraph, record);
  layoutPolicyBranch(context, canonicalRecord);
  if (canonicalRecord.index !== record.index) {
    addCanvasEdge(context, {
      key: `input-event-action-${record.index}`,
      sourceNodeKey: "input-event",
      targetNodeKey: `action-${canonicalRecord.index}`,
      sourceHandleId: context.sourceHandleId,
      targetHandleId: context.targetHandleId,
      dashed: !record.action,
      label: loopActionInputEdgeLabel(record)
    });
    return;
  }
  addDagreEdge(context, {
    source: "input-event",
    target: `action-${record.index}`,
    label: loopActionInputEdgeLabel(record)
  });
  addCanvasEdge(context, {
    key: `input-event-action-${record.index}`,
    sourceNodeKey: "input-event",
    targetNodeKey: `action-${record.index}`,
    sourceHandleId: context.sourceHandleId,
    targetHandleId: context.targetHandleId,
    dashed: !record.action,
    label: loopActionInputEdgeLabel(record)
  });
}

function layoutPolicyBranch(context: LoopLayoutGraphDraftContext, record: LoopStepRecord, visitedActionIds = new Set<string>()) {
  const canonicalRecord = loopCanonicalRecord(context.loopGraph, record);
  if (canonicalRecord.index !== record.index) return;
  if (visitedActionIds.has(record.actionId)) return;
  const nextVisitedActionIds = new Set(visitedActionIds);
  const activeOutputTasks: LoopActiveOutputTask[] = [];
  const inactiveOutputTargets: LoopOutputTarget[] = [];
  nextVisitedActionIds.add(record.actionId);

  collectOutputTasks(context, record, nextVisitedActionIds, activeOutputTasks, inactiveOutputTargets);
  const visibleInactiveOutputTargets = activeOutputTasks.some((task) => task.kind === "existing-handler" && task.hasBackwardHandler)
    ? []
    : inactiveOutputTargets;
  addActionNode(context, record, activeOutputTasks.length + visibleInactiveOutputTargets.length);

  activeOutputTasks.forEach((task) => {
    if (task.kind === "existing-handler") {
      addHandledEventNode(context, record, task.output);
      return;
    }
    task.childRecords.forEach((childRecord) => addChildPolicyEdge(context, record, task.output, childRecord, nextVisitedActionIds));
  });

  visibleInactiveOutputTargets.forEach((output, inactiveIndex) => {
    addOutputEventNode(context, record, output, activeOutputTasks.length + inactiveIndex);
  });
}

function collectOutputTasks(
  context: LoopLayoutGraphDraftContext,
  record: LoopStepRecord,
  nextVisitedActionIds: ReadonlySet<string>,
  activeOutputTasks: LoopActiveOutputTask[],
  inactiveOutputTargets: LoopOutputTarget[]
) {
  const recordOutputTargets = loopFoldedOutputTargets(context.loopGraph, record);
  const foldedRecords = loopFoldedRecords(context.loopGraph, record);

  recordOutputTargets.forEach((output) => {
    const { eventType } = output;
    const childRecords = foldedRecords.flatMap((sourceRecord) =>
      context.loopGraph.childRecordsByParentEvent.get(`${sourceRecord.index}:${eventType}`) ?? []
    )
      .filter((childRecord) => childRecord.actionId !== record.actionId && !nextVisitedActionIds.has(childRecord.actionId));
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

    inactiveOutputTargets.push(output);
  });
}

function addHandledEventNode(context: LoopLayoutGraphDraftContext, record: LoopStepRecord, output: LoopOutputTarget) {
  context.handledEventNodes.push({
    eventType: output.eventType,
    outputId: output.outputId,
    label: loopOutputEdgeLabel(output),
    sourceIndex: record.index,
    sourceActionId: record.actionId,
    sourceNodeKey: `action-${record.index}`,
    sourceHandleId: loopOutputSourceHandleId(output)
  });
}

function addChildPolicyEdge(
  context: LoopLayoutGraphDraftContext,
  record: LoopStepRecord,
  output: LoopOutputTarget,
  childRecord: LoopStepRecord,
  nextVisitedActionIds: Set<string>
) {
  const canonicalChildRecord = loopCanonicalRecord(context.loopGraph, childRecord);
  const isFoldedChild = canonicalChildRecord.index !== childRecord.index;
  if (isFoldedChild) {
    const isReturnEdge = canonicalChildRecord.index <= record.index;
    layoutPolicyBranch(context, canonicalChildRecord, nextVisitedActionIds);
    addCanvasEdge(context, {
      key: `action-action-${record.index}-${canonicalChildRecord.index}-${childRecord.index}-${output.eventType}`,
      sourceNodeKey: `action-${record.index}`,
      targetNodeKey: `action-${canonicalChildRecord.index}`,
      sourceHandleId: loopOutputSourceHandleId(output),
      targetHandleId: isReturnEdge ? loopOutputTargetHandleId(output, "top") : loopOutputTargetHandleId(output, context.targetHandleId),
      tone: isReturnEdge ? "return" : undefined,
      eventType: output.eventType,
      label: loopOutputEdgeLabel(output),
      route: {
        sourceStepIndex: record.index,
        handlerStepIndex: childRecord.index,
        sourceActionId: record.actionId,
        handlerActionId: childRecord.actionId,
        eventType: output.eventType,
        outputId: output.outputId
      }
    });
    return;
  }

  layoutPolicyBranch(context, childRecord, nextVisitedActionIds);
  addDagreEdge(context, {
    source: `action-${record.index}`,
    target: `action-${childRecord.index}`,
    label: loopOutputEdgeLabel(output)
  });
  addCanvasEdge(context, {
    key: `action-action-${record.index}-${childRecord.index}-${output.eventType}`,
    sourceNodeKey: `action-${record.index}`,
    targetNodeKey: `action-${childRecord.index}`,
    sourceHandleId: loopOutputSourceHandleId(output),
    targetHandleId: loopOutputTargetHandleId(output, context.targetHandleId),
    eventType: output.eventType,
    label: loopOutputEdgeLabel(output),
    route: {
      sourceStepIndex: record.index,
      handlerStepIndex: childRecord.index,
      sourceActionId: record.actionId,
      handlerActionId: childRecord.actionId,
      eventType: output.eventType,
      outputId: output.outputId
    }
  });
}
