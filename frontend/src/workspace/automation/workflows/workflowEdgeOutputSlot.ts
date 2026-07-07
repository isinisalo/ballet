import { actionOutputSlotKind, type ActionOutputSlotKind } from "@shared/policy-actions";
import type { WorkflowCanvasEdge } from "./workflowLayoutEdges";

export function workflowEdgeOutputSlotKind(
  edge: Pick<WorkflowCanvasEdge, "label" | "route"> | undefined
): ActionOutputSlotKind | undefined {
  return actionOutputSlotKind(edge?.route?.outputId ?? edge?.label ?? "");
}
