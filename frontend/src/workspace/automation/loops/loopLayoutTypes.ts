import type { LoopOutputTarget, LoopStepRecord } from "./loopGraph";
import type { LoopCanvasEdge } from "./loopLayoutEdges";

export type LoopLayoutDirection = "horizontal" | "vertical";

export type LoopCanvasNodeKind =
  | "loop"
  | "step"
  | "first-step-ghost";

export type LoopCanvasLoopSummary = {
  loopId: string;
};

export type LoopCanvasLayoutNode = {
  key: string;
  loopId?: string;
  kind: LoopCanvasNodeKind;
  x: number;
  y: number;
  width: number;
  height: number;
  direction: LoopLayoutDirection;
  record?: LoopStepRecord;
  records?: LoopStepRecord[];
  loopSummary?: LoopCanvasLoopSummary;
  isEditingStep?: boolean;
  outputHandleCount?: number;
};

export type LoopCanvasLayout = {
  nodes: LoopCanvasLayoutNode[];
  edges: LoopCanvasEdge[];
  direction: LoopLayoutDirection;
};

export type LoopCanvasLayoutNodeDraft = Omit<LoopCanvasLayoutNode, "x" | "y">;

export type LoopDagreEdge = {
  source: string;
  target: string;
  label?: string;
};

export type LoopActiveOutputTask =
  | { kind: "children"; output: LoopOutputTarget; childRecords: LoopStepRecord[] }
  | { kind: "existing-handler"; output: LoopOutputTarget; hasBackwardHandler: boolean };

export type LoopLayoutMetrics = {
  horizontalRootStepX: number;
  horizontalStepColumnGap: number;
  horizontalRowStep: number;
  verticalRootStepY: number;
  verticalStepRankGap: number;
  verticalColumnStep: number;
};
