import { buildLoopGraph, type LoopNodeRecord } from "./loopGraph";
import { calculateLoopCanvasLayout } from "./loopLayout";
import type { LoopCanvasLayout, LoopLayoutDirection } from "./loopLayoutTypes";

export function calculateDetailLoopCanvasLayout({
  records,
  editingNodeIndex = null,
  direction = "horizontal"
}: {
  records: LoopNodeRecord[];
  editingNodeIndex?: number | null;
  direction?: LoopLayoutDirection;
}): LoopCanvasLayout {
  return calculateLoopCanvasLayout({
    loopGraph: buildLoopGraph(records),
    editingNodeIndex,
    direction
  });
}
