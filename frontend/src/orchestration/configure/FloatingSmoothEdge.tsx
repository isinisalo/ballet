import { BaseEdge, Position, getBezierPath, useInternalNode, type Edge, type EdgeProps, type InternalNode } from "@xyflow/react";

const POINT_RADIUS = 2.5;
const DETACHED_POINT_OFFSET = 8;

export function FloatingSmoothEdge({ id, source, target, markerEnd, style }: EdgeProps<Edge>) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  if (!sourceNode || !targetNode) return null;

  const sourceCircle = detachedPoint(sidePoint(sourceNode, "right"), "right");
  const targetCircle = detachedPoint(sidePoint(targetNode, "left"), "left");
  const [path] = getBezierPath({
    sourceX: sourceCircle.x,
    sourceY: sourceCircle.y,
    sourcePosition: Position.Right,
    targetX: targetCircle.x,
    targetY: targetCircle.y,
    targetPosition: Position.Left,
    curvature: 0.18,
  });

  return <>
    <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} />
    <circle className="loop-engineering-edge-point" cx={sourceCircle.x} cy={sourceCircle.y} r={POINT_RADIUS} />
    <circle className="loop-engineering-edge-point" cx={targetCircle.x} cy={targetCircle.y} r={POINT_RADIUS} />
  </>;
}

function sidePoint(node: InternalNode, side: "left" | "right") {
  const position = node.internals.positionAbsolute;
  const width = node.measured.width ?? node.width ?? 0;
  const height = node.measured.height ?? node.height ?? 0;
  return centeredSidePoint(position, width, height, side);
}

export function centeredSidePoint(position: { x: number; y: number }, width: number, height: number, side: "left" | "right") {
  return { x: side === "right" ? position.x + width : position.x, y: position.y + height / 2 };
}

export function detachedPoint(point: { x: number; y: number }, side: "left" | "right") {
  return { x: point.x + (side === "right" ? DETACHED_POINT_OFFSET : -DETACHED_POINT_OFFSET), y: point.y };
}
