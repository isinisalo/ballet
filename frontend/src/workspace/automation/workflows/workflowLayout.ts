export type WorkflowCanvasPoint = {
  x: number;
  y: number;
};

export type WorkflowCanvasEdge = {
  key: string;
  from: WorkflowCanvasPoint;
  to: WorkflowCanvasPoint;
  dashed?: boolean;
};

export type WorkflowBranchLayout = {
  height: number;
  width: number;
};

export const workflowConnectorPath = (edge: WorkflowCanvasEdge) => {
  const midX = edge.from.x + Math.max(18, Math.min(48, (edge.to.x - edge.from.x) / 2));
  return Math.abs(edge.from.y - edge.to.y) <= 2
    ? `M ${edge.from.x} ${edge.from.y} H ${edge.to.x}`
    : `M ${edge.from.x} ${edge.from.y} H ${midX} V ${edge.to.y} H ${edge.to.x}`;
};
