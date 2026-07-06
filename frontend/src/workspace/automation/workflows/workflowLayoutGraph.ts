import {
  workflowCanonicalRecord,
  workflowFoldedOutputTargets,
  workflowFoldedRecords,
  type WorkflowGraph,
  type WorkflowOutputTarget,
  type WorkflowStepRecord
} from "./workflowGraph";
import { workflowExistingHandlerEdges } from "./workflowLayoutEdges";
import { workflowDirectionHandles } from "./workflowLayoutConfig";
import {
  addCanvasEdge,
  addDagreEdge,
  addFirstPolicyGhost,
  addOutputEventNode,
  addPolicyNode,
  addTriggerNode,
  workflowOutputEdgeLabel,
  workflowPolicyInputEdgeLabel,
  type WorkflowLayoutGraphDraft,
  type WorkflowLayoutGraphDraftContext
} from "./workflowLayoutGraphDraft";
import {
  workflowOutputSourceHandleId
} from "./workflowLayoutSizing";
import type { WorkflowActiveOutputTask, WorkflowLayoutDirection } from "./workflowLayoutTypes";

export function buildWorkflowLayoutGraphDraft({
  workflowGraph,
  editingPolicyIndex,
  direction
}: {
  workflowGraph: WorkflowGraph;
  editingPolicyIndex: number | null;
  direction: WorkflowLayoutDirection;
}): WorkflowLayoutGraphDraft {
  const { sourceHandleId, targetHandleId } = workflowDirectionHandles[direction];
  const context: WorkflowLayoutGraphDraftContext = {
    workflowGraph,
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
  if (workflowGraph.rootRecords.length > 0) {
    workflowGraph.rootRecords.forEach((record) => addRootPolicyBranch(context, record));
  } else {
    addFirstPolicyGhost(context);
  }
  workflowExistingHandlerEdges({
    workflowGraph,
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

function addRootPolicyBranch(context: WorkflowLayoutGraphDraftContext, record: WorkflowStepRecord) {
  const canonicalRecord = workflowCanonicalRecord(context.workflowGraph, record);
  layoutPolicyBranch(context, canonicalRecord);
  if (canonicalRecord.index !== record.index) {
    addCanvasEdge(context, {
      key: `trigger-policy-${record.index}`,
      sourceNodeKey: "trigger",
      targetNodeKey: `policy-${canonicalRecord.index}`,
      sourceHandleId: context.sourceHandleId,
      targetHandleId: context.targetHandleId,
      dashed: !record.policy,
      label: workflowPolicyInputEdgeLabel(record)
    });
    return;
  }
  addDagreEdge(context, {
    source: "trigger",
    target: `policy-${record.index}`,
    label: workflowPolicyInputEdgeLabel(record)
  });
  addCanvasEdge(context, {
    key: `trigger-policy-${record.index}`,
    sourceNodeKey: "trigger",
    targetNodeKey: `policy-${record.index}`,
    sourceHandleId: context.sourceHandleId,
    targetHandleId: context.targetHandleId,
    dashed: !record.policy,
    label: workflowPolicyInputEdgeLabel(record)
  });
}

function layoutPolicyBranch(context: WorkflowLayoutGraphDraftContext, record: WorkflowStepRecord, visitedPolicyIds = new Set<string>()) {
  const canonicalRecord = workflowCanonicalRecord(context.workflowGraph, record);
  if (canonicalRecord.index !== record.index) return;
  if (visitedPolicyIds.has(record.policyId)) return;
  const nextVisitedPolicyIds = new Set(visitedPolicyIds);
  const activeOutputTasks: WorkflowActiveOutputTask[] = [];
  const inactiveOutputTargets: WorkflowOutputTarget[] = [];
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
  context: WorkflowLayoutGraphDraftContext,
  record: WorkflowStepRecord,
  nextVisitedPolicyIds: ReadonlySet<string>,
  activeOutputTasks: WorkflowActiveOutputTask[],
  inactiveOutputTargets: WorkflowOutputTarget[]
) {
  const recordOutputTargets = workflowFoldedOutputTargets(context.workflowGraph, record);
  const foldedRecords = workflowFoldedRecords(context.workflowGraph, record);

  recordOutputTargets.forEach((output) => {
    const { eventType } = output;
    const childRecords = foldedRecords.flatMap((sourceRecord) =>
      context.workflowGraph.childRecordsByParentEvent.get(`${sourceRecord.index}:${eventType}`) ?? []
    )
      .filter((childRecord) => childRecord.policyId !== record.policyId && !nextVisitedPolicyIds.has(childRecord.policyId));
    const existingHandlerRecords = (context.workflowGraph.eventHandlerRecordsByEvent.get(eventType) ?? [])
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

function addHandledEventNode(context: WorkflowLayoutGraphDraftContext, record: WorkflowStepRecord, output: WorkflowOutputTarget) {
  context.handledEventNodes.push({
    eventType: output.eventType,
    label: workflowOutputEdgeLabel(output),
    sourceIndex: record.index,
    sourceNodeKey: `policy-${record.index}`,
    sourceHandleId: workflowOutputSourceHandleId()
  });
}

function addChildPolicyEdge(
  context: WorkflowLayoutGraphDraftContext,
  record: WorkflowStepRecord,
  output: WorkflowOutputTarget,
  childRecord: WorkflowStepRecord,
  nextVisitedPolicyIds: Set<string>
) {
  const canonicalChildRecord = workflowCanonicalRecord(context.workflowGraph, childRecord);
  const isFoldedChild = canonicalChildRecord.index !== childRecord.index;
  if (isFoldedChild) {
    const isReturnEdge = canonicalChildRecord.index <= record.index;
    layoutPolicyBranch(context, canonicalChildRecord, nextVisitedPolicyIds);
    addCanvasEdge(context, {
      key: `policy-policy-${record.index}-${canonicalChildRecord.index}-${childRecord.index}-${output.eventType}`,
      sourceNodeKey: `policy-${record.index}`,
      targetNodeKey: `policy-${canonicalChildRecord.index}`,
      sourceHandleId: workflowOutputSourceHandleId(),
      targetHandleId: isReturnEdge ? "top" : context.targetHandleId,
      tone: isReturnEdge ? "return" : undefined,
      eventType: output.eventType,
      label: workflowOutputEdgeLabel(output)
    });
    return;
  }

  layoutPolicyBranch(context, childRecord, nextVisitedPolicyIds);
  addDagreEdge(context, {
    source: `policy-${record.index}`,
    target: `policy-${childRecord.index}`,
    label: workflowOutputEdgeLabel(output)
  });
  addCanvasEdge(context, {
    key: `policy-policy-${record.index}-${childRecord.index}-${output.eventType}`,
    sourceNodeKey: `policy-${record.index}`,
    targetNodeKey: `policy-${childRecord.index}`,
    sourceHandleId: workflowOutputSourceHandleId(),
    targetHandleId: context.targetHandleId,
    eventType: output.eventType,
    label: workflowOutputEdgeLabel(output)
  });
}
