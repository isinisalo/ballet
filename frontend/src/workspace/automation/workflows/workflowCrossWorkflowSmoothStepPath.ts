import { Position, getSmoothStepPath, type EdgeProps } from "@xyflow/react";
import type { WorkflowReactFlowEdge } from "./WorkflowCanvasTypes";

const workflowCrossWorkflowSmoothStepRadius = 24;
const workflowCrossWorkflowSmoothStepOffset = 64;
const workflowCrossWorkflowSmoothStepPosition = 0.5;
const workflowCrossWorkflowSmoothStepLabelOffset = 56;
const workflowSmoothStepPathNumber = (value: number) => Number(value.toFixed(2));

export function workflowCrossWorkflowSmoothStepPath({
  sourcePosition,
  targetPosition,
  sourceX,
  sourceY,
  targetX,
  targetY
}: EdgeProps<WorkflowReactFlowEdge>) {
  const [path] = getSmoothStepPath({
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
  const labelDirection = sourcePosition === Position.Left ? -1 : 1;

  return {
    path,
    labelX: workflowSmoothStepPathNumber(sourceX + labelDirection * workflowCrossWorkflowSmoothStepLabelOffset),
    labelY: workflowSmoothStepPathNumber(sourceY)
  };
}
