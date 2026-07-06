import type { PointerEvent, RefObject } from "react";
import type { Edge, Node } from "@xyflow/react";
import type { ProjectPolicy } from "../../../../../shared/api/workspace-contracts";
import type { WorkflowStepRecord } from "./workflowGraph";
import type { WorkflowCanvasEdge, WorkflowCanvasLayout, WorkflowCanvasLayoutNode } from "./workflowLayout";

export type WorkflowCanvasOption = { value: string; label: string; description?: string };

export type WorkflowCanvasProps = {
  layout: WorkflowCanvasLayout;
  policyById: Map<string, ProjectPolicy>;
  firstPolicy?: ProjectPolicy;
  noSelectionValue: string;
  policyOptions: WorkflowCanvasOption[];
  actionOptions: WorkflowCanvasOption[];
  draggedStepIndex: number | null;
  dragOverStepIndex: number | null;
  selectedActionStepIndex: number | null;
  canvasHeight: number | null;
  isCanvasPanning: boolean;
  workflowCanvasRef: RefObject<HTMLDivElement>;
  canAddFirstPolicy: boolean;
  canAddPolicyForEvent: (policy?: ProjectPolicy) => boolean;
  onStepPointerDown: (event: PointerEvent<HTMLDivElement>, index: number) => void;
  onStepPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  onStepPointerUp: (event: PointerEvent<HTMLDivElement>) => boolean;
  onStepPointerCancel: () => void;
  onCanvasMoveStart: () => void;
  onCanvasMoveEnd: () => void;
  onActionSelectionClear: () => void;
  onPolicyChange: (index: number, policyId: string) => void;
  onActionStepSelect: (record: WorkflowStepRecord) => void;
  onAddPolicyStep: (eventType?: string, sourcePolicy?: ProjectPolicy) => void;
};

export type WorkflowNodeContext = Omit<WorkflowCanvasProps, "layout" | "canvasHeight" | "isCanvasPanning" | "workflowCanvasRef" | "onCanvasMoveStart" | "onCanvasMoveEnd" | "onActionSelectionClear">;

export type WorkflowReactFlowNodeData = Record<string, unknown> & {
  layoutNode: WorkflowCanvasLayoutNode;
  context: WorkflowNodeContext;
};

export type WorkflowReactFlowEdgeData = Record<string, unknown> & {
  workflowEdge: WorkflowCanvasEdge;
  context?: WorkflowNodeContext;
};

export type WorkflowReactFlowNode = Node<WorkflowReactFlowNodeData, "workflow">;
export type WorkflowReactFlowEdge = Edge<WorkflowReactFlowEdgeData, "workflowSmart">;
