import { smartEdgePresets, type GetSmartEdgeOptions } from "@tisoap/react-flow-smart-edge";

const loopCrossRowEdgeEpsilon = 0.5;
const loopCrossRowSmartEdgeOptions = {
  ...smartEdgePresets.smoothstep,
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
  if (Math.abs(sourceY - targetY) <= loopCrossRowEdgeEpsilon) return smartEdgePresets.smoothstep;
  return loopCrossRowSmartEdgeOptions;
}
