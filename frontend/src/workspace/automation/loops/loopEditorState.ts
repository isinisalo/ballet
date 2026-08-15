import {
  defaultLoopNodeSize,
  defaultLoopNodeStyle,
  type ProjectAutomationConfig,
  type ProjectLoop,
  type ProjectWorkLoopNode
} from "@shared/api/workspace-contracts";

export const createLoopDraft = (): ProjectLoop => ({
  id: "new-loop",
  description: "",
  state: { description: "", initial: {} },
  startNodeId: "work",
  nodes: [],
  edges: []
});

export const createWorkLoopNodeDraft = (id = "work"): ProjectWorkLoopNode => ({
  id,
  description: "",
  work: {
    type: "agent",
    task: "",
    executionProfileId: "",
    primaryInstructionId: "",
    skillIds: [],
    nodeStyle: defaultLoopNodeStyle,
    nodeSize: defaultLoopNodeSize
  },
  validation: {
    type: "human",
    task: "",
    nodeStyle: defaultLoopNodeStyle,
    nodeSize: defaultLoopNodeSize
  },
  maxLocalAttempts: 3
});

export const updateLoopAtIndex = (
  config: ProjectAutomationConfig,
  index: number,
  loop: ProjectLoop
): ProjectAutomationConfig => {
  const previous = config.loops[index];
  if (!previous) return config;
  return {
    ...config,
    loops: config.loops.map((candidate, candidateIndex) => candidateIndex === index ? loop : candidate),
    loopEdges: previous.id === loop.id ? config.loopEdges : config.loopEdges.map((edge) => ({
      ...edge,
      source: edge.source === previous.id ? loop.id : edge.source,
      target: edge.target === previous.id ? loop.id : edge.target
    }))
  };
};

export const removeLoopAtIndex = (
  config: ProjectAutomationConfig,
  index: number
): ProjectAutomationConfig => {
  const removed = config.loops[index];
  if (!removed) return config;
  return {
    ...config,
    loops: config.loops.filter((_, candidateIndex) => candidateIndex !== index),
    loopEdges: config.loopEdges.filter((edge) => edge.source !== removed.id && edge.target !== removed.id)
  };
};

export const replaceWorkLoopNode = (
  loop: ProjectLoop,
  previousId: string,
  node: ProjectWorkLoopNode
): ProjectLoop => ({
  ...loop,
  startNodeId: loop.startNodeId === previousId ? node.id : loop.startNodeId,
  nodes: loop.nodes.map((candidate) => candidate.id === previousId ? node : candidate),
  edges: loop.edges.map((edge) => ({
    ...edge,
    source: edge.source === previousId ? node.id : edge.source,
    target: "nodeId" in edge.target && edge.target.nodeId === previousId
      ? { nodeId: node.id }
      : edge.target
  }))
});

export const removeWorkLoopNode = (loop: ProjectLoop, nodeId: string): ProjectLoop => {
  const nodes = loop.nodes.filter((node) => node.id !== nodeId);
  return {
    ...loop,
    startNodeId: loop.startNodeId === nodeId ? nodes[0]?.id ?? "work" : loop.startNodeId,
    nodes,
    edges: loop.edges.filter((edge) => edge.source !== nodeId
      && !("nodeId" in edge.target && edge.target.nodeId === nodeId))
  };
};

export const reorderWorkLoopNodes = (loop: ProjectLoop, fromIndex: number, toIndex: number): ProjectLoop => {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0
    || fromIndex >= loop.nodes.length || toIndex >= loop.nodes.length) return loop;
  const nodes = [...loop.nodes];
  const [moved] = nodes.splice(fromIndex, 1);
  if (!moved) return loop;
  nodes.splice(toIndex, 0, moved);
  return { ...loop, nodes };
};
