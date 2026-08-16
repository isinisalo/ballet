import type { PointerEvent, RefObject } from "react";
import type { Edge, Node } from "@xyflow/react";
import type { LoopVisualNode } from "./loopVisualProjection";
import type { LoopNodeRecord } from "./loopGraph";
import type { LoopCanvasEdge, LoopCanvasLayout, LoopCanvasLayoutNode } from "./loopLayout";
import type { LoopTheme } from "@shared/api/workspace-contracts";

export type LoopCanvasProps = {
  layout: LoopCanvasLayout;
  theme: LoopTheme;
  selectedLoopId: string;
  nodeByKey: Map<string, LoopVisualNode>;
  draggedNodeIndex: number | null;
  dragOverNodeIndex: number | null;
  selectedNodeIndexes: number[];
  readOnly: boolean;
  staticPreview: boolean;
  canvasHeight: number | null;
  isCanvasPanning: boolean;
  loopCanvasRef: RefObject<HTMLDivElement>;
  canAddFirstNode: boolean;
  onNodePointerDown: (event: PointerEvent<HTMLDivElement>, loopId: string, index: number) => void;
  onNodePointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  onNodePointerUp: (event: PointerEvent<HTMLDivElement>) => boolean;
  onNodePointerCancel: () => void;
  onCanvasMoveStart: () => void;
  onCanvasMoveEnd: () => void;
  onNodeSelect: (records: LoopNodeRecord[]) => void;
  onOutputHandlerSelect: (edge: LoopCanvasEdge) => void;
  onAddFirstNode: () => void;
};

export type LoopNodeContext = Omit<LoopCanvasProps, "layout" | "canvasHeight" | "isCanvasPanning" | "loopCanvasRef" | "onCanvasMoveStart" | "onCanvasMoveEnd">;

export type LoopReactFlowNodeData = Record<string, unknown> & {
  layoutNode: LoopCanvasLayoutNode;
  context: LoopNodeContext;
  activeHandleIds: string[];
};

export type LoopReactFlowEdgeData = Record<string, unknown> & {
  loopEdge: LoopCanvasEdge;
  context?: LoopNodeContext;
  sourceNode?: LoopCanvasLayoutNode;
  targetNode?: LoopCanvasLayoutNode;
};

export type LoopReactFlowNode = Node<LoopReactFlowNodeData, "loop">;
export type LoopReactFlowEdge = Edge<LoopReactFlowEdgeData, "loopSmart">;
