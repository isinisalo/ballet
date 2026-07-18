import type { LoopCanvasEdge } from "./loopLayoutEdges";

export type StepOutputSlotKind = "approval" | "rework";

const stepOutputSlotKind = (value: string): StepOutputSlotKind | undefined => {
  if (value === "ready" || value === "approved") return "approval";
  if (["rejected", "changes-requested", "needs_input", "blocked", "failed"].includes(value)) return "rework";
  return undefined;
};

export function loopOutputSlotKindForValues(...values: Array<string | undefined>): StepOutputSlotKind | undefined {
  for (const value of values) {
    if (!value) continue;
    const directKind = stepOutputSlotKind(value);
    if (directKind) return directKind;
    const separatorIndex = value.lastIndexOf(".");
    const eventOutputId = separatorIndex >= 0 ? value.slice(separatorIndex + 1) : "";
    const eventKind = stepOutputSlotKind(eventOutputId);
    if (eventKind) return eventKind;
  }
  return undefined;
}

export function loopEdgeOutputSlotKind(
  edge: Pick<LoopCanvasEdge, "label" | "route"> | undefined
): StepOutputSlotKind | undefined {
  return loopOutputSlotKindForValues(edge?.route?.outputId, edge?.label);
}
