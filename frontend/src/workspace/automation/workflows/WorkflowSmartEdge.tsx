import { BaseEdge, EdgeLabelRenderer, useNodes, type EdgeProps, type Node } from "@xyflow/react";
import { getSmartEdge } from "@tisoap/react-flow-smart-edge";
import { cn } from "@/lib/utils";
import type { WorkflowReactFlowEdge } from "./WorkflowCanvasTypes";
import { workflowEdgeOutputSlotKind } from "./workflowEdgeOutputSlot";
import { workflowCrossWorkflowSmoothStepPath } from "./workflowCrossWorkflowSmoothStepPath";
import { workflowRoutedEdgeLabelAnchor, type WorkflowEdgePoint } from "./workflowEdgeLabelGeometry";
import { workflowSmartEdgeRoutingOptions } from "./workflowSmartEdgeRouting";

const workflowEdgeLabelClassName = "absolute z-20 inline-flex whitespace-nowrap bg-background/95 py-0.5 pl-1.5 pr-0.5 font-mono text-[0.58rem] leading-4";
const workflowEdgeLabelCenterRatio = 0.5;
const workflowEdgeLabelVerticalOffset = 4;

export function WorkflowSmartEdge(props: EdgeProps<WorkflowReactFlowEdge>) {
  const { data, sourceX, sourceY, targetX, targetY } = props;
  const nodes = useNodes();
  const workflowEdge = data?.workflowEdge;
  const label = workflowEdge?.label;
  const edgeTone = workflowEdge?.tone ?? "flow";
  const outputSlotKind = workflowEdgeOutputSlotKind(workflowEdge);
  const isReturnEdge = workflowEdge?.tone === "return";
  const targetKind = data?.targetNode?.kind;
  const edgePaths = workflowEdgePaths(props, nodes, outputSlotKind);
  const labelTransform = workflowEdgeLabelTransform({
    isReturnEdge,
    returnEdgePath: edgePaths.returnEdgePath,
    crossWorkflowEdgePath: edgePaths.crossWorkflowEdgePath,
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
      <WorkflowEdgeLabels
        label={label}
        tone={edgeTone}
        outputSlotKind={outputSlotKind}
        labelTransform={labelTransform}
        targetKind={targetKind}
      />
    </>
  );
}

function workflowEdgePaths(
  props: EdgeProps<WorkflowReactFlowEdge>,
  nodes: Node[],
  outputSlotKind: string | undefined
) {
  const { data, sourceX, sourceY, targetX, targetY } = props;
  const crossWorkflowEdgePath = data?.workflowEdge.tone === "cross-workflow" ? workflowCrossWorkflowSmoothStepPath(props) : undefined;
  const approvalEdgePath = outputSlotKind === "approval" && !crossWorkflowEdgePath
    ? workflowApprovalEdgePath({ sourceX, sourceY, targetX, targetY })
    : undefined;
  const returnEdgePath = !approvalEdgePath && data?.workflowEdge.tone === "return" ? workflowReturnEdgePath(props) : undefined;
  const smartEdgePath = returnEdgePath || crossWorkflowEdgePath || approvalEdgePath ? undefined : workflowSmartEdgePath(props, nodes);
  const path = returnEdgePath?.path ?? crossWorkflowEdgePath?.path ?? approvalEdgePath?.path ?? smartEdgePath?.path ?? `M ${sourceX},${sourceY} L ${targetX},${targetY}`;

  return {
    path,
    returnEdgePath,
    crossWorkflowEdgePath,
    approvalEdgePath,
    smartEdgePath
  };
}

export function workflowEdgeLabelTransform({
  isReturnEdge,
  returnEdgePath,
  crossWorkflowEdgePath,
  approvalEdgePath,
  smartEdgePath,
  sourceX,
  sourceY,
  targetX,
  targetY
}: {
  isReturnEdge: boolean;
  returnEdgePath?: ReturnType<typeof workflowReturnEdgePath>;
  crossWorkflowEdgePath?: ReturnType<typeof workflowCrossWorkflowSmoothStepPath>;
  approvalEdgePath?: ReturnType<typeof workflowApprovalEdgePath>;
  smartEdgePath?: ReturnType<typeof workflowSmartEdgePath>;
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

  const { labelX: flowLabelX, labelY: flowLabelY } = workflowFlowLabelCoordinates({
    crossWorkflowEdgePath,
    approvalEdgePath,
    smartEdgePath,
    sourceX,
    sourceY,
    targetX,
    targetY
  });

  return `translate(-50%, -50%) translate(${flowLabelX}px, ${flowLabelY}px)`;
}

function workflowFlowLabelCoordinates({
  crossWorkflowEdgePath,
  approvalEdgePath,
  smartEdgePath,
  sourceX,
  sourceY,
  targetX,
  targetY
}: {
  crossWorkflowEdgePath?: ReturnType<typeof workflowCrossWorkflowSmoothStepPath>;
  approvalEdgePath?: ReturnType<typeof workflowApprovalEdgePath>;
  smartEdgePath?: ReturnType<typeof workflowSmartEdgePath>;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
}) {
  if (crossWorkflowEdgePath) return { labelX: crossWorkflowEdgePath.labelX, labelY: crossWorkflowEdgePath.labelY };
  if (approvalEdgePath) return { labelX: approvalEdgePath.labelX, labelY: approvalEdgePath.labelY };
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

export function workflowApprovalEdgePath({
  sourceX,
  sourceY,
  targetX,
  targetY
}: Pick<EdgeProps<WorkflowReactFlowEdge>, "sourceX" | "sourceY" | "targetX" | "targetY">) {
  const labelX = sourceX + (targetX - sourceX) * workflowEdgeLabelCenterRatio;
  const labelY = sourceY + (targetY - sourceY) * workflowEdgeLabelCenterRatio;
  const path = sourceY === targetY
    ? `M ${sourceX},${sourceY} L ${targetX},${targetY}`
    : `M ${sourceX},${sourceY} L ${labelX},${sourceY} L ${labelX},${targetY} L ${targetX},${targetY}`;

  return {
    path,
    labelX,
    labelY
  };
}

function WorkflowEdgeLabels({
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
    workflowEdgeLabelClassName,
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
    </EdgeLabelRenderer>
  );
}

export function workflowReturnEdgePath({ data, sourceX, sourceY, targetX, targetY }: EdgeProps<WorkflowReactFlowEdge>) {
  const sourceNode = data?.sourceNode;
  const targetNode = data?.targetNode;
  const sourceHandleId = data?.workflowEdge.sourceHandleId;
  const targetHandleId = data?.workflowEdge.targetHandleId;
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
    ? resolvedSourceY + workflowEdgeLabelVerticalOffset + 20
    : resolvedSourceY - workflowEdgeLabelVerticalOffset;
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
