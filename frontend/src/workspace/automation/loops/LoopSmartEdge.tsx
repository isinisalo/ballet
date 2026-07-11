import { cn } from "@/lib/utils";
import { getSmartEdge } from "@tisoap/react-flow-smart-edge";
import { BaseEdge, EdgeLabelRenderer, Position, useNodes, type EdgeProps, type Node } from "@xyflow/react";
import type { LoopReactFlowEdge } from "./LoopCanvasTypes";
import { loopCrossLoopSmoothStepPath } from "./loopCrossLoopSmoothStepPath";
import { loopRoutedEdgeLabelAnchor, type LoopEdgePoint } from "./loopEdgeLabelGeometry";
import { loopEdgeOutputSlotKind } from "./loopEdgeOutputSlot";
import { detachedLoopEdgeProps, loopConnectionPointRadius } from "./loopFloatingEdgeGeometry";
import type { LoopCanvasEdge } from "./loopLayoutEdges";
import { loopSmartEdgeRoutingOptions, loopSmartSmoothStepDrawEdge } from "./loopSmartEdgeRouting";

// This module intentionally keeps all selectable Loop edge path variants together;
// label placement and return/cross-loop geometry must use the exact same path choice.

const loopEdgeLabelCenterRatio = 0.5;
const loopEdgeLabelVerticalOffset = 4;
type LoopEdgeDisplayLabel =
  { value: string; kind: "output" };

