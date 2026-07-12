import { Position, type EdgeProps } from "@xyflow/react";
import type { LoopReactFlowEdge } from "./LoopCanvasTypes";
import type { LoopConnectionPointStyle } from "./loopTheme";

export const loopEdgeEndpointGap = 8;
export const loopConnectionPointRadius = 2.5;

export function themedLoopEdgeProps<T extends EdgeProps<LoopReactFlowEdge>>(props: T, style: LoopConnectionPointStyle): T {
  const gap = style === "near" ? loopEdgeEndpointGap : 0;
  const source = endpointPoint(props.sourceX, props.sourceY, props.sourcePosition, gap);
  const target = endpointPoint(props.targetX, props.targetY, props.targetPosition, gap);
  return { ...props, sourceX: source.x, sourceY: source.y, targetX: target.x, targetY: target.y };
}

function endpointPoint(x: number, y: number, position: Position, gap: number) {
  if (position === Position.Left) return { x: x - gap, y };
  if (position === Position.Right) return { x: x + gap, y };
  if (position === Position.Top) return { x, y: y - gap };
  return { x, y: y + gap };
}
