import type { PointerEvent, RefObject } from "react";
import type { Edge, Node } from "@xyflow/react";
import type { ProjectAction, ProjectPolicy } from "@shared/api/workspace-contracts";
import type { LoopStepRecord } from "./loopGraph";
import type { LoopCanvasEdge, LoopCanvasLayout, LoopCanvasLayoutNode } from "./loopLayout";

export type LoopCanvasOption = { value: string; label: string; description?: string };

export type LoopCanvasProps = {
  layout: LoopCanvasLayout;
  selectedLoopId: string;
  policyById: Map<string, ProjectPolicy>;
  actionById: Map<string, ProjectAction>;
  firstPolicy?: ProjectPolicy;
  noSelectionValue: string;
  policyOptions: LoopCanvasOption[];
  actionOptions: LoopCanvasOption[];
  draggedStepIndex: number | null;
  dragOverStepIndex: number | null;
  selectedActionStepIndexes: number[];
  canvasHeight: number | null;
  isCanvasPanning: boolean;
  loopCanvasRef: RefObject<HTMLDivElement>;
  canAddFirstPolicy: boolean;
  canAddPolicyForEvent: (policy?: ProjectPolicy) => boolean;
  onStepPointerDown: (event: PointerEvent<HTMLDivElement>, loopId: string, index: number) => void;
  onStepPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  onStepPointerUp: (event: PointerEvent<HTMLDivElement>) => boolean;
  onStepPointerCancel: () => void;
  onCanvasMoveStart: () => void;
  onCanvasMoveEnd: () => void;
  onPolicyChange: (loopId: string, index: number, policyId: string) => void;
  onActionStepSelect: (records: LoopStepRecord[]) => void;
  onOutputHandlerSelect: (edge: LoopCanvasEdge) => void;
  onAddPolicyStep: (eventType?: string, sourcePolicy?: ProjectPolicy) => void;
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
