import type { LoopReactFlowEdge } from "./LoopCanvasTypes";
import { loopEdgeOutputSlotKind } from "./loopEdgeOutputSlot";
import type { LoopCanvasEdge } from "./loopLayoutEdges";
import type { LoopCanvasLayoutNode } from "./loopLayoutTypes";

const loopSolidEdgeStroke = "var(--loop-flow)";
const loopDashedEdgeStroke = "color-mix(in srgb, var(--muted-foreground) 35%, transparent)";
const loopReturnEdgeStroke = "color-mix(in srgb, var(--muted-foreground) 48%, transparent)";
const loopCrossLoopApprovalEdgeStroke = "var(--loop-flow)";
const loopApprovalOutputEdgeStroke = "var(--loop-flow)";
const loopReworkOutputEdgeStroke = "color-mix(in srgb, var(--muted-foreground) 48%, transparent)";
const loopEdgeOpacity = 0.64;
const loopGhostTargetEdgeOpacity = 0.5;
const loopAnimatedEdgeOpacity = 1;

export function loopEdgeDomAttributes(edge: LoopCanvasEdge, isAnimated = false): LoopReactFlowEdge["domAttributes"] {
  const outputSlotKind = loopEdgeOutputSlotKind(edge);
  return {
    "data-loop-connector": "true",
    "data-dashed": loopEdgeStrokeDasharray(edge) === "6 5" ? "true" : "false",
    "data-loop-edge-tone": edge.tone ?? "flow",
    "data-loop-edge-animated": isAnimated ? "true" : "false",
    ...(outputSlotKind ? { "data-loop-edge-output-slot-kind": outputSlotKind } : {}),
    ...(edge.label ? { "data-loop-edge-label-value": edge.label } : {})
  } as LoopReactFlowEdge["domAttributes"];
}

export function loopEdgeStyle(
  edge: LoopCanvasEdge,
  targetNode: LoopCanvasLayoutNode | undefined,
  isAnimated: boolean
): LoopReactFlowEdge["style"] {
  return {
    stroke: loopEdgeStroke(edge, targetNode),
    strokeWidth: 1.5,
    strokeDasharray: loopEdgeStrokeDasharray(edge),
    strokeLinecap: loopEdgeStrokeLinecap(edge),
    filter: isAnimated || loopEdgeIsRejectedOutput(edge) ? undefined : "drop-shadow(0 0 2px color-mix(in srgb, var(--loop-flow) 38%, transparent))",
    opacity: loopEdgeRenderedOpacity(edge, targetNode, isAnimated)
  };
}

function loopEdgeStroke(edge: LoopCanvasEdge, targetNode: LoopCanvasLayoutNode | undefined) {
  if (loopEdgeTargetsGhostNode(edge, targetNode)) return loopDashedEdgeStroke;
  const outputSlotKind = loopEdgeOutputSlotKind(edge);
  if (outputSlotKind === "approval") return loopApprovalOutputEdgeStroke;
  if (outputSlotKind === "rework") return loopReworkOutputEdgeStroke;
  if (edge.tone === "return") return loopReturnEdgeStroke;
  if (edge.tone === "cross-loop") return loopCrossLoopApprovalEdgeStroke;
  return edge.dashed ? loopDashedEdgeStroke : loopSolidEdgeStroke;
}

function loopEdgeStrokeDasharray(edge: LoopCanvasEdge) {
  if (loopEdgeIsRejectedOutput(edge)) return "6 5";
  if (edge.tone === "return") return undefined;
  if (loopEdgeTouchesLoopSummary(edge)) return undefined;
  if (edge.tone === "cross-loop") return "1 5";
  return edge.dashed ? "6 5" : undefined;
}

function loopEdgeStrokeLinecap(edge: LoopCanvasEdge) {
  if (loopEdgeIsRejectedOutput(edge)) return undefined;
  if (loopEdgeTouchesLoopSummary(edge)) return undefined;
  return edge.tone === "cross-loop" ? "round" : undefined;
}

function loopEdgeTouchesLoopSummary(edge: LoopCanvasEdge) {
  return edge.sourceNodeKey.endsWith(":loop") || edge.targetNodeKey.endsWith(":loop");
}

function loopEdgeIsRejectedOutput(edge: LoopCanvasEdge) {
  return [edge.route?.outputId, edge.label, edge.eventType]
    .some((value) => value === "rejected" || value?.endsWith(".rejected"));
}

function loopEdgeRenderedOpacity(
  edge: LoopCanvasEdge,
  targetNode: LoopCanvasLayoutNode | undefined,
  isAnimated: boolean
) {
  if (isAnimated) return loopAnimatedEdgeOpacity;
  return loopEdgeTargetsGhostNode(edge, targetNode) ? loopGhostTargetEdgeOpacity : loopEdgeOpacity;
}

function loopEdgeTargetsGhostNode(
  edge: LoopCanvasEdge,
  targetNode: LoopCanvasLayoutNode | undefined
) {
  if (targetNode?.kind === "output-event" || targetNode?.kind === "first-step-ghost") return true;
  return edge.targetNodeKey === "first-step-ghost" ||
    edge.targetNodeKey.endsWith(":first-step-ghost") ||
    edge.targetNodeKey.startsWith("output-event-") ||
    edge.targetNodeKey.includes(":output-event-");
}
