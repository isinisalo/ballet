import {
  loopFoldedRecords,
  type LoopGraph,
  type LoopOutputTarget,
  type LoopStepRecord
} from "./loopGraph";
import {
  loopEventOutputLabel,
  type LoopCanvasEdge,
  type LoopHandledEventNode
} from "./loopLayoutEdges";
import { loopNodeSizes } from "./loopLayoutConfig";
import {
  loopOutputEventNodeWidth,
  loopInputEventNodeWidth,
  loopOutputSourceHandleId,
  loopOutputTargetHandleId,
  loopPolicyNodeWidth
} from "./loopLayoutSizing";
import type { LoopCanvasLayoutNodeDraft, LoopDagreEdge, LoopLayoutDirection } from "./loopLayoutTypes";

export type LoopLayoutGraphDraft = {
  nodes: LoopCanvasLayoutNodeDraft[];
  dagreEdges: LoopDagreEdge[];
  canvasEdges: LoopCanvasEdge[];
};

export type LoopLayoutGraphDraftContext = {
  loopGraph: LoopGraph;
  editingPolicyIndex: number | null;
  direction: LoopLayoutDirection;
  sourceHandleId: string;
  targetHandleId: string;
  nodeDrafts: Map<string, LoopCanvasLayoutNodeDraft>;
  dagreEdges: LoopDagreEdge[];
  canvasEdges: LoopCanvasEdge[];
  edgeKeys: Set<string>;
  policyNodeIndexes: Set<number>;
  handledEventNodes: LoopHandledEventNode[];
};

export function loopPolicyInputEdgeLabel(record: LoopStepRecord) {
  if (!record.policy) return undefined;
  return record.policy.event ? loopEventOutputLabel(record.policy.event) : "Missing event";
}

export function loopOutputEdgeLabel(output: LoopOutputTarget) {
  return output.outputId === output.eventType ? loopEventOutputLabel(output.eventType) : output.outputId;
}

export function addDagreEdge(context: LoopLayoutGraphDraftContext, edge: LoopDagreEdge) {
  context.dagreEdges.push(edge);
}

export function addCanvasEdge(context: LoopLayoutGraphDraftContext, edge: LoopCanvasEdge) {
  if (context.edgeKeys.has(edge.key)) return;
  context.edgeKeys.add(edge.key);
  context.canvasEdges.push(edge);
}

export function addPolicyNode(context: LoopLayoutGraphDraftContext, record: LoopStepRecord, outputHandleCount: number) {
  const records = loopFoldedRecords(context.loopGraph, record);
  const isEditingPolicy = context.editingPolicyIndex === record.index;
  addNode(context, {
    key: `policy-${record.index}`,
    kind: "policy",
    width: loopPolicyNodeWidth(record),
    height: loopNodeSizes.policy.height,
    direction: context.direction,
    record,
    records,
    isEditingPolicy,
    outputHandleCount
  });
  context.policyNodeIndexes.add(record.index);
}

export function addOutputEventNode(
  context: LoopLayoutGraphDraftContext,
  record: LoopStepRecord,
  output: LoopOutputTarget,
  outputIndex: number
) {
  const key = `output-event-${record.index}-${output.outputId}`;
  addNode(context, {
    key,
    kind: "output-event",
    width: loopOutputEventNodeWidth(),
    height: loopNodeSizes.outputEvent.height,
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
    sourceHandleId: loopOutputSourceHandleId(output),
    targetHandleId: loopOutputTargetHandleId(output, context.targetHandleId),
    dashed: true,
    eventType: output.eventType,
    label: loopOutputEdgeLabel(output)
  });
}

export function addInputEventNode(context: LoopLayoutGraphDraftContext) {
  addNode(context, {
    key: "input-event",
    kind: "input-event",
    width: loopInputEventNodeWidth(),
    height: loopNodeSizes.inputEvent.height,
    direction: context.direction
  });
}

export function addFirstPolicyGhost(context: LoopLayoutGraphDraftContext) {
  addNode(context, {
    key: "first-policy-ghost",
    kind: "first-policy-ghost",
    width: loopNodeSizes.event.width,
    height: loopNodeSizes.event.height,
    direction: context.direction
  });
  addDagreEdge(context, { source: "input-event", target: "first-policy-ghost" });
  addCanvasEdge(context, {
    key: "input-event-first-policy",
    sourceNodeKey: "input-event",
    targetNodeKey: "first-policy-ghost",
    sourceHandleId: context.sourceHandleId,
    targetHandleId: context.targetHandleId,
    dashed: true
  });
}

function addNode(context: LoopLayoutGraphDraftContext, node: LoopCanvasLayoutNodeDraft) {
  if (context.nodeDrafts.has(node.key)) return;
  context.nodeDrafts.set(node.key, node);
}
