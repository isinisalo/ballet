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
  addFirstPolicyGhost,
  addOutputEventNode,
  addPolicyNode,
  addTriggerNode,
  loopOutputEdgeLabel,
  loopPolicyInputEdgeLabel,
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
  editingPolicyIndex,
  direction
}: {
  loopGraph: LoopGraph;
  editingPolicyIndex: number | null;
  direction: LoopLayoutDirection;
}): LoopLayoutGraphDraft {
  const { sourceHandleId, targetHandleId } = loopDirectionHandles[direction];
  const context: LoopLayoutGraphDraftContext = {
    loopGraph,
    editingPolicyIndex,
    direction,
    sourceHandleId,
    targetHandleId,
    nodeDrafts: new Map(),
    dagreEdges: [],
    canvasEdges: [],
    edgeKeys: new Set(),
    policyNodeIndexes: new Set(),
    handledEventNodes: []
  };

  addTriggerNode(context);
  if (loopGraph.rootRecords.length > 0) {
    loopGraph.rootRecords.forEach((record) => addRootPolicyBranch(context, record));
  } else {
    addFirstPolicyGhost(context);
  }
  loopExistingHandlerEdges({
    loopGraph,
    policyNodeIndexes: context.policyNodeIndexes,
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
      key: `trigger-policy-${record.index}`,
      sourceNodeKey: "trigger",
      targetNodeKey: `policy-${canonicalRecord.index}`,
      sourceHandleId: context.sourceHandleId,
      targetHandleId: context.targetHandleId,
      dashed: !record.policy,
      label: loopPolicyInputEdgeLabel(record)
    });
    return;
  }
  addDagreEdge(context, {
    source: "trigger",
    target: `policy-${record.index}`,
    label: loopPolicyInputEdgeLabel(record)
  });
  addCanvasEdge(context, {
    key: `trigger-policy-${record.index}`,
    sourceNodeKey: "trigger",
    targetNodeKey: `policy-${record.index}`,
    sourceHandleId: context.sourceHandleId,
    targetHandleId: context.targetHandleId,
    dashed: !record.policy,
    label: loopPolicyInputEdgeLabel(record)
  });
}

function layoutPolicyBranch(context: LoopLayoutGraphDraftContext, record: LoopStepRecord, visitedPolicyIds = new Set<string>()) {
  const canonicalRecord = loopCanonicalRecord(context.loopGraph, record);
  if (canonicalRecord.index !== record.index) return;
  if (visitedPolicyIds.has(record.policyId)) return;
  const nextVisitedPolicyIds = new Set(visitedPolicyIds);
  const activeOutputTasks: LoopActiveOutputTask[] = [];
  const inactiveOutputTargets: LoopOutputTarget[] = [];
  nextVisitedPolicyIds.add(record.policyId);

  collectOutputTasks(context, record, nextVisitedPolicyIds, activeOutputTasks, inactiveOutputTargets);
  const visibleInactiveOutputTargets = activeOutputTasks.some((task) => task.kind === "existing-handler" && task.hasBackwardHandler)
    ? []
    : inactiveOutputTargets;
  addPolicyNode(context, record, activeOutputTasks.length + visibleInactiveOutputTargets.length);

  activeOutputTasks.forEach((task) => {
    if (task.kind === "existing-handler") {
      addHandledEventNode(context, record, task.output);
      return;
    }
    task.childRecords.forEach((childRecord) => addChildPolicyEdge(context, record, task.output, childRecord, nextVisitedPolicyIds));
  });

  visibleInactiveOutputTargets.forEach((output, inactiveIndex) => {
    addOutputEventNode(context, record, output, activeOutputTasks.length + inactiveIndex);
  });
}

function collectOutputTasks(
  context: LoopLayoutGraphDraftContext,
  record: LoopStepRecord,
  nextVisitedPolicyIds: ReadonlySet<string>,
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
      .filter((childRecord) => childRecord.policyId !== record.policyId && !nextVisitedPolicyIds.has(childRecord.policyId));
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
    sourcePolicyId: record.policyId,
    sourceNodeKey: `policy-${record.index}`,
    sourceHandleId: loopOutputSourceHandleId(output)
  });
}

function addChildPolicyEdge(
  context: LoopLayoutGraphDraftContext,
  record: LoopStepRecord,
  output: LoopOutputTarget,
  childRecord: LoopStepRecord,
  nextVisitedPolicyIds: Set<string>
) {
  const canonicalChildRecord = loopCanonicalRecord(context.loopGraph, childRecord);
  const isFoldedChild = canonicalChildRecord.index !== childRecord.index;
  if (isFoldedChild) {
    const isReturnEdge = canonicalChildRecord.index <= record.index;
    layoutPolicyBranch(context, canonicalChildRecord, nextVisitedPolicyIds);
    addCanvasEdge(context, {
      key: `policy-policy-${record.index}-${canonicalChildRecord.index}-${childRecord.index}-${output.eventType}`,
      sourceNodeKey: `policy-${record.index}`,
      targetNodeKey: `policy-${canonicalChildRecord.index}`,
      sourceHandleId: loopOutputSourceHandleId(output),
      targetHandleId: isReturnEdge ? loopOutputTargetHandleId(output, "top") : loopOutputTargetHandleId(output, context.targetHandleId),
      tone: isReturnEdge ? "return" : undefined,
      eventType: output.eventType,
      label: loopOutputEdgeLabel(output),
      route: {
        sourceStepIndex: record.index,
        handlerStepIndex: childRecord.index,
        sourcePolicyId: record.policyId,
        handlerPolicyId: childRecord.policyId,
        eventType: output.eventType,
        outputId: output.outputId
      }
    });
    return;
  }

  layoutPolicyBranch(context, childRecord, nextVisitedPolicyIds);
  addDagreEdge(context, {
    source: `policy-${record.index}`,
    target: `policy-${childRecord.index}`,
    label: loopOutputEdgeLabel(output)
  });
  addCanvasEdge(context, {
    key: `policy-policy-${record.index}-${childRecord.index}-${output.eventType}`,
    sourceNodeKey: `policy-${record.index}`,
    targetNodeKey: `policy-${childRecord.index}`,
    sourceHandleId: loopOutputSourceHandleId(output),
    targetHandleId: loopOutputTargetHandleId(output, context.targetHandleId),
    eventType: output.eventType,
    label: loopOutputEdgeLabel(output),
    route: {
      sourceStepIndex: record.index,
      handlerStepIndex: childRecord.index,
      sourcePolicyId: record.policyId,
      handlerPolicyId: childRecord.policyId,
      eventType: output.eventType,
      outputId: output.outputId
    }
  });
}
