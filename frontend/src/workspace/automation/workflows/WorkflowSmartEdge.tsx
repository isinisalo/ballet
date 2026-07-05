import { EdgeLabelRenderer, type EdgeProps } from "@xyflow/react";
import { SmartStepEdge } from "@tisoap/react-flow-smart-edge";
import type { WorkflowReactFlowEdge } from "./WorkflowCanvasTypes";

const workflowEdgeLabelClassName = "pointer-events-none absolute z-20 inline-flex whitespace-nowrap bg-background/95 px-1.5 py-0.5 font-mono text-[0.58rem] leading-4";
const workflowEdgeLabelTargetOffset = 16;

export function WorkflowSmartEdge(props: EdgeProps<WorkflowReactFlowEdge>) {
  const { data, targetX, targetY } = props;
  const label = data?.workflowEdge.label;
  const smartStepEdgeProps = {
    ...props,
    data: data ?? {},
    type: props.type ?? "workflowSmart"
  };

  return (
    <>
      <SmartStepEdge {...smartStepEdgeProps} />
      {label ? (
        <EdgeLabelRenderer>
          <div
            aria-hidden="true"
            data-workflow-edge-label="true"
            data-workflow-edge-label-value={label}
            title={label}
            className={workflowEdgeLabelClassName}
            style={{
              position: "absolute",
              pointerEvents: "none",
              transform: `translate(-100%, -50%) translate(${targetX - workflowEdgeLabelTargetOffset}px, ${targetY}px)`
            }}
          >
            <span className="text-primary">{label}</span>
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}
