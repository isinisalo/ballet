import {
  workflowFoldedRecords,
  type WorkflowGraph,
  type WorkflowOutputTarget,
  type WorkflowStepRecord
} from "./workflowGraph";
import {
  workflowEventOutputLabel,
  type WorkflowCanvasEdge,
  type WorkflowHandledEventNode
} from "./workflowLayoutEdges";
import { workflowNodeSizes } from "./workflowLayoutConfig";
import {
  workflowOutputEventNodeWidth,
  workflowOutputSourceHandleId,
  workflowPolicyNodeWidth,
  workflowTriggerNodeWidth
} from "./workflowLayoutSizing";
import type { WorkflowCanvasLayoutNodeDraft, WorkflowDagreEdge, WorkflowLayoutDirection } from "./workflowLayoutTypes";

export type WorkflowLayoutGraphDraft = {
  nodes: WorkflowCanvasLayoutNodeDraft[];
  dagreEdges: WorkflowDagreEdge[];
  canvasEdges: WorkflowCanvasEdge[];
};

export type WorkflowLayoutGraphDraftContext = {
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

export function workflowPolicyInputEdgeLabel(record: WorkflowStepRecord) {
  if (!record.policy) return undefined;
  if (record.policy.source === "trigger") return record.policy.trigger || "Missing trigger";
  return record.policy.event ? workflowEventOutputLabel(record.policy.event) : "Missing event";
}

export function workflowOutputEdgeLabel(output: WorkflowOutputTarget) {
  return output.outputId === output.eventType ? workflowEventOutputLabel(output.eventType) : output.outputId;
}

export function addDagreEdge(context: WorkflowLayoutGraphDraftContext, edge: WorkflowDagreEdge) {
  context.dagreEdges.push(edge);
}

export function addCanvasEdge(context: WorkflowLayoutGraphDraftContext, edge: WorkflowCanvasEdge) {
  if (context.edgeKeys.has(edge.key)) return;
  context.edgeKeys.add(edge.key);
  context.canvasEdges.push(edge);
}

export function addPolicyNode(context: WorkflowLayoutGraphDraftContext, record: WorkflowStepRecord, outputHandleCount: number) {
  const records = workflowFoldedRecords(context.workflowGraph, record);
  const isEditingPolicy = context.editingPolicyIndex === record.index;
  addNode(context, {
    key: `policy-${record.index}`,
    kind: "policy",
    width: workflowPolicyNodeWidth(record),
    height: workflowNodeSizes.policy.height,
    direction: context.direction,
    record,
    records,
    isEditingPolicy,
    outputHandleCount
  });
  context.policyNodeIndexes.add(record.index);
}

export function addOutputEventNode(
  context: WorkflowLayoutGraphDraftContext,
  record: WorkflowStepRecord,
  output: WorkflowOutputTarget,
  outputIndex: number
) {
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
      outputType: output.type,
      ...(output.type === "trigger" ? { trigger: output.trigger, workflowId: output.workflowId } : {})
    },
    sourcePolicyId: record.policyId,
    outputIndex
  });
  addDagreEdge(context, { source: `policy-${record.index}`, target: key });
  addCanvasEdge(context, {
    key: `policy-output-event-${record.index}-${output.outputId}`,
    sourceNodeKey: `policy-${record.index}`,
    targetNodeKey: key,
    sourceHandleId: workflowOutputSourceHandleId(output),
    targetHandleId: context.targetHandleId,
    dashed: true,
    eventType: output.eventType,
    label: workflowOutputEdgeLabel(output)
  });
}

export function addTriggerNode(context: WorkflowLayoutGraphDraftContext) {
  addNode(context, {
    key: "trigger",
    kind: "trigger",
    width: workflowTriggerNodeWidth(),
    height: workflowNodeSizes.trigger.height,
    direction: context.direction
  });
}

export function addFirstPolicyGhost(context: WorkflowLayoutGraphDraftContext) {
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

function addNode(context: WorkflowLayoutGraphDraftContext, node: WorkflowCanvasLayoutNodeDraft) {
  if (context.nodeDrafts.has(node.key)) return;
  context.nodeDrafts.set(node.key, node);
}
