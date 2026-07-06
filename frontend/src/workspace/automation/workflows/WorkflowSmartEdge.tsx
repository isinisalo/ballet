import { BaseEdge, EdgeLabelRenderer, type EdgeProps } from "@xyflow/react";
import { SmartStepEdge } from "@tisoap/react-flow-smart-edge";
import type { WorkflowReactFlowEdge } from "./WorkflowCanvasTypes";

const workflowEdgeLabelClassName = "pointer-events-none absolute z-20 inline-flex whitespace-nowrap bg-background/95 py-0.5 pl-1.5 pr-0.5 font-mono text-[0.58rem] leading-4";
const workflowEdgeLabelCenterRatio = 0.5;
const workflowEdgeLabelSourceOffset = 4;
const workflowEdgeLabelTargetOffset = 4;

export function WorkflowSmartEdge(props: EdgeProps<WorkflowReactFlowEdge>) {
  const { data, sourceX, sourceY, targetX, targetY } = props;
  const label = data?.workflowEdge.label;
  const isReturnEdge = data?.workflowEdge.tone === "return";
  const targetKind = data?.targetNode?.kind;
  const showEndLabel = targetKind === "policy";
  const returnEdgePath = isReturnEdge ? workflowReturnEdgePath(props) : undefined;
  const { startLabelTransform, labelTransform, endLabelTransform } = workflowEdgeLabelTransforms({
    isReturnEdge,
    returnEdgePath,
    sourceX,
    sourceY,
    targetX,
    targetY
  });
  const smartStepEdgeProps = {
    ...props,
    data: data ?? {},
    type: props.type ?? "workflowSmart"
  };

  return (
    <>
      {returnEdgePath ? (
        <BaseEdge
          id={props.id}
          path={returnEdgePath.path}
          style={props.style}
          markerStart={props.markerStart}
          markerEnd={props.markerEnd}
          interactionWidth={props.interactionWidth}
        />
      ) : (
        <SmartStepEdge {...smartStepEdgeProps} />
      )}
      <WorkflowEdgeLabels
        label={label}
        tone={data?.workflowEdge.tone ?? "flow"}
        startLabelTransform={startLabelTransform}
        labelTransform={labelTransform}
        endLabelTransform={endLabelTransform}
        targetKind={targetKind}
        showEndLabel={showEndLabel}
      />
    </>
  );
}

function workflowEdgeLabelTransforms({
  isReturnEdge,
  returnEdgePath,
  sourceX,
  sourceY,
  targetX,
  targetY
}: {
  isReturnEdge: boolean;
  returnEdgePath?: ReturnType<typeof workflowReturnEdgePath>;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
}) {
  const labelX = returnEdgePath?.labelX ?? (sourceX + targetX) / 2;
  const labelY = returnEdgePath?.labelY ?? (sourceY + targetY) / 2;
  const startLabelX = returnEdgePath?.startLabelX ?? sourceX + workflowEdgeLabelSourceOffset;
  const startLabelY = returnEdgePath?.startLabelY ?? sourceY;
  const endLabelX = returnEdgePath?.endLabelX ?? targetX;
  const endLabelY = returnEdgePath?.endLabelY ?? targetY;
  const flowLabelX = sourceX + (targetX - sourceX) * workflowEdgeLabelCenterRatio;

  return {
    startLabelTransform: `translate(0, -50%) translate(${startLabelX}px, ${startLabelY}px)`,
    labelTransform: isReturnEdge
      ? `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`
      : `translate(-50%, -50%) translate(${flowLabelX}px, ${targetY}px)`,
    endLabelTransform: isReturnEdge
      ? `translate(-50%, -50%) translate(${endLabelX}px, ${endLabelY}px)`
      : `translate(-100%, -50%) translate(${targetX - workflowEdgeLabelTargetOffset}px, ${targetY}px)`
  };
}

function WorkflowEdgeLabels({
  label,
  tone,
  startLabelTransform,
  labelTransform,
  endLabelTransform,
  targetKind,
  showEndLabel
}: {
  label?: string;
  tone: string;
  startLabelTransform: string;
  labelTransform: string;
  endLabelTransform: string;
  targetKind?: string;
  showEndLabel: boolean;
}) {
  if (!label) return null;

  return (
    <EdgeLabelRenderer>
      <div
        aria-hidden="true"
        data-workflow-edge-start-label="true"
        data-workflow-edge-label-tone={tone}
        data-workflow-edge-label-value={label}
        data-workflow-edge-target-kind={targetKind}
        title="on"
        className={workflowEdgeLabelClassName}
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
        className={workflowEdgeLabelClassName}
        style={{
          position: "absolute",
          pointerEvents: "none",
          transform: labelTransform
        }}
      >
        <span className="text-primary">{label}</span>
      </div>
      {showEndLabel ? (
        <div
          aria-hidden="true"
          data-workflow-edge-end-label="true"
          data-workflow-edge-label-tone={tone}
          data-workflow-edge-label-value={label}
          data-workflow-edge-target-kind={targetKind}
          title="then"
          className={workflowEdgeLabelClassName}
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
  const resolvedSourceX = sourceNode ? sourceNode.x + sourceNode.width : sourceX;
  const resolvedSourceY = sourceNode ? sourceNode.y + sourceNode.height / 2 : sourceY;
  const resolvedTargetX = targetNode ? targetNode.x + targetNode.width / 2 : targetX;
  const resolvedTargetY = targetNode
    ? targetHandleId === "bottom" ? targetNode.y + targetNode.height : targetNode.y
    : targetY;
  const sourcePad = 28;
  const targetPad = 28;
  const sourceExitX = resolvedSourceX + sourcePad;
  const targetEntryY = targetHandleId === "bottom" ? resolvedTargetY + targetPad : resolvedTargetY - targetPad;
  const labelX = Math.min(sourceExitX, resolvedTargetX) + Math.abs(resolvedTargetX - sourceExitX) / 2;
  const labelY = targetEntryY;
  const startLabelX = resolvedSourceX + workflowEdgeLabelSourceOffset;
  const startLabelY = resolvedSourceY;
  const endLabelX = resolvedTargetX;
  const endLabelY = targetEntryY;

  return {
    startLabelX,
    startLabelY,
    endLabelX,
    endLabelY,
    labelX,
    labelY,
    path: [
      `M ${resolvedSourceX},${resolvedSourceY}`,
      `L ${sourceExitX},${resolvedSourceY}`,
      `L ${sourceExitX},${targetEntryY}`,
      `L ${resolvedTargetX},${targetEntryY}`,
      `L ${resolvedTargetX},${resolvedTargetY}`
    ].join(" ")
  };
}
