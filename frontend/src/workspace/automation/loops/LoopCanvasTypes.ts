import type { PointerEvent, RefObject } from "react";
import type { Edge, Node } from "@xyflow/react";
import type { LoopVisualStep } from "./loopVisualProjection";
import type { LoopStepRecord } from "./loopGraph";
import type { LoopCanvasEdge, LoopCanvasLayout, LoopCanvasLayoutNode } from "./loopLayout";
import type { LoopTheme } from "@shared/api/workspace-contracts";

export type LoopCanvasProps = {
  layout: LoopCanvasLayout;
  theme: LoopTheme;
  selectedLoopId: string;
  stepByKey: Map<string, LoopVisualStep>;
  draggedStepIndex: number | null;
  dragOverStepIndex: number | null;
  selectedStepIndexes: number[];
  readOnly: boolean;
  staticPreview: boolean;
  canvasHeight: number | null;
  isCanvasPanning: boolean;
  loopCanvasRef: RefObject<HTMLDivElement>;
  canAddFirstStep: boolean;
  canAddStepForEvent: (step?: LoopVisualStep) => boolean;
  onStepPointerDown: (event: PointerEvent<HTMLDivElement>, loopId: string, index: number) => void;
  onStepPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  onStepPointerUp: (event: PointerEvent<HTMLDivElement>) => boolean;
  onStepPointerCancel: () => void;
  onCanvasMoveStart: () => void;
  onCanvasMoveEnd: () => void;
  onStepSelect: (records: LoopStepRecord[]) => void;
  onOutputHandlerSelect: (edge: LoopCanvasEdge) => void;
  onAddStep: (outputId?: string, sourceStep?: LoopVisualStep) => void;
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
