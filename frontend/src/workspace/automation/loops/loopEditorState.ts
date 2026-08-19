import {
  defaultLoopNodeSize,
  defaultLoopNodeStyle,
  defaultProjectLoopOrchestrator,
  isProjectProviderWorkNode,
  type ProjectAutomationConfig,
  type ProjectLoopEdge,
  type ProjectLoopOrchestrator,
  type ProjectLoop,
  type ProjectNodeEdgeTarget,
  type ProjectValidationNode,
  type ProjectWorkNode,
  type ProjectWorkLoopNode
} from "@shared/api/workspace-contracts";
import { defaultOnceSchedule } from "./loopSchedulePresentation";

export const createLoopDraft = (): ProjectLoop => ({
  id: "new-loop",
  description: "",
  capabilities: { accepts: [], provides: [] },
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

export const nextWorkLoopNodeId = (
  config: ProjectAutomationConfig,
  loop: ProjectLoop
): string => uniqueId(
  [...config.loops.flatMap((candidate) => candidate.nodes.map((node) => node.id)), ...loop.nodes.map((node) => node.id)],
  `${loop.id.trim() || "loop"}-work`
);

export const addWorkLoopNode = (
  loop: ProjectLoop,
  node = createWorkLoopNodeDraft(uniqueId(loop.nodes.map((candidate) => candidate.id), "work"))
): ProjectLoop => ({
  ...loop,
  startNodeId: loop.nodes.length === 0 ? node.id : loop.startNodeId,
  nodes: [...loop.nodes, node],
  edges: [...loop.edges, {
    id: uniqueId(loop.edges.map((edge) => edge.id), `${loop.id}-${node.id}-ok`),
    source: node.id,
    target: { terminal: "completed" }
  }]
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
    graph: {
      loopEdges: previous.id === loop.id ? config.graph.loopEdges : config.graph.loopEdges.map((edge) => ({
        ...edge,
        source: edge.source === previous.id ? loop.id : edge.source,
        target: edge.target === previous.id ? loop.id : edge.target
      }))
    }
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
    graph: { loopEdges: config.graph.loopEdges.filter((edge) => edge.source !== removed.id && edge.target !== removed.id) }
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
    edges: loop.edges
      .filter((edge) => edge.source !== nodeId)
      .map((edge) => "nodeId" in edge.target && edge.target.nodeId === nodeId
        ? { ...edge, target: { terminal: "completed" } as const }
        : edge)
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
export const updateWorkLoopNodeWork = (
  loop: ProjectLoop,
  nodeId: string,
  work: ProjectWorkNode
): ProjectLoop => updateWorkLoopNodePart(loop, nodeId, (node) => ({ ...node, work }));
export const updateWorkLoopNodeValidation = (
  loop: ProjectLoop,
  nodeId: string,
  validation: ProjectValidationNode
): ProjectLoop => updateWorkLoopNodePart(loop, nodeId, (node) => ({ ...node, validation }));
export const updateNodeEdgeTarget = (
  loop: ProjectLoop,
  sourceNodeId: string,
  target: ProjectNodeEdgeTarget
): ProjectLoop => {
  const existing = loop.edges.find((edge) => edge.source === sourceNodeId);
  if (existing) return {
    ...loop,
    edges: loop.edges.map((edge) => edge.id === existing.id ? { ...edge, target } : edge)
  };
  return {
    ...loop,
    edges: [...loop.edges, {
      id: uniqueId(loop.edges.map((edge) => edge.id), `${loop.id}-${sourceNodeId}-ok`),
      source: sourceNodeId,
      target
    }]
  };
};
export const updateLoopEdge = (
  config: ProjectAutomationConfig,
  edgeId: string,
  edge: ProjectLoopEdge
): ProjectAutomationConfig => ({
  ...config,
  graph: { loopEdges: config.graph.loopEdges.map((candidate) => candidate.id === edgeId ? edge : candidate) }
});
export const addLoopEdge = (
  config: ProjectAutomationConfig,
  sourceLoopId: string
): ProjectAutomationConfig => {
  const hasFlow = config.graph.loopEdges.some((edge) => edge.source === sourceLoopId && edge.kind === "flow");
  const kind = hasFlow ? "repair" : "flow";
  const target = config.loops.find((loop) => loop.id !== sourceLoopId
    && (kind === "flow" || !config.graph.loopEdges.some((edge) => edge.kind === "repair"
      && edge.source === sourceLoopId && edge.target === loop.id)))?.id ?? sourceLoopId;
  const targetLoop = config.loops.find((loop) => loop.id === target);
  const compatibleCapabilities = kind === "flow"
    ? targetLoop?.capabilities.accepts ?? []
    : targetLoop?.capabilities.provides ?? [];
  const edge: ProjectLoopEdge = {
    id: uniqueId(config.graph.loopEdges.map((candidate) => candidate.id), `${sourceLoopId}-${kind}`),
    source: sourceLoopId,
    target,
    kind,
    capability: compatibleCapabilities.length === 1 ? compatibleCapabilities[0]! : "",
    description: kind === "flow" ? "Continue to the target Loop." : "Allow repair routing to the target Loop."
  };
  return { ...config, graph: { loopEdges: [...config.graph.loopEdges, edge] } };
};

export const removeLoopEdge = (
  config: ProjectAutomationConfig,
  edgeId: string
): ProjectAutomationConfig => ({
  ...config,
  graph: { loopEdges: config.graph.loopEdges.filter((edge) => edge.id !== edgeId) }
});

export const updateOrchestrator = (
  config: ProjectAutomationConfig,
  orchestrator: ProjectLoopOrchestrator
): ProjectAutomationConfig => ({ ...config, orchestrator });

export const resetOrchestrator = (config: ProjectAutomationConfig): ProjectAutomationConfig =>
  updateOrchestrator(config, defaultProjectLoopOrchestrator());

export const changeWorkNodeType = (
  node: ProjectWorkNode,
  type: ProjectWorkNode["type"]
): ProjectWorkNode => {
  if (node.type === type) return node;
  const appearance = { nodeStyle: node.nodeStyle, nodeSize: node.nodeSize, task: node.task };
  if (type === "human") return { type, ...appearance };
  const composition = isProjectProviderWorkNode(node)
    ? { executionProfileId: node.executionProfileId, primaryInstructionId: node.primaryInstructionId, skillIds: node.skillIds }
    : { executionProfileId: "", primaryInstructionId: "", skillIds: [] };
  if (type === "scheduled") return { type, ...appearance, ...composition, schedule: defaultOnceSchedule() };
  return { type, ...appearance, ...composition };
};

export const changeValidationNodeType = (
  node: ProjectValidationNode,
  type: ProjectValidationNode["type"]
): ProjectValidationNode => {
  if (node.type === type) return node;
  const appearance = { nodeStyle: node.nodeStyle, nodeSize: node.nodeSize, task: node.task };
  return type === "human"
    ? { type, ...appearance }
    : { type, ...appearance, executionProfileId: "", primaryInstructionId: "", skillIds: [] };
};

const updateWorkLoopNodePart = (
  loop: ProjectLoop,
  nodeId: string,
  updater: (node: ProjectWorkLoopNode) => ProjectWorkLoopNode
): ProjectLoop => ({
  ...loop,
  nodes: loop.nodes.map((node) => node.id === nodeId ? updater(node) : node)
});

const uniqueId = (ids: readonly string[], base: string): string => {
  const existing = new Set(ids);
  if (!existing.has(base)) return base;
  let suffix = 2;
  while (existing.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
};
