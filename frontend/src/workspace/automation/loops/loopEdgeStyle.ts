import type { LoopReactFlowEdge } from "./LoopCanvasTypes";
import { loopEdgeOutputSlotKind } from "./loopEdgeOutputSlot";
import type { LoopCanvasEdge } from "./loopLayoutEdges";
import type { LoopCanvasLayoutNode } from "./loopLayoutTypes";
import { loopEdgeDasharray, type LoopEdgeLineStyle, type LoopTheme } from "./loopTheme";

const loopSolidEdgeStroke = "var(--loop-theme-edge-color)";
const loopGhostEdgeStroke = "color-mix(in srgb, var(--loop-theme-edge-color) 35%, transparent)";
const loopMutedThemeEdgeStroke = "color-mix(in srgb, var(--loop-theme-edge-color) 42%, var(--muted-foreground))";
const loopCrossLoopEdgeStroke = "var(--loop-theme-edge-color)";
const loopNormalOutputEdgeStroke = "var(--loop-theme-edge-color)";
const loopEdgeOpacity = 0.64;
const loopGhostTargetEdgeOpacity = 0.5;
const loopAnimatedEdgeOpacity = 1;

export function loopEdgeDomAttributes(edge: LoopCanvasEdge, theme: LoopTheme, isAnimated = false): LoopReactFlowEdge["domAttributes"] {
  const outputSlotKind = loopEdgeOutputSlotKind(edge);
  const style = loopEdgeLineStyle(edge, theme);
  return {
    "data-loop-connector": "true",
    "data-dashed": style === "dashed" ? "true" : "false",
    "data-loop-edge-style": style,
    "data-loop-edge-tone": edge.tone ?? "flow",
    "data-loop-edge-animated": isAnimated ? "true" : "false",
    ...(outputSlotKind ? { "data-loop-edge-output-slot-kind": outputSlotKind } : {}),
    ...(edge.label ? { "data-loop-edge-label-value": edge.label } : {})
  } as LoopReactFlowEdge["domAttributes"];
}

export function loopEdgeStyle(
  edge: LoopCanvasEdge,
  targetNode: LoopCanvasLayoutNode | undefined,
  isAnimated: boolean,
  theme: LoopTheme
): LoopReactFlowEdge["style"] {
  const lineStyle = loopEdgeLineStyle(edge, theme);
  return {
    stroke: loopEdgeStroke(edge, targetNode),
    strokeWidth: 1.5,
    strokeDasharray: loopEdgeDasharray(lineStyle),
    strokeLinecap: lineStyle === "dotted" ? "round" : undefined,
    filter: isAnimated ? undefined : "drop-shadow(0 0 2px color-mix(in srgb, var(--loop-theme-edge-color) 38%, transparent))",
    opacity: loopEdgeRenderedOpacity(edge, targetNode, isAnimated)
  };
}

function loopEdgeStroke(edge: LoopCanvasEdge, targetNode: LoopCanvasLayoutNode | undefined) {
  if (loopEdgeTargetsGhostNode(edge, targetNode)) return loopGhostEdgeStroke;
  const outputSlotKind = loopEdgeOutputSlotKind(edge);
  if (outputSlotKind === "normal") return loopNormalOutputEdgeStroke;
  if (edge.tone === "return") return loopMutedThemeEdgeStroke;
  if (edge.tone === "cross-loop") return loopCrossLoopEdgeStroke;
  return loopSolidEdgeStroke;
}

export function loopEdgeLineStyle(edge: LoopCanvasEdge, theme: LoopTheme): LoopEdgeLineStyle {
  if (edge.tone === "cross-loop") return theme.edge.crossLoopStyle;
  if (edge.tone === "return") return theme.edge.repairStyle;
  return theme.edge.style;
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
  if (targetNode?.kind === "first-node-ghost") return true;
  return edge.targetNodeKey === "first-node-ghost" ||
    edge.targetNodeKey.endsWith(":first-node-ghost");
}
