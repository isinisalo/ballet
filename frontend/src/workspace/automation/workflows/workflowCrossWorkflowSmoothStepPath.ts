import { Position, getSmoothStepPath, type EdgeProps } from "@xyflow/react";
import type { WorkflowReactFlowEdge } from "./WorkflowCanvasTypes";

const workflowCrossWorkflowSmoothStepRadius = 24;
const workflowCrossWorkflowSmoothStepOffset = 64;
const workflowCrossWorkflowSmoothStepPosition = 0.5;
const workflowSmoothStepPathNumber = (value: number) => Number(value.toFixed(2));

export function workflowCrossWorkflowSmoothStepPath({
  sourcePosition,
  targetPosition,
  sourceX,
  sourceY,
  targetX,
  targetY
}: EdgeProps<WorkflowReactFlowEdge>) {
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition: sourcePosition ?? Position.Right,
    targetPosition: targetPosition ?? Position.Left,
    borderRadius: workflowCrossWorkflowSmoothStepRadius,
    offset: workflowCrossWorkflowSmoothStepOffset,
    stepPosition: workflowCrossWorkflowSmoothStepPosition
  });

  return {
    path,
    labelX: workflowSmoothStepPathNumber(labelX),
    labelY: workflowSmoothStepPathNumber(labelY)
  };
}
