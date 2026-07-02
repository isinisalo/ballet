import { BaseEdge, type EdgeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { workflowConnectorPath } from "./workflowLayout";
import type { WorkflowReactFlowEdge } from "./WorkflowCanvasTypes";

export function WorkflowReactFlowEdgeComponent({ id, data }: EdgeProps<WorkflowReactFlowEdge>) {
  if (!data) return null;

  const edge = data.workflowEdge;
  const markerId = `workflow-arrow-${edge.dashed ? "muted-" : ""}${id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;

  return (
    <>
      <defs>
        <marker id={markerId} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
          <path d="M 0 0 L 8 4 L 0 8 z" className={edge.dashed ? "fill-muted-foreground/70" : "fill-primary/70"} />
        </marker>
      </defs>
      <BaseEdge
        id={id}
        data-workflow-connector
        data-dashed={edge.dashed ? "true" : "false"}
        path={workflowConnectorPath(edge)}
        className={cn("stroke-primary/70 stroke-2", edge.dashed && "stroke-muted-foreground/70")}
        interactionWidth={0}
        strokeDasharray={edge.dashed ? "6 5" : undefined}
        markerEnd={`url(#${markerId})`}
      />
    </>
  );
}
