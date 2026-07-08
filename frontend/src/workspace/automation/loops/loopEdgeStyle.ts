import type { LoopReactFlowEdge } from "./LoopCanvasTypes";
import { loopEdgeOutputSlotKind } from "./loopEdgeOutputSlot";
import type { LoopCanvasEdge } from "./loopLayoutEdges";
import type { LoopCanvasLayoutNode } from "./loopLayoutTypes";

const loopSolidEdgeStroke = "color-mix(in srgb, var(--primary) 70%, transparent)";
const loopDashedEdgeStroke = "color-mix(in srgb, var(--muted-foreground) 35%, transparent)";
const loopReturnEdgeStroke = "color-mix(in srgb, var(--tertiary) 85%, transparent)";
const loopCrossLoopApprovalEdgeStroke = "color-mix(in srgb, var(--secondary) 72%, transparent)";
const loopApprovalOutputEdgeStroke = "color-mix(in srgb, var(--secondary) 58%, var(--muted-foreground))";
const loopReworkOutputEdgeStroke = "color-mix(in srgb, var(--destructive) 58%, var(--muted-foreground))";
const loopEdgeOpacity = 0.75;
const loopGhostTargetEdgeOpacity = 0.6;
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
    strokeWidth: 2,
    strokeDasharray: loopEdgeStrokeDasharray(edge),
    strokeLinecap: loopEdgeStrokeLinecap(edge),
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
  if (edge.tone === "return") return undefined;
  if (edge.tone === "cross-loop") return "1 5";
  return edge.dashed ? "6 5" : undefined;
}

function loopEdgeStrokeLinecap(edge: LoopCanvasEdge) {
  return edge.tone === "cross-loop" ? "round" : undefined;
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
  if (targetNode?.kind === "output-event" || targetNode?.kind === "first-policy-ghost") return true;
  return edge.targetNodeKey === "first-policy-ghost" ||
    edge.targetNodeKey.endsWith(":first-policy-ghost") ||
    edge.targetNodeKey.startsWith("output-event-") ||
    edge.targetNodeKey.includes(":output-event-");
}
