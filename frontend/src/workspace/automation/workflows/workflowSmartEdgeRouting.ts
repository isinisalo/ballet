import { smartEdgePresets, type GetSmartEdgeOptions } from "@tisoap/react-flow-smart-edge";

const workflowCrossRowEdgeEpsilon = 0.5;
const workflowCrossRowSmartEdgeOptions = {
  ...smartEdgePresets.step,
  gridRatio: 5,
  nodePadding: 6
} satisfies GetSmartEdgeOptions;

export function workflowSmartEdgeRoutingOptions({
  sourceY,
  targetY
}: {
  sourceY: number;
  targetY: number;
}): GetSmartEdgeOptions {
  if (Math.abs(sourceY - targetY) <= workflowCrossRowEdgeEpsilon) return smartEdgePresets.step;
  return workflowCrossRowSmartEdgeOptions;
}
