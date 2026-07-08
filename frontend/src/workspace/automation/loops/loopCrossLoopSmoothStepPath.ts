import { Position, getSmoothStepPath, type EdgeProps } from "@xyflow/react";
import type { LoopReactFlowEdge } from "./LoopCanvasTypes";

const loopCrossLoopSmoothStepRadius = 24;
const loopCrossLoopSmoothStepOffset = 64;
const loopCrossLoopSmoothStepPosition = 0.5;
const loopSmoothStepPathNumber = (value: number) => Number(value.toFixed(2));

export function loopCrossLoopSmoothStepPath({
  sourcePosition,
  targetPosition,
  sourceX,
  sourceY,
  targetX,
  targetY
}: EdgeProps<LoopReactFlowEdge>) {
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition: sourcePosition ?? Position.Right,
    targetPosition: targetPosition ?? Position.Left,
    borderRadius: loopCrossLoopSmoothStepRadius,
    offset: loopCrossLoopSmoothStepOffset,
    stepPosition: loopCrossLoopSmoothStepPosition
  });

  return {
    path,
    labelX: loopSmoothStepPathNumber(labelX),
    labelY: loopSmoothStepPathNumber(labelY)
  };
}
