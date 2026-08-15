import type { LoopCanvasEdge } from "./loopLayoutEdges";

export type NodeOutputSlotKind = "normal";

const nodeOutputSlotKind = (value: string): NodeOutputSlotKind | undefined => {
  if (value === "ok") return "normal";
  return value.includes("validation.ok") ? "normal" : undefined;
};

export function loopOutputSlotKindForValues(...values: Array<string | undefined>): NodeOutputSlotKind | undefined {
  for (const value of values) {
    if (!value) continue;
    const directKind = nodeOutputSlotKind(value);
    if (directKind) return directKind;
    const separatorIndex = value.lastIndexOf(".");
    const eventOutputId = separatorIndex >= 0 ? value.slice(separatorIndex + 1) : "";
    const eventKind = nodeOutputSlotKind(eventOutputId);
    if (eventKind) return eventKind;
  }
  return undefined;
}

export function loopEdgeOutputSlotKind(
  edge: Pick<LoopCanvasEdge, "label" | "route"> | undefined
): NodeOutputSlotKind | undefined {
  return loopOutputSlotKindForValues(edge?.route?.outputId, edge?.label);
}
