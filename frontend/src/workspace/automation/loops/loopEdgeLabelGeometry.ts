export type LoopEdgePoint = {
  x: number;
  y: number;
};

const loopHorizontalSegmentEpsilon = 4;
const loopMinimumLabelSegmentLength = 1;

export function loopRoutedEdgeLabelAnchor({
  source,
  points,
  target,
  fallback
}: {
  source: LoopEdgePoint;
  points: LoopEdgePoint[];
  target: LoopEdgePoint;
  fallback: LoopEdgePoint;
}) {
  const pathPoints = [source, ...points, target];
  let longestHorizontalSegment: { source: LoopEdgePoint; target: LoopEdgePoint; length: number } | undefined;

  for (let index = 1; index < pathPoints.length; index += 1) {
    const segmentSource = pathPoints[index - 1];
    const segmentTarget = pathPoints[index];
    if (!segmentSource || !segmentTarget) continue;
    if (Math.abs(segmentSource.y - segmentTarget.y) > loopHorizontalSegmentEpsilon) continue;
    const length = Math.abs(segmentTarget.x - segmentSource.x);
    if (length < loopMinimumLabelSegmentLength) continue;
    if (longestHorizontalSegment && longestHorizontalSegment.length >= length) continue;
    longestHorizontalSegment = { source: segmentSource, target: segmentTarget, length };
  }

  if (!longestHorizontalSegment) return fallback;
  return {
    x: (longestHorizontalSegment.source.x + longestHorizontalSegment.target.x) / 2,
    y: (longestHorizontalSegment.source.y + longestHorizontalSegment.target.y) / 2
  };
}