export function LoopSmartEdge(props: EdgeProps<LoopReactFlowEdge>) {
  const nodes = useNodes();
  const detachedProps = detachedLoopEdgeProps(props);
  const loopEdge = props.data?.loopEdge;
  const outputSlotKind = loopEdgeOutputSlotKind(loopEdge);
  const edgePaths = loopEdgePaths(detachedProps, nodes, outputSlotKind);
  const displayLabel = loopEdgeDisplayLabel(loopEdge);
  const labelPlacement = displayLabel ? loopEdgeLabelPlacement(detachedProps, edgePaths, displayLabel) : undefined;

  return (
    <>
      <BaseEdge
        id={props.id}
        path={edgePaths.path}
        style={props.style}
        markerStart={props.markerStart}
        markerEnd={props.markerEnd}
        interactionWidth={props.interactionWidth}
      />
      <circle aria-hidden="true" data-loop-connection-point="source" cx={detachedProps.sourceX} cy={detachedProps.sourceY} r={loopConnectionPointRadius} className="loop-connection-point" />
      <circle aria-hidden="true" data-loop-connection-point="target" cx={detachedProps.targetX} cy={detachedProps.targetY} r={loopConnectionPointRadius} className="loop-connection-point" />
      {displayLabel && labelPlacement ? (
        <EdgeLabelRenderer>
          <div
            aria-hidden="true"
            data-loop-edge-display-label={displayLabel.value}
            data-loop-edge-label-kind={displayLabel.kind}
            title={displayLabel.value}
            className={cn(
              "pointer-events-none absolute z-10 whitespace-nowrap rounded-sm bg-background/95 px-1 font-mono text-[0.66rem] leading-4",
              "text-muted-foreground"
            )}
            style={{
              transform: `${labelPlacement.translate} translate(${labelPlacement.x}px, ${labelPlacement.y}px)`
            }}
          >
            {displayLabel.value}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

export function loopEdgeDisplayLabel(
  edge: LoopCanvasEdge | undefined
): LoopEdgeDisplayLabel | undefined {
  if (!edge) return undefined;
  if (edge.label && !["approved", "rejected"].includes(edge.label)) return { value: edge.label, kind: "output" };
  return undefined;
}

type LoopEdgePaths = ReturnType<typeof loopEdgePaths>;

export function loopEdgeLabelPlacement(
  { sourceX, sourceY, sourcePosition, targetX, targetY }: EdgeProps<LoopReactFlowEdge>,
  edgePaths: LoopEdgePaths,
  displayLabel: LoopEdgeDisplayLabel
) {
  if (displayLabel.value === "rejected") return loopRejectedEdgeLabelPlacement({ sourceX, sourceY, sourcePosition }, edgePaths.returnEdgePath);

  const directLabelPath = edgePaths.compactLoopEdgePath ?? edgePaths.returnEdgePath ?? edgePaths.crossLoopEdgePath ?? edgePaths.approvalEdgePath;
  if (directLabelPath) {
    return {
      x: directLabelPath.labelX,
      y: directLabelPath.labelY,
      translate: "translate(-50%, -50%)"
    };
  }
  if (!edgePaths.smartEdgePath) return undefined;
  const anchor = loopRoutedEdgeLabelAnchor({
    source: { x: sourceX, y: sourceY },
    points: edgePaths.smartEdgePath.points,
    target: { x: targetX, y: targetY },
    fallback: edgePaths.smartEdgePath.fallbackLabelAnchor
  });
  return {
    x: anchor.x,
    y: anchor.y,
    translate: "translate(-50%, -50%)"
  };
}

export function loopRejectedEdgeLabelPlacement(
  { sourceX, sourceY, sourcePosition }: Pick<EdgeProps<LoopReactFlowEdge>, "sourceX" | "sourceY" | "sourcePosition">,
  returnEdgePath?: ReturnType<typeof loopReturnEdgePath>
) {
  if (returnEdgePath) {
    return {
      x: returnEdgePath.startLabelX,
      y: returnEdgePath.startLabelY,
      translate: returnEdgePath.startLabelTranslate
    };
  }

  if (sourcePosition === Position.Bottom) return { x: sourceX, y: sourceY + loopEdgeLabelVerticalOffset, translate: "translate(-50%, 0)" };
  if (sourcePosition === Position.Top) return { x: sourceX, y: sourceY - loopEdgeLabelVerticalOffset, translate: "translate(-50%, -100%)" };
  if (sourcePosition === Position.Left) return { x: sourceX - loopEdgeLabelVerticalOffset, y: sourceY, translate: "translate(-100%, -50%)" };
  return { x: sourceX + loopEdgeLabelVerticalOffset, y: sourceY, translate: "translate(0, -50%)" };
}

function loopEdgePaths(
  props: EdgeProps<LoopReactFlowEdge>,
  nodes: Node[],
  outputSlotKind: string | undefined
) {
  const compactLoopEdgePath = compactLoopStraightPath(props);
  const crossLoopEdgePath = crossLoopPath(props, Boolean(compactLoopEdgePath));
  const approvalEdgePath = approvalPath(props, outputSlotKind, Boolean(compactLoopEdgePath || crossLoopEdgePath));
  const returnEdgePath = returnPath(props, Boolean(compactLoopEdgePath || approvalEdgePath));
  const directPaths = [compactLoopEdgePath, returnEdgePath, crossLoopEdgePath, approvalEdgePath];
  const smartEdgePath = directPaths.some(Boolean) ? undefined : loopSmartEdgePath(props, nodes);
  const path = [...directPaths, smartEdgePath].find((candidate) => candidate)?.path ?? straightEdgeFallback(props);

  return {
    path,
    compactLoopEdgePath,
    returnEdgePath,
    crossLoopEdgePath,
    approvalEdgePath,
    smartEdgePath
  };
}

function compactLoopStraightPath(props: EdgeProps<LoopReactFlowEdge>) {
  if (props.data?.sourceNode?.kind !== "loop" || props.data?.targetNode?.kind !== "loop") return undefined;
  return loopToLoopStraightEdgePath(props);
}

function crossLoopPath(props: EdgeProps<LoopReactFlowEdge>, blocked: boolean) {
  if (blocked || props.data?.loopEdge.tone !== "cross-loop") return undefined;
  return loopCrossLoopSmoothStepPath(props);
}

function approvalPath(props: EdgeProps<LoopReactFlowEdge>, outputSlotKind: string | undefined, blocked: boolean) {
  if (blocked || outputSlotKind !== "approval") return undefined;
  return loopApprovalEdgePath(props);
}

function returnPath(props: EdgeProps<LoopReactFlowEdge>, blocked: boolean) {
  if (blocked || props.data?.loopEdge.tone !== "return") return undefined;
  return loopReturnEdgePath(props);
}

function straightEdgeFallback({ sourceX, sourceY, targetX, targetY }: EdgeProps<LoopReactFlowEdge>) {
  return `M ${sourceX},${sourceY} L ${targetX},${targetY}`;
}

export function loopToLoopStraightEdgePath({
  sourceX,
  sourceY,
  targetX,
  targetY
}: Pick<EdgeProps<LoopReactFlowEdge>, "sourceX" | "sourceY" | "targetX" | "targetY">) {
  return {
    path: `M ${sourceX},${sourceY} L ${targetX},${targetY}`,
    labelX: sourceX + (targetX - sourceX) / 2,
    labelY: sourceY + (targetY - sourceY) / 2
  };
}

function loopSmartEdgePath(
  {
    sourcePosition,
    targetPosition,
    sourceX,
    sourceY,
    targetX,
    targetY
  }: EdgeProps<LoopReactFlowEdge>,
  nodes: Node[]
) {
  const smartEdgeResponse = getSmartEdge({
    sourcePosition,
    targetPosition,
    sourceX,
    sourceY,
    targetX,
    targetY,
    nodes,
    options: loopSmartEdgeRoutingOptions({ sourceY, targetY })
  });

  if (smartEdgeResponse instanceof Error) return undefined;
  return {
    path: smartEdgeResponse.svgPathString,
    points: smartEdgeResponse.points.map(([x, y]): LoopEdgePoint => ({ x: x ?? 0, y: y ?? 0 })),
    fallbackLabelAnchor: {
      x: smartEdgeResponse.edgeCenterX,
      y: smartEdgeResponse.edgeCenterY
    }
  };
}

export function loopApprovalEdgePath({
  sourceX,
  sourceY,
  targetX,
  targetY
}: Pick<EdgeProps<LoopReactFlowEdge>, "sourceX" | "sourceY" | "targetX" | "targetY">) {
  const labelX = sourceX + (targetX - sourceX) * loopEdgeLabelCenterRatio;
  const labelY = sourceY + (targetY - sourceY) * loopEdgeLabelCenterRatio;
  const path = sourceY === targetY
    ? `M ${sourceX},${sourceY} L ${targetX},${targetY}`
    : `M ${sourceX},${sourceY} L ${labelX},${sourceY} L ${labelX},${targetY} L ${targetX},${targetY}`;

  return {
    path,
    labelX,
    labelY
  };
}

export function loopReturnEdgePath({ data, sourceX, sourceY, targetX, targetY }: EdgeProps<LoopReactFlowEdge>) {
  const sourceNode = data?.sourceNode;
  const targetNode = data?.targetNode;
  const sourceHandleId = data?.loopEdge.sourceHandleId;
  const targetHandleId = data?.loopEdge.targetHandleId;
  const resolvedSourceX = sourceNode ? sourceNode.x + sourceNode.width / 2 : sourceX;
  const resolvedSourceY = sourceNode
    ? sourceHandleId === "bottom" ? sourceNode.y + sourceNode.height : sourceNode.y
    : sourceY;
  const resolvedTargetX = targetNode ? targetNode.x + targetNode.width / 2 : targetX;
  const resolvedTargetY = targetNode
    ? targetHandleId === "bottom" ? targetNode.y + targetNode.height : targetNode.y
    : targetY;
  const sourcePad = 28;
  const targetPad = 28;
  const sourceExitY = sourceHandleId === "bottom" ? resolvedSourceY + sourcePad : resolvedSourceY - sourcePad;
  const targetEntryY = targetHandleId === "bottom" ? resolvedTargetY + targetPad : resolvedTargetY - targetPad;
  const labelX = Math.min(resolvedSourceX, resolvedTargetX) + Math.abs(resolvedTargetX - resolvedSourceX) / 2;
  const labelY = targetEntryY;
  const startLabelX = resolvedSourceX;
  const startLabelY = sourceHandleId === "bottom"
    ? resolvedSourceY + loopEdgeLabelVerticalOffset + 20
    : resolvedSourceY - loopEdgeLabelVerticalOffset;
  const startLabelTranslate = sourceHandleId === "bottom"
    ? "translate(-50%, -50%)"
    : "translate(-50%, -100%)";
  const endLabelX = resolvedTargetX;
  const endLabelY = resolvedTargetY - loopEdgeLabelVerticalOffset;

  return {
    startLabelX,
    startLabelY,
    startLabelTranslate,
    endLabelX,
    endLabelY,
    labelX,
    labelY,
    path: loopSmartSmoothStepDrawEdge(
      { x: resolvedSourceX, y: resolvedSourceY },
      { x: resolvedTargetX, y: resolvedTargetY },
      [
        [resolvedSourceX, sourceExitY],
        [resolvedSourceX, targetEntryY],
        [resolvedTargetX, targetEntryY]
      ]
    )
  };
}
