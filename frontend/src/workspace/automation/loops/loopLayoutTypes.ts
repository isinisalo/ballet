import type { LoopOutputTarget, LoopStepRecord } from "./loopGraph";
import type { LoopCanvasEdge } from "./loopLayoutEdges";

export type LoopLayoutDirection = "horizontal" | "vertical";

export type LoopCanvasNodeKind =
  | "loop"
  | "trigger"
  | "policy"
  | "output-event"
  | "first-policy-ghost";

export type LoopCanvasOutputEvent = {
  outputId: string;
  eventType: string;
  outputType: LoopOutputTarget["type"];
  trigger?: string;
  loopId?: string;
};

export type LoopCanvasLoopSummary = {
  loopId: string;
  label: string;
  trigger?: string;
  action?: string;
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
  triggerPolicy?: LoopStepRecord["policy"];
  eventType?: string;
  outputEvent?: LoopCanvasOutputEvent;
  loopSummary?: LoopCanvasLoopSummary;
  sourcePolicyId?: string;
  isEditingPolicy?: boolean;
  outputIndex?: number;
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
  horizontalRootPolicyX: number;
  horizontalPolicyColumnStep: number;
  horizontalRowStep: number;
  verticalRootPolicyY: number;
  verticalPolicyRankStep: number;
  verticalColumnStep: number;
};
