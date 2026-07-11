import { Position, type EdgeProps } from "@xyflow/react";
import type { LoopReactFlowEdge } from "./LoopCanvasTypes";

export const loopEdgeEndpointGap = 8;
export const loopConnectionPointRadius = 2.5;

export function detachedLoopEdgeProps<T extends EdgeProps<LoopReactFlowEdge>>(props: T): T {
  const source = detachedPoint(props.sourceX, props.sourceY, props.sourcePosition);
  const target = detachedPoint(props.targetX, props.targetY, props.targetPosition);
  return { ...props, sourceX: source.x, sourceY: source.y, targetX: target.x, targetY: target.y };
}

function detachedPoint(x: number, y: number, position: Position) {
  if (position === Position.Left) return { x: x - loopEdgeEndpointGap, y };
  if (position === Position.Right) return { x: x + loopEdgeEndpointGap, y };
  if (position === Position.Top) return { x, y: y - loopEdgeEndpointGap };
  return { x, y: y + loopEdgeEndpointGap };
}
