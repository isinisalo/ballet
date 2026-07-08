import { actionOutputSlotKind, type ActionOutputSlotKind } from "@shared/policy-actions";
import type { LoopCanvasEdge } from "./loopLayoutEdges";

export function loopOutputSlotKindForValues(...values: Array<string | undefined>): ActionOutputSlotKind | undefined {
  for (const value of values) {
    if (!value) continue;
    const directKind = actionOutputSlotKind(value);
    if (directKind) return directKind;
    const separatorIndex = value.lastIndexOf(".");
    const eventOutputId = separatorIndex >= 0 ? value.slice(separatorIndex + 1) : "";
    const eventKind = actionOutputSlotKind(eventOutputId);
    if (eventKind) return eventKind;
  }
  return undefined;
}

export function loopEdgeOutputSlotKind(
  edge: Pick<LoopCanvasEdge, "label" | "route"> | undefined
): ActionOutputSlotKind | undefined {
  return loopOutputSlotKindForValues(edge?.route?.outputId, edge?.label);
}
