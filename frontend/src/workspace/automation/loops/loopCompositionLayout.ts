import type { LoopCompositionProjection } from "./loopEngineerProjections";

export const loopCompositionNodeSize = { width: 216, height: 88 } as const;

export interface LoopCompositionLayoutNode {
  loopId: string;
  x: number;
  y: number;
}

const maxColumns = 3;
const horizontalGap = 72;
const verticalGap = 112;
const canvasInset = 48;

export function calculateLoopCompositionLayout(
  projection: LoopCompositionProjection
): LoopCompositionLayoutNode[] {
  const columns = Math.min(maxColumns, Math.max(1, projection.nodes.length));
  return projection.nodes.map((node, index) => {
    const row = Math.floor(index / columns);
    const indexInRow = index % columns;
    const nodesInRow = Math.min(columns, projection.nodes.length - row * columns);
    const column = row % 2 === 0 ? indexInRow : nodesInRow - indexInRow - 1;
    return {
      loopId: node.loopId,
      x: canvasInset + column * (loopCompositionNodeSize.width + horizontalGap),
      y: canvasInset + row * (loopCompositionNodeSize.height + verticalGap)
    };
  });
}
