import type { GraphEngineeringProjection } from "./engineeringProjections";

export const graphEngineeringLoopNodeSize = { width: 264, height: 144 } as const;
export const graphEngineeringOrchestratorNodeSize = { width: 264, height: 144 } as const;

export interface GraphEngineeringLayoutNode {
  id: string;
  kind: "loop" | "orchestrator";
  x: number;
  y: number;
  width: number;
  height: number;
}

const grid = 24;
const columns = [48, 360, 672] as const;
const rows = [48, 240, 432] as const;
const orchestratorPosition = { x: columns[1], y: rows[1] } as const;
const surroundingSlots = [
  { x: columns[0], y: rows[1] }, { x: columns[2], y: rows[1] },
  { x: columns[0], y: rows[0] }, { x: columns[2], y: rows[0] },
  { x: columns[0], y: rows[2] }, { x: columns[2], y: rows[2] },
  { x: columns[1], y: rows[0] }, { x: columns[1], y: rows[2] }
] as const;

export function calculateGraphEngineeringLayout(
  projection: GraphEngineeringProjection
): GraphEngineeringLayoutNode[] {
  const loops = projection.nodes.map((node, index): GraphEngineeringLayoutNode => {
    const slot = surroundingSlots[index] ?? overflowSlot(index - surroundingSlots.length);
    return { id: node.loopId, kind: "loop", ...slot, ...graphEngineeringLoopNodeSize };
  });
  return [{
    id: projection.orchestrator.id,
    kind: "orchestrator",
    ...orchestratorPosition,
    ...graphEngineeringOrchestratorNodeSize
  }, ...loops];
}

function overflowSlot(index: number) {
  const row = Math.floor(index / columns.length);
  return {
    x: columns[index % columns.length]!,
    y: snapToGrid(rows[2] + grid * 8 * (row + 1))
  };
}

const snapToGrid = (value: number) => Math.round(value / grid) * grid;
