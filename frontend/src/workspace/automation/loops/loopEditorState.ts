import {
  defaultProjectLoopOrchestrator,
  type ProjectAutomationConfig,
  type ProjectLoop,
  type ProjectLoopEdge,
  type ProjectLoopOrchestrator,
} from "@shared/api/workspace-contracts";

export {
  addJobPair,
  canRemoveJobPair,
  changeJobNodeType,
  changeValidationNodeType,
  createJobNodeDraft,
  createValidationNodeDraft,
  nextJobNodeId,
  removeJobPair,
  reorderJobNodes,
  replaceFailEdge,
  replaceJobNode,
  replacePassEdge,
  replaceValidationNode,
  updatePassEdgeTarget
} from "./workflowEditorState";

export const createLoopDraft = (): ProjectLoop => ({
  id: "new-loop",
  description: "",
  capabilities: { accepts: [], provides: [] },
  state: { description: "", initial: {} },
  workflow: {
    startJobNodeId: "job",
    jobNodes: [],
    validationNodes: [],
    passEdges: [],
    failEdges: []
  }
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
    graph: { loopEdges: config.graph.loopEdges.filter((edge) =>
      edge.source !== removed.id && edge.target !== removed.id) }
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

const uniqueId = (ids: readonly string[], base: string): string => {
  const existing = new Set(ids);
  if (!existing.has(base)) return base;
  let suffix = 2;
  while (existing.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
};
