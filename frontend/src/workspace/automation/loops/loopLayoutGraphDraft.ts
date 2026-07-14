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
import { defaultLoopNodeStyle, loopNodeStyleCatalog } from "@shared/api/workspace-contracts";
import { loopNodeSizes } from "./loopLayoutConfig";
import {
  loopOutputEventNodeWidth,
  loopOutputSourceHandleId,
  loopOutputTargetHandleId
} from "./loopLayoutSizing";
import type { LoopCanvasLayoutNodeDraft, LoopDagreEdge, LoopLayoutDirection } from "./loopLayoutTypes";

export type LoopLayoutGraphDraft = {
  nodes: LoopCanvasLayoutNodeDraft[];
  dagreEdges: LoopDagreEdge[];
  canvasEdges: LoopCanvasEdge[];
};

export type LoopLayoutGraphDraftContext = {
  loopGraph: LoopGraph;
  editingStepIndex: number | null;
  direction: LoopLayoutDirection;
  sourceHandleId: string;
  targetHandleId: string;
  nodeDrafts: Map<string, LoopCanvasLayoutNodeDraft>;
  dagreEdges: LoopDagreEdge[];
  canvasEdges: LoopCanvasEdge[];
  edgeKeys: Set<string>;
  stepNodeIndexes: Set<number>;
  handledEventNodes: LoopHandledEventNode[];
};

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

export function addStepNode(context: LoopLayoutGraphDraftContext, record: LoopStepRecord, outputHandleCount: number) {
  const records = loopFoldedRecords(context.loopGraph, record);
  const isEditingStep = context.editingStepIndex === record.index;
  const nodeSize = loopNodeStyleCatalog[record.step?.nodeStyle ?? defaultLoopNodeStyle].pixels;
  addNode(context, {
    key: `step-${record.index}`,
    kind: "step",
    width: nodeSize,
    height: nodeSize,
    direction: context.direction,
    record,
    records,
    isEditingStep,
    outputHandleCount
  });
  context.stepNodeIndexes.add(record.index);
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
    sourceStepId: record.stepKey,
    outputIndex
  });
  addDagreEdge(context, { source: `step-${record.index}`, target: key });
  addCanvasEdge(context, {
    key: `step-output-event-${record.index}-${output.outputId}`,
    sourceNodeKey: `step-${record.index}`,
    targetNodeKey: key,
    sourceHandleId: loopOutputSourceHandleId(output),
    targetHandleId: loopOutputTargetHandleId(output, context.targetHandleId),
    eventType: output.eventType,
    label: loopOutputEdgeLabel(output),
    route: {
      sourceStepIndex: record.index,
      sourceStepId: record.stepKey,
      eventType: output.eventType,
      outputId: output.outputId
    }
  });
}

export function addFirstStepGhost(context: LoopLayoutGraphDraftContext) {
  addNode(context, {
    key: "first-step-ghost",
    kind: "first-step-ghost",
    width: loopNodeSizes.event.width,
    height: loopNodeSizes.event.height,
    direction: context.direction
  });
}

function addNode(context: LoopLayoutGraphDraftContext, node: LoopCanvasLayoutNodeDraft) {
  if (context.nodeDrafts.has(node.key)) return;
  context.nodeDrafts.set(node.key, node);
}
