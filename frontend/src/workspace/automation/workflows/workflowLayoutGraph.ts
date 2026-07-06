import { workflowOutputEvents, type WorkflowGraph, type WorkflowOutputTarget, type WorkflowStepRecord } from "./workflowGraph";
import {
  workflowExistingHandlerEdges,
  workflowEventOutputLabel,
  type WorkflowCanvasEdge,
  type WorkflowHandledEventNode
} from "./workflowLayoutEdges";
import { workflowDirectionHandles, workflowNodeSizes } from "./workflowLayoutConfig";
import {
  workflowOutputEventNodeWidth,
  workflowOutputSourceHandleId,
  workflowPolicyNodeWidth,
  workflowTriggerNodeWidth
} from "./workflowLayoutSizing";
import type { WorkflowActiveOutputTask, WorkflowCanvasLayoutNodeDraft, WorkflowDagreEdge, WorkflowLayoutDirection } from "./workflowLayoutTypes";

type WorkflowLayoutGraphDraft = {
  nodes: WorkflowCanvasLayoutNodeDraft[];
  dagreEdges: WorkflowDagreEdge[];
  canvasEdges: WorkflowCanvasEdge[];
};

type WorkflowLayoutGraphDraftContext = {
  workflowGraph: WorkflowGraph;
  editingPolicyIndex: number | null;
  direction: WorkflowLayoutDirection;
  sourceHandleId: string;
  targetHandleId: string;
  nodeDrafts: Map<string, WorkflowCanvasLayoutNodeDraft>;
  dagreEdges: WorkflowDagreEdge[];
  canvasEdges: WorkflowCanvasEdge[];
  edgeKeys: Set<string>;
  policyNodeIndexes: Set<number>;
  handledEventNodes: WorkflowHandledEventNode[];
};

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

function workflowPolicyInputEdgeLabel(record: WorkflowStepRecord) {
  if (!record.policy) return undefined;
  if (record.policy.source === "trigger") return record.policy.trigger || "Missing trigger";
  return record.policy.event ? workflowEventOutputLabel(record.policy.event) : "Missing event";
}

function workflowOutputEdgeLabel(output: WorkflowOutputTarget) {
  return output.outputId === output.eventType ? workflowEventOutputLabel(output.eventType) : output.outputId;
}

function addNode(context: WorkflowLayoutGraphDraftContext, node: WorkflowCanvasLayoutNodeDraft) {
  if (context.nodeDrafts.has(node.key)) return;
  context.nodeDrafts.set(node.key, node);
}

function addDagreEdge(context: WorkflowLayoutGraphDraftContext, edge: WorkflowDagreEdge) {
  context.dagreEdges.push(edge);
}

function addCanvasEdge(context: WorkflowLayoutGraphDraftContext, edge: WorkflowCanvasEdge) {
  if (context.edgeKeys.has(edge.key)) return;
  context.edgeKeys.add(edge.key);
  context.canvasEdges.push(edge);
}

function addPolicyNode(context: WorkflowLayoutGraphDraftContext, record: WorkflowStepRecord, outputHandleCount: number) {
  const isEditingPolicy = context.editingPolicyIndex === record.index;
  addNode(context, {
    key: `policy-${record.index}`,
    kind: "policy",
    width: workflowPolicyNodeWidth(record),
    height: workflowNodeSizes.policy.height,
    direction: context.direction,
    record,
    isEditingPolicy,
    outputHandleCount
  });
  context.policyNodeIndexes.add(record.index);
}

function addOutputEventNode(context: WorkflowLayoutGraphDraftContext, record: WorkflowStepRecord, output: WorkflowOutputTarget, outputIndex: number) {
  const key = `output-event-${record.index}-${output.outputId}`;
  addNode(context, {
    key,
    kind: "output-event",
    width: workflowOutputEventNodeWidth(),
    height: workflowNodeSizes.outputEvent.height,
    direction: context.direction,
    record,
    outputEvent: {
      outputId: output.outputId,
      eventType: output.eventType,
      outputType: output.type
    },
    sourcePolicyId: record.policyId,
    outputIndex
  });
  addDagreEdge(context, { source: `policy-${record.index}`, target: key });
  addCanvasEdge(context, {
    key: `policy-output-event-${record.index}-${output.outputId}`,
    sourceNodeKey: `policy-${record.index}`,
    targetNodeKey: key,
    sourceHandleId: workflowOutputSourceHandleId(),
    targetHandleId: context.targetHandleId,
    dashed: true,
    eventType: output.eventType,
    label: workflowOutputEdgeLabel(output)
  });
}

function addTriggerNode(context: WorkflowLayoutGraphDraftContext) {
  addNode(context, {
    key: "trigger",
    kind: "trigger",
    width: workflowTriggerNodeWidth(),
    height: workflowNodeSizes.trigger.height,
    direction: context.direction
  });
}

function addRootPolicyBranch(context: WorkflowLayoutGraphDraftContext, record: WorkflowStepRecord) {
  layoutPolicyBranch(context, record);
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

function addFirstPolicyGhost(context: WorkflowLayoutGraphDraftContext) {
  addNode(context, {
    key: "first-policy-ghost",
    kind: "first-policy-ghost",
    width: workflowNodeSizes.event.width,
    height: workflowNodeSizes.event.height,
    direction: context.direction
  });
  addDagreEdge(context, { source: "trigger", target: "first-policy-ghost" });
  addCanvasEdge(context, {
    key: "trigger-first-policy",
    sourceNodeKey: "trigger",
    targetNodeKey: "first-policy-ghost",
    sourceHandleId: context.sourceHandleId,
    targetHandleId: context.targetHandleId,
    dashed: true
  });
}

function layoutPolicyBranch(context: WorkflowLayoutGraphDraftContext, record: WorkflowStepRecord, visitedPolicyIds = new Set<string>()) {
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
  const recordOutputTargets = record.outputTargets ?? workflowOutputEvents(record).map((eventType) => ({
    outputId: eventType,
    eventType,
    type: "event" as const
  }));

  recordOutputTargets.forEach((output) => {
    const { eventType } = output;
    const childRecords = (context.workflowGraph.childRecordsByParentEvent.get(`${record.index}:${eventType}`) ?? [])
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
