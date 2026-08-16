import {
  loopFoldedRecords,
  type LoopGraph,
  type LoopOutputTarget,
  type LoopNodeRecord
} from "./loopGraph";
import {
  loopEventOutputLabel,
  type LoopCanvasEdge,
  type LoopHandledEventNode
} from "./loopLayoutEdges";
import { defaultLoopNodeSize, loopNodeSizeCatalog } from "@shared/api/workspace-contracts";
import { loopNodeSizes } from "./loopLayoutConfig";
import type { LoopCanvasLayoutNodeDraft, LoopDagreEdge, LoopLayoutDirection } from "./loopLayoutTypes";

export type LoopLayoutGraphDraft = {
  nodes: LoopCanvasLayoutNodeDraft[];
  dagreEdges: LoopDagreEdge[];
  canvasEdges: LoopCanvasEdge[];
};

export type LoopLayoutGraphDraftContext = {
  loopGraph: LoopGraph;
  editingNodeIndex: number | null;
  direction: LoopLayoutDirection;
  sourceHandleId: string;
  targetHandleId: string;
  nodeDrafts: Map<string, LoopCanvasLayoutNodeDraft>;
  dagreEdges: LoopDagreEdge[];
  canvasEdges: LoopCanvasEdge[];
  edgeKeys: Set<string>;
  workLoopNodeIndexes: Set<number>;
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

export function addWorkLoopNodeLayout(context: LoopLayoutGraphDraftContext, record: LoopNodeRecord, outputHandleCount: number) {
  const records = loopFoldedRecords(context.loopGraph, record);
  const isEditingNode = context.editingNodeIndex === record.index;
  const nodeSize = loopNodeSizeCatalog[record.node?.nodeSize ?? defaultLoopNodeSize].pixels;
  const terminal = record.node?.terminal === true;
  addNode(context, {
    key: `node-${record.index}`,
    kind: "work-loop-node",
    width: terminal ? nodeSize : loopNodeSizes.workLoopNode.maxWidth,
    height: terminal ? nodeSize : loopNodeSizes.workLoopNode.height,
    direction: context.direction,
    record,
    records,
    isEditingNode,
    outputHandleCount
  });
  context.workLoopNodeIndexes.add(record.index);
}

export function addFirstNodeGhost(context: LoopLayoutGraphDraftContext) {
  addNode(context, {
    key: "first-node-ghost",
    kind: "first-node-ghost",
    width: loopNodeSizes.event.width,
    height: loopNodeSizes.event.height,
    direction: context.direction
  });
}

function addNode(context: LoopLayoutGraphDraftContext, node: LoopCanvasLayoutNodeDraft) {
  if (context.nodeDrafts.has(node.key)) return;
  context.nodeDrafts.set(node.key, node);
}
