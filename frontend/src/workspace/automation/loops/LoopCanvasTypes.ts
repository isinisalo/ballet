import type { PointerEvent, RefObject } from "react";
import type { Edge, Node } from "@xyflow/react";
import type { ProjectAction } from "@shared/api/workspace-contracts";
import type { LoopStepRecord } from "./loopGraph";
import type { LoopCanvasEdge, LoopCanvasLayout, LoopCanvasLayoutNode } from "./loopLayout";

export type LoopCanvasProps = {
  layout: LoopCanvasLayout;
  selectedLoopId: string;
  actionById: Map<string, ProjectAction>;
  draggedStepIndex: number | null;
  dragOverStepIndex: number | null;
  selectedActionStepIndexes: number[];
  canvasHeight: number | null;
  isCanvasPanning: boolean;
  loopCanvasRef: RefObject<HTMLDivElement>;
  canAddFirstAction: boolean;
  canAddActionForEvent: (action?: ProjectAction) => boolean;
  onStepPointerDown: (event: PointerEvent<HTMLDivElement>, loopId: string, index: number) => void;
  onStepPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  onStepPointerUp: (event: PointerEvent<HTMLDivElement>) => boolean;
  onStepPointerCancel: () => void;
  onCanvasMoveStart: () => void;
  onCanvasMoveEnd: () => void;
  onActionStepSelect: (records: LoopStepRecord[]) => void;
  onOutputHandlerSelect: (edge: LoopCanvasEdge) => void;
  onAddActionStep: (eventType?: string, sourceAction?: ProjectAction) => void;
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
