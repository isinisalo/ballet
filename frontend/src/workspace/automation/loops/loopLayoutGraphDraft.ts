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
  loopActionNodeWidth
} from "./loopLayoutSizing";
import type { LoopCanvasLayoutNodeDraft, LoopDagreEdge, LoopLayoutDirection } from "./loopLayoutTypes";

export type LoopLayoutGraphDraft = {
  nodes: LoopCanvasLayoutNodeDraft[];
  dagreEdges: LoopDagreEdge[];
  canvasEdges: LoopCanvasEdge[];
};

export type LoopLayoutGraphDraftContext = {
  loopGraph: LoopGraph;
  editingActionIndex: number | null;
  direction: LoopLayoutDirection;
  sourceHandleId: string;
  targetHandleId: string;
  nodeDrafts: Map<string, LoopCanvasLayoutNodeDraft>;
  dagreEdges: LoopDagreEdge[];
  canvasEdges: LoopCanvasEdge[];
  edgeKeys: Set<string>;
  actionNodeIndexes: Set<number>;
  handledEventNodes: LoopHandledEventNode[];
};

export function loopActionInputEdgeLabel(record: LoopStepRecord) {
  if (!record.action) return undefined;
  return record.action.id ? loopEventOutputLabel(record.action.id) : "Missing action";
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

export function addActionNode(context: LoopLayoutGraphDraftContext, record: LoopStepRecord, outputHandleCount: number) {
  const records = loopFoldedRecords(context.loopGraph, record);
  const isEditingAction = context.editingActionIndex === record.index;
  addNode(context, {
    key: `action-${record.index}`,
    kind: "action",
    width: loopActionNodeWidth(record),
    height: loopNodeSizes.action.height,
    direction: context.direction,
    record,
    records,
    isEditingAction,
    outputHandleCount
  });
  context.actionNodeIndexes.add(record.index);
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
    sourceActionId: record.actionId,
    outputIndex
  });
  addDagreEdge(context, { source: `action-${record.index}`, target: key });
  addCanvasEdge(context, {
    key: `action-output-event-${record.index}-${output.outputId}`,
    sourceNodeKey: `action-${record.index}`,
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

export function addFirstActionGhost(context: LoopLayoutGraphDraftContext) {
  addNode(context, {
    key: "first-action-ghost",
    kind: "first-action-ghost",
    width: loopNodeSizes.event.width,
    height: loopNodeSizes.event.height,
    direction: context.direction
  });
  addDagreEdge(context, { source: "input-event", target: "first-action-ghost" });
  addCanvasEdge(context, {
    key: "input-event-first-action",
    sourceNodeKey: "input-event",
    targetNodeKey: "first-action-ghost",
    sourceHandleId: context.sourceHandleId,
    targetHandleId: context.targetHandleId,
    dashed: true
  });
}

function addNode(context: LoopLayoutGraphDraftContext, node: LoopCanvasLayoutNodeDraft) {
  if (context.nodeDrafts.has(node.key)) return;
  context.nodeDrafts.set(node.key, node);
}
