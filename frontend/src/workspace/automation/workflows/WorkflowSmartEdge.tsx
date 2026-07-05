import { useMemo } from "react";
import { EdgeLabelRenderer, useNodes, type EdgeProps } from "@xyflow/react";
import { getSmartEdge, SmartStepEdge, smartEdgePresets } from "@tisoap/react-flow-smart-edge";
import type { WorkflowReactFlowEdge } from "./WorkflowCanvasTypes";

const workflowEdgeLabelClassName = "pointer-events-none absolute z-20 whitespace-nowrap bg-background/95 px-1.5 py-0.5 font-mono text-[0.58rem] leading-4 text-primary";

export function WorkflowSmartEdge(props: EdgeProps<WorkflowReactFlowEdge>) {
  const nodes = useNodes();
  const { data, sourcePosition, sourceX, sourceY, targetPosition, targetX, targetY } = props;
  const label = data?.workflowEdge.label;
  const smartStepEdgeProps = {
    ...props,
    data: data ?? {},
    type: props.type ?? "workflowSmart"
  };
  const labelPosition = useMemo(() => {
    const handleMidpoint = {
      x: (sourceX + targetX) / 2,
      y: (sourceY + targetY) / 2
    };
    if (data?.workflowEdge.tone !== "return" && Math.abs(sourceY - targetY) <= 24) return handleMidpoint;

    const smartEdge = getSmartEdge({
      sourcePosition,
      targetPosition,
      sourceX,
      sourceY,
      targetX,
      targetY,
      nodes,
      options: smartEdgePresets.step
    });

    const edgeCenter = smartEdge instanceof Error
      ? handleMidpoint
      : {
        x: smartEdge.edgeCenterX,
        y: smartEdge.edgeCenterY
      };
    return edgeCenter;
  }, [data?.workflowEdge.tone, nodes, sourcePosition, sourceX, sourceY, targetPosition, targetX, targetY]);

  return (
    <>
      <SmartStepEdge {...smartStepEdgeProps} />
      {label ? (
        <EdgeLabelRenderer>
          <div
            aria-hidden="true"
            data-workflow-edge-label="true"
            title={label}
            className={workflowEdgeLabelClassName}
            style={{
              position: "absolute",
              pointerEvents: "none",
              transform: `translate(-50%, -50%) translate(${labelPosition.x}px, ${labelPosition.y}px)`
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}
