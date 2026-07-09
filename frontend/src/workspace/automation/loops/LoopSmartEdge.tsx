import { BaseEdge, EdgeLabelRenderer, useNodes, type EdgeProps, type Node } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { getSmartEdge } from "@tisoap/react-flow-smart-edge";
import type { LoopReactFlowEdge } from "./LoopCanvasTypes";
import { loopEdgeOutputSlotKind } from "./loopEdgeOutputSlot";
import { loopCrossLoopSmoothStepPath } from "./loopCrossLoopSmoothStepPath";
import { loopRoutedEdgeLabelAnchor, type LoopEdgePoint } from "./loopEdgeLabelGeometry";
import type { LoopCanvasEdge } from "./loopLayoutEdges";
import type { LoopCanvasLayoutNode } from "./loopLayoutTypes";
import { loopSmartEdgeRoutingOptions, loopSmartSmoothStepDrawEdge } from "./loopSmartEdgeRouting";

const loopEdgeLabelCenterRatio = 0.5;
const loopEdgeLabelVerticalOffset = 4;
const loopEdgeEndLabelGap = 8;

export function LoopSmartEdge(props: EdgeProps<LoopReactFlowEdge>) {
  const nodes = useNodes();
  const loopEdge = props.data?.loopEdge;
  const outputSlotKind = loopEdgeOutputSlotKind(loopEdge);
  const edgePaths = loopEdgePaths(props, nodes, outputSlotKind);
  const displayLabel = loopEdgeDisplayLabel(loopEdge, props.data?.sourceNode);
  const labelPlacement = displayLabel ? loopEdgeLabelPlacement(props, edgePaths, displayLabel.kind) : undefined;

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
      {displayLabel && labelPlacement ? (
        <EdgeLabelRenderer>
          <div
            aria-hidden="true"
            data-loop-edge-display-label={displayLabel.value}
            data-loop-edge-label-kind={displayLabel.kind}
            title={displayLabel.value}
            className={cn(
              "pointer-events-none absolute z-10 whitespace-nowrap rounded-sm bg-background/95 px-1 font-mono text-[0.66rem] leading-4",
              displayLabel.kind === "action" ? "text-tertiary" : "text-muted-foreground"
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
  edge: LoopCanvasEdge | undefined,
  sourceNode: LoopCanvasLayoutNode | undefined
): { value: string; kind: "action" | "output" } | undefined {
  if (!edge) return undefined;
  if (edge.tone === "cross-loop") return undefined;
  const outputSlotKind = loopEdgeOutputSlotKind(edge);
  const sourceActionId = sourceNode?.record?.action?.id || sourceNode?.record?.actionId;
  const usesActionLabel = sourceNode?.kind === "action" &&
    edge.tone !== "return" &&
    outputSlotKind !== "rework";

  if (usesActionLabel && sourceActionId) return { value: sourceActionId, kind: "action" };
  if (edge.label) return { value: edge.label, kind: "output" };
  return undefined;
}

type LoopEdgePaths = ReturnType<typeof loopEdgePaths>;

function loopEdgeLabelPlacement(
  { sourceX, sourceY, targetX, targetY }: EdgeProps<LoopReactFlowEdge>,
  edgePaths: LoopEdgePaths,
  labelKind: "action" | "output"
) {
  if (labelKind === "action") {
    return {
      x: targetX - loopEdgeEndLabelGap,
      y: targetY,
      translate: "translate(-100%, -50%)"
    };
  }

  const directLabelPath = edgePaths.returnEdgePath ?? edgePaths.crossLoopEdgePath ?? edgePaths.approvalEdgePath;
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

function loopEdgePaths(
  props: EdgeProps<LoopReactFlowEdge>,
  nodes: Node[],
  outputSlotKind: string | undefined
) {
  const { data, sourceX, sourceY, targetX, targetY } = props;
  const crossLoopEdgePath = data?.loopEdge.tone === "cross-loop" ? loopCrossLoopSmoothStepPath(props) : undefined;
  const approvalEdgePath = outputSlotKind === "approval" && !crossLoopEdgePath
    ? loopApprovalEdgePath({ sourceX, sourceY, targetX, targetY })
    : undefined;
  const returnEdgePath = !approvalEdgePath && data?.loopEdge.tone === "return" ? loopReturnEdgePath(props) : undefined;
  const smartEdgePath = returnEdgePath || crossLoopEdgePath || approvalEdgePath ? undefined : loopSmartEdgePath(props, nodes);
  const path = returnEdgePath?.path ?? crossLoopEdgePath?.path ?? approvalEdgePath?.path ?? smartEdgePath?.path ?? `M ${sourceX},${sourceY} L ${targetX},${targetY}`;

  return {
    path,
    returnEdgePath,
    crossLoopEdgePath,
    approvalEdgePath,
    smartEdgePath
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
  const endLabelX = resolvedTargetX;
  const endLabelY = resolvedTargetY - loopEdgeLabelVerticalOffset;

  return {
    startLabelX,
    startLabelY,
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
