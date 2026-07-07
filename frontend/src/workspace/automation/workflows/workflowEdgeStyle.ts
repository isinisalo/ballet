import type { WorkflowReactFlowEdge } from "./WorkflowCanvasTypes";
import { workflowEdgeOutputSlotKind } from "./workflowEdgeOutputSlot";
import type { WorkflowCanvasEdge } from "./workflowLayoutEdges";
import type { WorkflowCanvasLayoutNode } from "./workflowLayoutTypes";

const workflowSolidEdgeStroke = "color-mix(in srgb, var(--primary) 70%, transparent)";
const workflowDashedEdgeStroke = "color-mix(in srgb, var(--muted-foreground) 35%, transparent)";
const workflowReturnEdgeStroke = "color-mix(in srgb, var(--tertiary) 85%, transparent)";
const workflowCrossWorkflowApprovalEdgeStroke = "color-mix(in srgb, var(--secondary) 72%, transparent)";
const workflowApprovalOutputEdgeStroke = "color-mix(in srgb, var(--secondary) 58%, var(--muted-foreground))";
const workflowReworkOutputEdgeStroke = "color-mix(in srgb, var(--destructive) 58%, var(--muted-foreground))";
const workflowEdgeOpacity = 0.75;
const workflowGhostTargetEdgeOpacity = 0.6;
const workflowAnimatedEdgeOpacity = 1;

export function workflowEdgeDomAttributes(edge: WorkflowCanvasEdge, isAnimated = false): WorkflowReactFlowEdge["domAttributes"] {
  const outputSlotKind = workflowEdgeOutputSlotKind(edge);
  return {
    "data-workflow-connector": "true",
    "data-dashed": workflowEdgeStrokeDasharray(edge) === "6 5" ? "true" : "false",
    "data-workflow-edge-tone": edge.tone ?? "flow",
    "data-workflow-edge-animated": isAnimated ? "true" : "false",
    ...(outputSlotKind ? { "data-workflow-edge-output-slot-kind": outputSlotKind } : {}),
    ...(edge.label ? { "data-workflow-edge-label-value": edge.label } : {})
  } as WorkflowReactFlowEdge["domAttributes"];
}

export function workflowEdgeStyle(
  edge: WorkflowCanvasEdge,
  targetNode: WorkflowCanvasLayoutNode | undefined,
  isAnimated: boolean
): WorkflowReactFlowEdge["style"] {
  return {
    stroke: workflowEdgeStroke(edge),
    strokeWidth: 2,
    strokeDasharray: workflowEdgeStrokeDasharray(edge),
    strokeLinecap: workflowEdgeStrokeLinecap(edge),
    opacity: workflowEdgeRenderedOpacity(edge, targetNode, isAnimated)
  };
}

function workflowEdgeStroke(edge: WorkflowCanvasEdge) {
  const outputSlotKind = workflowEdgeOutputSlotKind(edge);
  if (outputSlotKind === "approval") return workflowApprovalOutputEdgeStroke;
  if (outputSlotKind === "rework") return workflowReworkOutputEdgeStroke;
  if (edge.tone === "return") return workflowReturnEdgeStroke;
  if (edge.tone === "cross-workflow") return workflowCrossWorkflowApprovalEdgeStroke;
  return edge.dashed ? workflowDashedEdgeStroke : workflowSolidEdgeStroke;
}

function workflowEdgeStrokeDasharray(edge: WorkflowCanvasEdge) {
  if (edge.tone === "return") return undefined;
  if (edge.tone === "cross-workflow") return "1 5";
  return edge.dashed ? "6 5" : undefined;
}

function workflowEdgeStrokeLinecap(edge: WorkflowCanvasEdge) {
  return edge.tone === "cross-workflow" ? "round" : undefined;
}

function workflowEdgeRenderedOpacity(
  edge: WorkflowCanvasEdge,
  targetNode: WorkflowCanvasLayoutNode | undefined,
  isAnimated: boolean
) {
  if (isAnimated) return workflowAnimatedEdgeOpacity;
  return workflowEdgeTargetsGhostNode(edge, targetNode) ? workflowGhostTargetEdgeOpacity : workflowEdgeOpacity;
}

function workflowEdgeTargetsGhostNode(
  edge: WorkflowCanvasEdge,
  targetNode: WorkflowCanvasLayoutNode | undefined
) {
  if (targetNode?.kind === "output-event" || targetNode?.kind === "first-policy-ghost") return true;
  return edge.targetNodeKey === "first-policy-ghost" ||
    edge.targetNodeKey.endsWith(":first-policy-ghost") ||
    edge.targetNodeKey.startsWith("output-event-") ||
    edge.targetNodeKey.includes(":output-event-");
}
