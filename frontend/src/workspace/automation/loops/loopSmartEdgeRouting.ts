import { smartEdgePresets, svgDrawSmoothStepLinePath, type GetSmartEdgeOptions } from "@tisoap/react-flow-smart-edge";

const loopCrossRowEdgeEpsilon = 0.5;
export const loopSmartSmoothStepRadius = 16;
export const loopSmartSmoothStepDrawEdge = svgDrawSmoothStepLinePath({ borderRadius: loopSmartSmoothStepRadius });
const loopSmartSmoothStepOptions = {
  ...smartEdgePresets.smoothstep,
  drawEdge: loopSmartSmoothStepDrawEdge
} satisfies GetSmartEdgeOptions;

const loopCrossRowSmartEdgeOptions = {
  ...loopSmartSmoothStepOptions,
  gridRatio: 5,
  nodePadding: 6
} satisfies GetSmartEdgeOptions;

export function loopSmartEdgeRoutingOptions({
  sourceY,
  targetY
}: {
  sourceY: number;
  targetY: number;
}): GetSmartEdgeOptions {
  if (Math.abs(sourceY - targetY) <= loopCrossRowEdgeEpsilon) return loopSmartSmoothStepOptions;
  return loopCrossRowSmartEdgeOptions;
}
