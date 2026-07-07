import type { WorkflowOutputTarget, WorkflowStepRecord } from "./workflowGraph";
import type { WorkflowCanvasEdge } from "./workflowLayoutEdges";

export type WorkflowLayoutDirection = "horizontal" | "vertical";

export type WorkflowCanvasNodeKind =
  | "trigger"
  | "policy"
  | "output-event"
  | "first-policy-ghost";

export type WorkflowCanvasOutputEvent = {
  outputId: string;
  eventType: string;
  outputType: WorkflowOutputTarget["type"];
  trigger?: string;
  workflowId?: string;
};

export type WorkflowCanvasLayoutNode = {
  key: string;
  workflowId?: string;
  kind: WorkflowCanvasNodeKind;
  x: number;
  y: number;
  width: number;
  height: number;
  direction: WorkflowLayoutDirection;
  record?: WorkflowStepRecord;
  records?: WorkflowStepRecord[];
  triggerPolicy?: WorkflowStepRecord["policy"];
  eventType?: string;
  outputEvent?: WorkflowCanvasOutputEvent;
  sourcePolicyId?: string;
  isEditingPolicy?: boolean;
  outputIndex?: number;
  outputHandleCount?: number;
};

export type WorkflowCanvasLayout = {
  nodes: WorkflowCanvasLayoutNode[];
  edges: WorkflowCanvasEdge[];
  direction: WorkflowLayoutDirection;
};

export type WorkflowCanvasLayoutNodeDraft = Omit<WorkflowCanvasLayoutNode, "x" | "y">;

export type WorkflowDagreEdge = {
  source: string;
  target: string;
  label?: string;
};

export type WorkflowActiveOutputTask =
  | { kind: "children"; output: WorkflowOutputTarget; childRecords: WorkflowStepRecord[] }
  | { kind: "existing-handler"; output: WorkflowOutputTarget; hasBackwardHandler: boolean };

export type WorkflowLayoutMetrics = {
  horizontalRootPolicyX: number;
  horizontalPolicyColumnStep: number;
  horizontalRowStep: number;
  verticalRootPolicyY: number;
  verticalPolicyRankStep: number;
  verticalColumnStep: number;
};
