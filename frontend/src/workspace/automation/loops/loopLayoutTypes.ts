import type { LoopOutputTarget, LoopNodeRecord } from "./loopGraph";
import type { LoopCanvasEdge } from "./loopLayoutEdges";

export type LoopLayoutDirection = "horizontal" | "vertical";

export type LoopCanvasNodeKind =
  | "loop"
  | "work-loop-node"
  | "first-node-ghost";

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
  record?: LoopNodeRecord;
  records?: LoopNodeRecord[];
  loopSummary?: LoopCanvasLoopSummary;
  isEditingNode?: boolean;
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
  | { kind: "children"; output: LoopOutputTarget; childRecords: LoopNodeRecord[] }
  | { kind: "existing-handler"; output: LoopOutputTarget; hasBackwardHandler: boolean };

export type LoopLayoutMetrics = {
  horizontalRootNodeX: number;
  horizontalNodeColumnGap: number;
  horizontalRowNodeGap: number;
  verticalRootNodeY: number;
  verticalNodeRankGap: number;
  verticalColumnNodeGap: number;
};
