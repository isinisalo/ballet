import { BaseEdge, EdgeLabelRenderer, type EdgeProps } from "@xyflow/react";
import { SmartStepEdge } from "@tisoap/react-flow-smart-edge";
import type { WorkflowReactFlowEdge } from "./WorkflowCanvasTypes";

const workflowEdgeLabelClassName = "pointer-events-none absolute z-20 inline-flex whitespace-nowrap bg-background/95 px-1.5 py-0.5 font-mono text-[0.58rem] leading-4";
const workflowEdgeLabelTargetOffset = 16;

export function WorkflowSmartEdge(props: EdgeProps<WorkflowReactFlowEdge>) {
  const { data, sourceX, sourceY, targetX, targetY } = props;
  const label = data?.workflowEdge.label;
  const isReturnEdge = data?.workflowEdge.tone === "return";
  const returnEdgePath = isReturnEdge ? workflowReturnEdgePath(props) : undefined;
  const labelTransform = isReturnEdge
    ? `translate(-50%, -50%) translate(${returnEdgePath?.labelX ?? (sourceX + targetX) / 2}px, ${returnEdgePath?.labelY ?? (sourceY + targetY) / 2}px)`
    : `translate(-100%, -50%) translate(${targetX - workflowEdgeLabelTargetOffset}px, ${targetY}px)`;
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
      {label ? (
        <EdgeLabelRenderer>
          <div
            aria-hidden="true"
            data-workflow-edge-label="true"
            data-workflow-edge-label-tone={data?.workflowEdge.tone ?? "flow"}
            data-workflow-edge-label-value={label}
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
        </EdgeLabelRenderer>
      ) : null}
    </>
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

  return {
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
