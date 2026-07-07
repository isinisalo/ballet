export type WorkflowEdgePoint = {
  x: number;
  y: number;
};

const workflowHorizontalSegmentEpsilon = 4;
const workflowMinimumLabelSegmentLength = 1;

export function workflowRoutedEdgeLabelAnchor({
  source,
  points,
  target,
  fallback
}: {
  source: WorkflowEdgePoint;
  points: WorkflowEdgePoint[];
  target: WorkflowEdgePoint;
  fallback: WorkflowEdgePoint;
}) {
  const pathPoints = [source, ...points, target];
  let longestHorizontalSegment: { source: WorkflowEdgePoint; target: WorkflowEdgePoint; length: number } | undefined;

  for (let index = 1; index < pathPoints.length; index += 1) {
    const segmentSource = pathPoints[index - 1];
    const segmentTarget = pathPoints[index];
    if (!segmentSource || !segmentTarget) continue;
    if (Math.abs(segmentSource.y - segmentTarget.y) > workflowHorizontalSegmentEpsilon) continue;
    const length = Math.abs(segmentTarget.x - segmentSource.x);
    if (length < workflowMinimumLabelSegmentLength) continue;
    if (longestHorizontalSegment && longestHorizontalSegment.length >= length) continue;
    longestHorizontalSegment = { source: segmentSource, target: segmentTarget, length };
  }

  if (!longestHorizontalSegment) return fallback;
  return {
    x: (longestHorizontalSegment.source.x + longestHorizontalSegment.target.x) / 2,
    y: (longestHorizontalSegment.source.y + longestHorizontalSegment.target.y) / 2
  };
}
