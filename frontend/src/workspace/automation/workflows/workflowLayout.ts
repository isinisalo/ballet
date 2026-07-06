import type { WorkflowGraph } from "./workflowGraph";
import type { WorkflowCanvasEdge } from "./workflowLayoutEdges";
import { buildWorkflowLayoutGraphDraft } from "./workflowLayoutGraph";
import { positionWorkflowNodes } from "./workflowLayoutPositioning";
import type { WorkflowCanvasLayout, WorkflowCanvasLayoutNode, WorkflowLayoutDirection } from "./workflowLayoutTypes";

export type { WorkflowCanvasEdge } from "./workflowLayoutEdges";
export { workflowAddActionGhostLabel, workflowCanvasLayoutConfig, workflowNodeSizes } from "./workflowLayoutConfig";
export {
  workflowCanvasNodeAnchorY,
  workflowOutputSourceHandleId,
  workflowPolicyOutputHandleY,
  workflowPolicyStackHeight
} from "./workflowLayoutSizing";
export type {
  WorkflowCanvasLayout,
  WorkflowCanvasLayoutNode,
  WorkflowCanvasNodeKind,
  WorkflowCanvasOutputEvent,
  WorkflowLayoutDirection
} from "./workflowLayoutTypes";

export function calculateWorkflowCanvasLayout({
  workflowGraph,
  editingPolicyIndex,
  direction = "horizontal"
}: {
  workflowGraph: WorkflowGraph;
  editingPolicyIndex: number | null;
  direction?: WorkflowLayoutDirection;
}): WorkflowCanvasLayout {
  const graphDraft = buildWorkflowLayoutGraphDraft({
    workflowGraph,
    editingPolicyIndex,
    direction
  });
  const positionedNodes = positionWorkflowNodes(graphDraft.nodes, graphDraft.dagreEdges, direction);

  return {
    nodes: positionedNodes,
    edges: workflowReturnEdgesWithTargetHandles(graphDraft.canvasEdges, positionedNodes),
    direction
  };
}

function workflowReturnEdgesWithTargetHandles(
  edges: WorkflowCanvasEdge[],
  nodes: WorkflowCanvasLayoutNode[]
) {
  const nodeByKey = new Map(nodes.map((node) => [node.key, node]));

  return edges.map((edge) => {
    if (edge.tone !== "return") return edge;
    const sourceNode = nodeByKey.get(edge.sourceNodeKey);
    const targetNode = nodeByKey.get(edge.targetNodeKey);
    if (!sourceNode || !targetNode) return edge;

    return {
      ...edge,
      targetHandleId: sourceNode.y + sourceNode.height / 2 > targetNode.y + targetNode.height / 2 ? "bottom" : "top"
    };
  });
}
