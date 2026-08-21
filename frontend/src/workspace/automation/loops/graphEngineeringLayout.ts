import type { GraphEngineeringProjection } from "./engineeringProjections";

export const graphEngineeringLoopNodeSize = { width: 184, height: 104 } as const;
export const graphEngineeringOrchestratorNodeSize = { width: 408, height: 80 } as const;
export const graphEngineeringDoneNodeSize = { width: 96, height: 64 } as const;

export interface GraphEngineeringLayoutNode {
  id: string;
  kind: "loop" | "orchestrator" | "done";
  rank: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

const grid = 24;
const left = 48;
const graphTop = 168;
const columnGap = 56;
const rowGap = 48;

export function calculateGraphEngineeringLayout(
  projection: GraphEngineeringProjection
): GraphEngineeringLayoutNode[] {
  const ranks = graphRanks(projection);
  const byRank = new Map<number, string[]>();
  projection.nodes.forEach(({ loopId }) => {
    const rank = ranks.get(loopId) ?? 0;
    byRank.set(rank, [...(byRank.get(rank) ?? []), loopId]);
  });
  const loops = [...byRank.entries()].flatMap(([rank, ids]) => ids.sort(compareUtf8).map((id, row) => ({
    id,
    kind: "loop" as const,
    rank,
    x: snap(left + rank * (graphEngineeringLoopNodeSize.width + columnGap)),
    y: snap(graphTop + row * (graphEngineeringLoopNodeSize.height + rowGap)),
    ...graphEngineeringLoopNodeSize
  })));
  const maxRank = Math.max(0, ...ranks.values());
  const done = projection.done ? [{
    id: "graph-done",
    kind: "done" as const,
    rank: maxRank + 1,
    x: snap(left + (maxRank + 1) * (graphEngineeringLoopNodeSize.width + columnGap)),
    y: snap(graphTop + Math.round((graphEngineeringLoopNodeSize.height - graphEngineeringDoneNodeSize.height) / 2)),
    ...graphEngineeringDoneNodeSize
  }] : [];
  return [{
    id: projection.orchestrator.id,
    kind: "orchestrator",
    rank: -1,
    x: left,
    y: 40,
    ...graphEngineeringOrchestratorNodeSize
  }, ...loops, ...done];
}

function graphRanks(projection: GraphEngineeringProjection): Map<string, number> {
  const ranks = new Map<string, number>([[projection.startLoopId, 0]]);
  const queue = [projection.startLoopId];
  while (queue.length) {
    const source = queue.shift()!;
    const nextRank = (ranks.get(source) ?? 0) + 1;
    projection.edges
      .filter((edge) => edge.kind === "transition" && edge.source === source && edge.targetId !== "graph-done")
      .map((edge) => edge.targetId)
      .sort(compareUtf8)
      .forEach((target) => {
        if (ranks.has(target)) return;
        ranks.set(target, nextRank);
        queue.push(target);
      });
  }
  projection.nodes.map(({ loopId }) => loopId).sort(compareUtf8).forEach((id) => {
    if (!ranks.has(id)) ranks.set(id, 0);
  });
  return ranks;
}

const snap = (value: number) => Math.round(value / grid) * grid;
const compareUtf8 = (left: string, right: string) => left.localeCompare(right);
