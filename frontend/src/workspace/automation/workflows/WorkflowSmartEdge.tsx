import { BaseEdge, EdgeLabelRenderer, useNodes, type EdgeProps, type Node } from "@xyflow/react";
import { getSmartEdge } from "@tisoap/react-flow-smart-edge";
import { cn } from "@/lib/utils";
import type { WorkflowReactFlowEdge } from "./WorkflowCanvasTypes";
import { workflowCrossWorkflowEdgeSlotKind } from "./workflowCrossWorkflowEdgeSlot";
import { workflowCrossWorkflowSmoothStepPath } from "./workflowCrossWorkflowSmoothStepPath";
import { workflowRoutedEdgeLabelAnchor, type WorkflowEdgePoint } from "./workflowEdgeLabelGeometry";
import { workflowSmartEdgeRoutingOptions } from "./workflowSmartEdgeRouting";

const workflowEdgeLabelClassName = "absolute z-20 inline-flex whitespace-nowrap bg-background/95 py-0.5 pl-1.5 pr-0.5 font-mono text-[0.58rem] leading-4";
const workflowEdgeLabelCenterRatio = 0.5;
const workflowEdgeLabelSourceOffset = 4;
const workflowEdgeLabelTargetOffset = 4;
const workflowEdgeLabelVerticalOffset = 4;

export function WorkflowSmartEdge(props: EdgeProps<WorkflowReactFlowEdge>) {
  const { data, sourceX, sourceY, targetX, targetY } = props;
  const nodes = useNodes();
  const workflowEdge = data?.workflowEdge;
  const label = workflowEdge?.label;
  const edgeTone = workflowEdge?.tone ?? "flow";
  const outputSlotKind = workflowCrossWorkflowEdgeSlotKind(workflowEdge);
  const isReturnEdge = workflowEdge?.tone === "return";
  const isCrossWorkflowEdge = workflowEdge?.tone === "cross-workflow";
  const targetKind = data?.targetNode?.kind;
  const showEndLabel = targetKind === "policy";
  const returnEdgePath = isReturnEdge ? workflowReturnEdgePath(props) : undefined;
  const crossWorkflowEdgePath = !returnEdgePath && isCrossWorkflowEdge ? workflowCrossWorkflowSmoothStepPath(props) : undefined;
  const smartEdgePath = returnEdgePath || crossWorkflowEdgePath ? undefined : workflowSmartEdgePath(props, nodes);
  const { startLabelTransform, labelTransform, endLabelTransform } = workflowEdgeLabelTransforms({
    isReturnEdge,
    returnEdgePath,
    crossWorkflowEdgePath,
    smartEdgePath,
    sourceX,
    sourceY,
    targetX,
    targetY
  });
  const edgePath = returnEdgePath?.path ?? crossWorkflowEdgePath?.path ?? smartEdgePath?.path ?? `M ${sourceX},${sourceY} L ${targetX},${targetY}`;

  return (
    <>
      <BaseEdge
        id={props.id}
        path={edgePath}
        style={props.style}
        markerStart={props.markerStart}
        markerEnd={props.markerEnd}
        interactionWidth={props.interactionWidth}
      />
      <WorkflowEdgeLabels
        label={label}
        tone={edgeTone}
        outputSlotKind={outputSlotKind}
        startLabelTransform={startLabelTransform}
        labelTransform={labelTransform}
        endLabelTransform={endLabelTransform}
        targetKind={targetKind}
        showEndLabel={showEndLabel}
      />
    </>
  );
}

export function workflowEdgeLabelTransforms({
  isReturnEdge,
  returnEdgePath,
  crossWorkflowEdgePath,
  smartEdgePath,
  sourceX,
  sourceY,
  targetX,
  targetY
}: {
  isReturnEdge: boolean;
  returnEdgePath?: ReturnType<typeof workflowReturnEdgePath>;
  crossWorkflowEdgePath?: ReturnType<typeof workflowCrossWorkflowSmoothStepPath>;
  smartEdgePath?: ReturnType<typeof workflowSmartEdgePath>;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
}) {
  const startLabelX = returnEdgePath?.startLabelX ?? sourceX + workflowEdgeLabelSourceOffset;
  const startLabelY = returnEdgePath?.startLabelY ?? sourceY;
  const endLabelX = returnEdgePath?.endLabelX ?? targetX;
  const endLabelY = returnEdgePath?.endLabelY ?? targetY;

  if (isReturnEdge) {
    const labelX = returnEdgePath?.labelX ?? (sourceX + targetX) / 2;
    const labelY = returnEdgePath?.labelY ?? (sourceY + targetY) / 2;

    return {
      startLabelTransform: `translate(-50%, -100%) translate(${startLabelX}px, ${startLabelY}px)`,
      labelTransform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
      endLabelTransform: `translate(-50%, -100%) translate(${endLabelX}px, ${endLabelY}px)`
    };
  }

  const { labelX: flowLabelX, labelY: flowLabelY } = workflowFlowLabelCoordinates({
    crossWorkflowEdgePath,
    smartEdgePath,
    sourceX,
    sourceY,
    targetX,
    targetY
  });

  return {
    startLabelTransform: `translate(0, -50%) translate(${startLabelX}px, ${startLabelY}px)`,
    labelTransform: `translate(-50%, -50%) translate(${flowLabelX}px, ${flowLabelY}px)`,
    endLabelTransform: `translate(-100%, -50%) translate(${targetX - workflowEdgeLabelTargetOffset}px, ${targetY}px)`
  };
}

