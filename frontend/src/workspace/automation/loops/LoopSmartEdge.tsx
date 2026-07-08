import { BaseEdge, EdgeLabelRenderer, useNodes, type EdgeProps, type Node } from "@xyflow/react";
import { getSmartEdge } from "@tisoap/react-flow-smart-edge";
import { cn } from "@/lib/utils";
import type { LoopReactFlowEdge } from "./LoopCanvasTypes";
import { loopEdgeOutputSlotKind } from "./loopEdgeOutputSlot";
import { loopCrossLoopSmoothStepPath } from "./loopCrossLoopSmoothStepPath";
import { loopRoutedEdgeLabelAnchor, type LoopEdgePoint } from "./loopEdgeLabelGeometry";
import { loopSmartEdgeRoutingOptions } from "./loopSmartEdgeRouting";

const loopEdgeLabelClassName = "absolute z-20 inline-flex whitespace-nowrap bg-background/95 py-0.5 pl-1.5 pr-0.5 font-mono text-[0.58rem] leading-4";
const loopEdgeLabelCenterRatio = 0.5;
const loopEdgeLabelVerticalOffset = 4;

export function LoopSmartEdge(props: EdgeProps<LoopReactFlowEdge>) {
  const { data, sourceX, sourceY, targetX, targetY } = props;
  const nodes = useNodes();
  const loopEdge = data?.loopEdge;
  const label = loopEdge?.label;
  const edgeTone = loopEdge?.tone ?? "flow";
  const outputSlotKind = loopEdgeOutputSlotKind(loopEdge);
  const isReturnEdge = loopEdge?.tone === "return";
  const targetKind = data?.targetNode?.kind;
  const edgePaths = loopEdgePaths(props, nodes, outputSlotKind);
  const labelTransform = loopEdgeLabelTransform({
    isReturnEdge,
    returnEdgePath: edgePaths.returnEdgePath,
    crossLoopEdgePath: edgePaths.crossLoopEdgePath,
    approvalEdgePath: edgePaths.approvalEdgePath,
    smartEdgePath: edgePaths.smartEdgePath,
    sourceX,
    sourceY,
    targetX,
    targetY
  });

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
      <LoopEdgeLabels
        label={label}
        tone={edgeTone}
        outputSlotKind={outputSlotKind}
        labelTransform={labelTransform}
        targetKind={targetKind}
      />
    </>
  );
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

export function loopEdgeLabelTransform({
  isReturnEdge,
  returnEdgePath,
  crossLoopEdgePath,
  approvalEdgePath,
  smartEdgePath,
  sourceX,
  sourceY,
  targetX,
  targetY
}: {
  isReturnEdge: boolean;
  returnEdgePath?: ReturnType<typeof loopReturnEdgePath>;
  crossLoopEdgePath?: ReturnType<typeof loopCrossLoopSmoothStepPath>;
  approvalEdgePath?: ReturnType<typeof loopApprovalEdgePath>;
  smartEdgePath?: ReturnType<typeof loopSmartEdgePath>;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
}) {
  if (isReturnEdge) {
    const labelX = returnEdgePath?.labelX ?? (sourceX + targetX) / 2;
    const labelY = returnEdgePath?.labelY ?? (sourceY + targetY) / 2;

    return `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`;
  }

  const { labelX: flowLabelX, labelY: flowLabelY } = loopFlowLabelCoordinates({
    crossLoopEdgePath,
    approvalEdgePath,
    smartEdgePath,
    sourceX,
    sourceY,
    targetX,
    targetY
  });

  return `translate(-50%, -50%) translate(${flowLabelX}px, ${flowLabelY}px)`;
}

function loopFlowLabelCoordinates({
  crossLoopEdgePath,
  approvalEdgePath,
  smartEdgePath,
  sourceX,
  sourceY,
  targetX,
  targetY
}: {
  crossLoopEdgePath?: ReturnType<typeof loopCrossLoopSmoothStepPath>;
  approvalEdgePath?: ReturnType<typeof loopApprovalEdgePath>;
  smartEdgePath?: ReturnType<typeof loopSmartEdgePath>;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
}) {
  if (crossLoopEdgePath) return { labelX: crossLoopEdgePath.labelX, labelY: crossLoopEdgePath.labelY };
  if (approvalEdgePath) return { labelX: approvalEdgePath.labelX, labelY: approvalEdgePath.labelY };
  if (!smartEdgePath) {
    return {
      labelX: sourceX + (targetX - sourceX) * loopEdgeLabelCenterRatio,
      labelY: (sourceY + targetY) / 2
    };
  }

  const anchor = loopRoutedEdgeLabelAnchor({
    source: { x: sourceX, y: sourceY },
    points: smartEdgePath.points,
    target: { x: targetX, y: targetY },
    fallback: smartEdgePath.fallbackLabelAnchor
  });
  return { labelX: anchor.x, labelY: anchor.y };
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

function LoopEdgeLabels({
  label,
  tone,
  outputSlotKind,
  labelTransform,
  targetKind
}: {
  label?: string;
  tone: string;
  outputSlotKind?: string;
  labelTransform: string;
  targetKind?: string;
}) {
  if (!label) return null;
  const isGhostTarget = targetKind === "output-event" || targetKind === "first-policy-ghost";
  const centerLabelClassName = cn(
    loopEdgeLabelClassName,
    "pointer-events-none"
  );
  const centerLabelToneClassName = isGhostTarget
    ? "text-primary/55"
    : outputSlotKind === "approval" ? "text-secondary" : outputSlotKind === "rework" ? "text-destructive" : "text-primary";
  const centerLabelContent = <span className={centerLabelToneClassName}>{label}</span>;

  return (
    <EdgeLabelRenderer>
      <div
        aria-hidden="true"
        data-loop-edge-label="true"
        data-loop-edge-label-tone={tone}
        data-loop-edge-label-value={label}
        data-loop-edge-target-kind={targetKind}
        title={label}
        className={centerLabelClassName}
        style={{
          position: "absolute",
          pointerEvents: "none",
          transform: labelTransform
        }}
      >
        {centerLabelContent}
      </div>
    </EdgeLabelRenderer>
  );
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
    path: [
      `M ${resolvedSourceX},${resolvedSourceY}`,
      `L ${resolvedSourceX},${sourceExitY}`,
      `L ${resolvedSourceX},${targetEntryY}`,
      `L ${resolvedTargetX},${targetEntryY}`,
      `L ${resolvedTargetX},${resolvedTargetY}`
    ].join(" ")
  };
}
