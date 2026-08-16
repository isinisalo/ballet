import dagre from "@dagrejs/dagre";
import type { LoopCompositionProjection } from "./loopEngineerProjections";

export const loopCompositionNodeSize = { width: 268, height: 156 } as const;

export interface LoopCompositionLayoutNode {
  loopId: string;
  x: number;
  y: number;
}

export function calculateLoopCompositionLayout(
  projection: LoopCompositionProjection
): LoopCompositionLayoutNode[] {
  const graph = new dagre.graphlib.Graph({ multigraph: true });
  graph.setGraph({ rankdir: "LR", ranksep: 112, nodesep: 56, marginx: 32, marginy: 32 });
  graph.setDefaultEdgeLabel(() => ({}));
  projection.nodes.forEach((node) => graph.setNode(node.loopId, { ...loopCompositionNodeSize }));
  projection.edges.forEach((edge) => graph.setEdge(edge.source, edge.target, {}, edge.id));
  dagre.layout(graph);
  return projection.nodes.map((node) => {
    const position = graph.node(node.loopId) as { x: number; y: number } | undefined;
    return {
      loopId: node.loopId,
      x: (position?.x ?? loopCompositionNodeSize.width / 2) - loopCompositionNodeSize.width / 2,
      y: (position?.y ?? loopCompositionNodeSize.height / 2) - loopCompositionNodeSize.height / 2
    };
  });
}