function workflowFlowLabelCoordinates({
  crossWorkflowEdgePath,
  smartEdgePath,
  sourceX,
  sourceY,
  targetX,
  targetY
}: {
  crossWorkflowEdgePath?: ReturnType<typeof workflowCrossWorkflowSmoothStepPath>;
  smartEdgePath?: ReturnType<typeof workflowSmartEdgePath>;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
}) {
  if (crossWorkflowEdgePath) return { labelX: crossWorkflowEdgePath.labelX, labelY: crossWorkflowEdgePath.labelY };
  if (!smartEdgePath) {
    return {
      labelX: sourceX + (targetX - sourceX) * workflowEdgeLabelCenterRatio,
      labelY: (sourceY + targetY) / 2
    };
  }

  const anchor = workflowRoutedEdgeLabelAnchor({
    source: { x: sourceX, y: sourceY },
    points: smartEdgePath.points,
    target: { x: targetX, y: targetY },
    fallback: smartEdgePath.fallbackLabelAnchor
  });
  return { labelX: anchor.x, labelY: anchor.y };
}

function workflowSmartEdgePath(
  {
    sourcePosition,
    targetPosition,
    sourceX,
    sourceY,
    targetX,
    targetY
  }: EdgeProps<WorkflowReactFlowEdge>,
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
    options: workflowSmartEdgeRoutingOptions({ sourceY, targetY })
  });

  if (smartEdgeResponse instanceof Error) return undefined;
  return {
    path: smartEdgeResponse.svgPathString,
    points: smartEdgeResponse.points.map(([x, y]): WorkflowEdgePoint => ({ x: x ?? 0, y: y ?? 0 })),
    fallbackLabelAnchor: {
      x: smartEdgeResponse.edgeCenterX,
      y: smartEdgeResponse.edgeCenterY
    }
  };
}

function WorkflowEdgeLabels({
  label,
  tone,
  outputSlotKind,
  startLabelTransform,
  labelTransform,
  endLabelTransform,
  targetKind,
  showEndLabel
}: {
  label?: string;
  tone: string;
  outputSlotKind?: string;
  startLabelTransform: string;
  labelTransform: string;
  endLabelTransform: string;
  targetKind?: string;
  showEndLabel: boolean;
}) {
  if (!label) return null;
  const isGhostTarget = targetKind === "output-event" || targetKind === "first-policy-ghost";
  const centerLabelClassName = cn(
    workflowEdgeLabelClassName,
    "pointer-events-none"
  );
  const centerLabelToneClassName = tone === "cross-workflow"
    ? outputSlotKind === "rework" ? "text-destructive" : "text-secondary"
    : isGhostTarget ? "text-primary/55" : "text-primary";
  const centerLabelContent = <span className={centerLabelToneClassName}>{label}</span>;

  return (
    <EdgeLabelRenderer>
      <div
        aria-hidden="true"
        data-workflow-edge-start-label="true"
        data-workflow-edge-label-tone={tone}
        data-workflow-edge-label-value={label}
        data-workflow-edge-target-kind={targetKind}
        title="on"
        className={cn(workflowEdgeLabelClassName, "pointer-events-none")}
        style={{
          position: "absolute",
          pointerEvents: "none",
          transform: startLabelTransform
        }}
      >
        <span className="text-foreground">on</span>
      </div>
      <div
        aria-hidden="true"
        data-workflow-edge-label="true"
        data-workflow-edge-label-tone={tone}
        data-workflow-edge-label-value={label}
        data-workflow-edge-target-kind={targetKind}
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
      {showEndLabel ? (
        <div
          aria-hidden="true"
          data-workflow-edge-end-label="true"
          data-workflow-edge-label-tone={tone}
          data-workflow-edge-label-value={label}
          data-workflow-edge-target-kind={targetKind}
          title="then"
          className={cn(workflowEdgeLabelClassName, "pointer-events-none")}
          style={{
            position: "absolute",
            pointerEvents: "none",
            transform: endLabelTransform
          }}
        >
          <span className="text-foreground">then</span>
        </div>
      ) : null}
    </EdgeLabelRenderer>
  );
}

export function workflowReturnEdgePath({ data, sourceX, sourceY, targetX, targetY }: EdgeProps<WorkflowReactFlowEdge>) {
  const sourceNode = data?.sourceNode;
  const targetNode = data?.targetNode;
  const targetHandleId = data?.workflowEdge.targetHandleId;
  const resolvedSourceX = sourceNode ? sourceNode.x + sourceNode.width / 2 : sourceX;
  const resolvedSourceY = sourceNode ? sourceNode.y : sourceY;
  const resolvedTargetX = targetNode ? targetNode.x + targetNode.width / 2 : targetX;
  const resolvedTargetY = targetNode
    ? targetHandleId === "bottom" ? targetNode.y + targetNode.height : targetNode.y
    : targetY;
  const sourcePad = 28;
  const targetPad = 28;
  const sourceExitY = resolvedSourceY - sourcePad;
  const targetEntryY = targetHandleId === "bottom" ? resolvedTargetY + targetPad : resolvedTargetY - targetPad;
  const labelX = Math.min(resolvedSourceX, resolvedTargetX) + Math.abs(resolvedTargetX - resolvedSourceX) / 2;
  const labelY = targetEntryY;
  const startLabelX = resolvedSourceX;
  const startLabelY = resolvedSourceY - workflowEdgeLabelVerticalOffset;
  const endLabelX = resolvedTargetX;
  const endLabelY = resolvedTargetY - workflowEdgeLabelVerticalOffset;

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
