import { actionOutputSlotKind, type ActionOutputSlotKind } from "@shared/policy-actions";
import type { WorkflowCanvasEdge } from "./workflowLayoutEdges";

export function workflowCrossWorkflowEdgeSlotKind(
  edge: Pick<WorkflowCanvasEdge, "label" | "route" | "tone"> | undefined
): ActionOutputSlotKind | undefined {
  if (edge?.tone !== "cross-workflow") return undefined;
  return actionOutputSlotKind(edge.route?.outputId ?? edge.label ?? "");
}
