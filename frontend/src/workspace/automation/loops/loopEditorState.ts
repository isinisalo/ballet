import {
  defaultProjectLoopOrchestrator,
  type ProjectAutomationConfig,
  type ProjectGraphTransition,
  type ProjectLoop,
  type ProjectLoopOrchestrator,
  type ProjectRepairEdge,
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
      ...config.graph,
      startLoopId: config.graph.startLoopId === previous.id ? loop.id : config.graph.startLoopId,
      transitions: previous.id === loop.id ? config.graph.transitions : config.graph.transitions.map((transition) => ({
        ...transition,
        source: transition.source === previous.id ? loop.id : transition.source,
        target: "loopId" in transition.target && transition.target.loopId === previous.id
          ? { loopId: loop.id }
          : transition.target
      })),
      repairEdges: previous.id === loop.id ? config.graph.repairEdges : config.graph.repairEdges.map((edge) => ({
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
    graph: {
      ...config.graph,
      startLoopId: config.graph.startLoopId === removed.id
        ? config.loops.find((_, candidateIndex) => candidateIndex !== index)?.id ?? ""
        : config.graph.startLoopId,
      transitions: config.graph.transitions.filter((transition) =>
        transition.source !== removed.id
        && !("loopId" in transition.target && transition.target.loopId === removed.id)),
      repairEdges: config.graph.repairEdges.filter((edge) =>
        edge.source !== removed.id && edge.target !== removed.id)
    }
  };
};

export const updateGraphTransition = (
  config: ProjectAutomationConfig,
  edgeId: string,
  edge: ProjectGraphTransition
): ProjectAutomationConfig => ({
  ...config,
  graph: { ...config.graph, transitions: config.graph.transitions.map((candidate) => candidate.id === edgeId ? edge : candidate) }
});

export const addGraphTransition = (
  config: ProjectAutomationConfig,
  sourceLoopId: string
): ProjectAutomationConfig => {
  const decision = config.graph.transitions.some((edge) => edge.source === sourceLoopId && edge.decision === "PASS")
    ? "FAIL" as const
    : "PASS" as const;
  const target = config.loops.find((loop) => loop.id !== sourceLoopId)?.id ?? sourceLoopId;
  const edge: ProjectGraphTransition = {
    id: uniqueId(config.graph.transitions.map((candidate) => candidate.id), `${sourceLoopId}-${decision.toLowerCase()}-outcome`),
    source: sourceLoopId,
    decision,
    outcome: decision === "PASS" ? "success" : "failure",
    target: { loopId: target },
    description: "Route the selected RunBook outcome to the target Loop."
  };
  return { ...config, graph: { ...config.graph, transitions: [...config.graph.transitions, edge] } };
};

export const removeGraphTransition = (
  config: ProjectAutomationConfig,
  edgeId: string
): ProjectAutomationConfig => ({
  ...config,
  graph: { ...config.graph, transitions: config.graph.transitions.filter((edge) => edge.id !== edgeId) }
});

export const updateRepairEdge = (
  config: ProjectAutomationConfig,
  edgeId: string,
  edge: ProjectRepairEdge
): ProjectAutomationConfig => ({
  ...config,
  graph: { ...config.graph, repairEdges: config.graph.repairEdges.map((candidate) => candidate.id === edgeId ? edge : candidate) }
});

export const addRepairEdge = (
  config: ProjectAutomationConfig,
  sourceLoopId: string
): ProjectAutomationConfig => {
  const target = config.loops.find((loop) => loop.id !== sourceLoopId)?.id ?? sourceLoopId;
  const capability = config.loops.find((loop) => loop.id === target)?.capabilities.provides[0] ?? "repair:capability";
  const edge: ProjectRepairEdge = {
    id: uniqueId(config.graph.repairEdges.map((candidate) => candidate.id), `${sourceLoopId}-repair`),
    source: sourceLoopId,
    target,
    capability,
    description: "Allow the repair router to call the target Loop and return to this Validation."
  };
  return { ...config, graph: { ...config.graph, repairEdges: [...config.graph.repairEdges, edge] } };
};

export const removeRepairEdge = (
  config: ProjectAutomationConfig,
  edgeId: string
): ProjectAutomationConfig => ({
  ...config,
  graph: { ...config.graph, repairEdges: config.graph.repairEdges.filter((edge) => edge.id !== edgeId) }
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
