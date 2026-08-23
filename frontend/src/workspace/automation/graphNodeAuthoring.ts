import type {
  ProjectAutomationConfig, ProjectGraphNode, ProjectGraphRouteTarget, ProjectJobNode, ProjectGraphNodeRouteTarget,
  ProjectGraphDecisionStrategyV2, ProjectGraphNodeDecisionStrategyV2, ProjectSspDecisionStrategyV2
} from "@shared/api/workspace-contracts";

type NodeInput = { id: string; description: string; executionProfileId: string; primaryInstructionId: string };
type AnyStrategy = ProjectGraphDecisionStrategyV2 | ProjectGraphNodeDecisionStrategyV2;

export const createGenericJobNode = (input: NodeInput): ProjectJobNode => ({
  id: input.id, description: input.description, capabilities: { accepts: [], provides: [] }, outcomes: [], maxRetries: 0,
  workNode: {
    id: `${input.id}-work`, type: "agent", description: "Take action", task: "Perform the configured capability action.",
    nodeStyle: "terra", nodeSize: "medium", executionProfileId: input.executionProfileId,
    primaryInstructionId: input.primaryInstructionId, skillIds: []
  },
  validationNode: {
    id: `${input.id}-validation`, type: "agent", description: "Verify result", task: "Verify the capability result.",
    nodeStyle: "luna", nodeSize: "medium", executionProfileId: input.executionProfileId,
    primaryInstructionId: input.primaryInstructionId, skillIds: []
  }
});

export const createGenericGraphNode = (input: NodeInput): ProjectGraphNode => {
  const job = createGenericJobNode({ ...input, id: `${input.id}-job`, description: `Aggregate job for ${input.id}.` });
  return {
    id: input.id, description: input.description, capabilities: { accepts: [], provides: [] }, outcomes: [],
    stateContract: { description: "Uses the bounded Graph State contract configured for this capability." },
    strategy: { kind: "agent_v1", orchestrator: {
      id: `${input.id}-orchestrator`, description: `Routes aggregate Job Nodes within ${input.id}.`,
      executionProfileId: input.executionProfileId, primaryInstructionId: input.primaryInstructionId, skillIds: [],
      maxTransitions: 256, maxRouteAttempts: 3,
      routing: {
        start: { id: `${input.id}-start`, candidates: [
          { target: { jobNodeId: job.id }, description: "Execute the configured capability." },
          { target: { terminal: "PASS" }, description: "Complete this Graph Node successfully." },
          { target: { terminal: "FAIL" }, description: "Complete this Graph Node unsuccessfully." }
        ] }, continuation: [], repair: []
      }
    } }, jobNodes: [job]
  };
};

export const addGraphNode = (config: ProjectAutomationConfig, node: ProjectGraphNode): ProjectAutomationConfig => ({
  ...config, graph: {
    ...config.graph, graphNodes: [...config.graph.graphNodes, node],
    strategy: addAction(config.graph.strategy, node.id, "graphNodeId")
  }
});

export const renameGraphNode = (config: ProjectAutomationConfig, from: string, to: string): ProjectAutomationConfig => ({
  ...config, graph: {
    ...config.graph, graphNodes: config.graph.graphNodes.map((node) => node.id === from ? { ...node, id: to } : node),
    strategy: renameAction(config.graph.strategy, from, to, "graphNodeId")
  }
});

export const removeGraphNode = (config: ProjectAutomationConfig, id: string): ProjectAutomationConfig => ({
  ...config, graph: {
    ...config.graph, graphNodes: config.graph.graphNodes.filter((node) => node.id !== id),
    strategy: removeAction(config.graph.strategy, id, "graphNodeId")
  }
});

export const addJobNode = (config: ProjectAutomationConfig, graphNodeId: string, job: ProjectJobNode) => updateGraphNode(
  config, graphNodeId, (node) => ({ ...node, jobNodes: [...node.jobNodes, job], strategy: addAction(node.strategy, job.id, "jobNodeId") })
);

export const renameJobNode = (config: ProjectAutomationConfig, graphNodeId: string, from: string, to: string) => updateGraphNode(
  config, graphNodeId, (node) => ({
    ...node, jobNodes: node.jobNodes.map((job) => job.id === from ? { ...job, id: to } : job),
    strategy: renameAction(node.strategy, from, to, "jobNodeId")
  })
);

export const removeJobNode = (config: ProjectAutomationConfig, graphNodeId: string, id: string) => updateGraphNode(
  config, graphNodeId, (node) => ({
    ...node, jobNodes: node.jobNodes.filter((job) => job.id !== id), strategy: removeAction(node.strategy, id, "jobNodeId")
  })
);

export const jobNodeReferences = (node: ProjectGraphNode, jobNodeId: string): string[] => {
  if (node.strategy.kind === "ssp_v2") {
    return [
      ...node.strategy.capabilityModel.actions.filter(({ actionId }) => actionId === jobNodeId).map(() => "Capability Model action"),
      ...node.strategy.model.stateActions.filter(({ actionId }) => actionId === jobNodeId).map(({ stateId }) => `Decision row in ${stateId}`)
    ];
  }
  const routing = node.strategy.orchestrator.routing;
  return [routing.start, ...routing.continuation, ...routing.repair].flatMap((rule) => [
    ...( "sourceId" in rule && rule.sourceId === jobNodeId ? [`Rule ${rule.id} source`] : []),
    ...rule.candidates.flatMap(({ target }) => "jobNodeId" in target && target.jobNodeId === jobNodeId ? [`Rule ${rule.id} candidate`] : [])
  ]);
};

const updateGraphNode = (config: ProjectAutomationConfig, id: string, update: (node: ProjectGraphNode) => ProjectGraphNode) => ({
  ...config, graph: { ...config.graph, graphNodes: config.graph.graphNodes.map((node) => node.id === id ? update(node) : node) }
});

const addAction = <T extends AnyStrategy>(strategy: T, id: string, key: "graphNodeId" | "jobNodeId"): T => {
  if (strategy.kind === "ssp_v2") return { ...strategy, capabilityModel: {
    ...strategy.capabilityModel, actions: [...strategy.capabilityModel.actions, { actionId: id, guards: [] }]
  } } as T;
  return { ...strategy, orchestrator: { ...strategy.orchestrator, routing: {
    ...strategy.orchestrator.routing, start: { ...strategy.orchestrator.routing.start,
      candidates: [...strategy.orchestrator.routing.start.candidates, {
        target: { [key]: id }, description: `Allow ${id} at start.`
      }]
    }
  } } } as T;
};

const renameAction = <T extends AnyStrategy>(strategy: T, from: string, to: string, key: "graphNodeId" | "jobNodeId"): T => {
  if (strategy.kind === "ssp_v2") return renameSspAction(strategy, from, to) as T;
  const routing = strategy.orchestrator.routing;
  const renameCandidates = <C extends { target: ProjectGraphRouteTarget | ProjectGraphNodeRouteTarget }>(values: C[]) => values.map((entry) =>
    key in entry.target && (entry.target as unknown as Record<string, string>)[key] === from
      ? { ...entry, target: { [key]: to } } : entry) as C[];
  return { ...strategy, orchestrator: { ...strategy.orchestrator, routing: {
    start: { ...routing.start, candidates: renameCandidates([...routing.start.candidates]) },
    continuation: routing.continuation.map((rule) => ({ ...rule, sourceId: rule.sourceId === from ? to : rule.sourceId, candidates: renameCandidates([...rule.candidates]) })),
    repair: routing.repair.map((rule) => ({ ...rule, sourceId: rule.sourceId === from ? to : rule.sourceId, candidates: renameCandidates([...rule.candidates]) }))
  } } } as T;
};

const renameSspAction = (strategy: ProjectSspDecisionStrategyV2, from: string, to: string): ProjectSspDecisionStrategyV2 => {
  const featureIds = new Set(strategy.model.features.filter(({ source }) => source.kind === "runtime" && source.fact === "previous_action_id").map(({ id }) => id));
  return { ...strategy,
    capabilityModel: { ...strategy.capabilityModel, actions: strategy.capabilityModel.actions.map((action) => ({
      ...action, actionId: action.actionId === from ? to : action.actionId,
      guards: action.guards.map((guard) => featureIds.has(guard.featureId)
        ? { ...guard, allowedValues: guard.allowedValues.map((value) => value === from ? to : value) } : guard)
    })) },
    model: { ...strategy.model,
      features: strategy.model.features.map((feature) => featureIds.has(feature.id) ? {
        ...feature, domain: feature.domain.map((value) => value === from ? to : value),
        missingValue: feature.missingValue === from ? to : feature.missingValue
      } : feature),
      states: strategy.model.states.map((state) => ({ ...state, values: Object.fromEntries(Object.entries(state.values).map(
        ([featureId, value]) => [featureId, featureIds.has(featureId) && value === from ? to : value])) })),
      stateActions: strategy.model.stateActions.map((row) => row.actionId === from ? { ...row, actionId: to } : row)
    }
  };
};

const removeAction = <T extends AnyStrategy>(strategy: T, id: string, key: "graphNodeId" | "jobNodeId"): T => {
  if (strategy.kind === "ssp_v2") return { ...strategy,
    capabilityModel: { ...strategy.capabilityModel, actions: strategy.capabilityModel.actions.filter(({ actionId }) => actionId !== id) },
    model: { ...strategy.model, stateActions: strategy.model.stateActions.filter(({ actionId }) => actionId !== id) }
  } as T;
  const routing = strategy.orchestrator.routing;
  const clean = <C extends { target: ProjectGraphRouteTarget | ProjectGraphNodeRouteTarget }>(values: C[]) => values.filter((entry) =>
    !(key in entry.target && (entry.target as unknown as Record<string, string>)[key] === id));
  return { ...strategy, orchestrator: { ...strategy.orchestrator, routing: {
    start: { ...routing.start, candidates: clean([...routing.start.candidates]) },
    continuation: routing.continuation.filter(({ sourceId }) => sourceId !== id).map((rule) => ({ ...rule, candidates: clean([...rule.candidates]) })),
    repair: routing.repair.filter(({ sourceId }) => sourceId !== id).map((rule) => ({ ...rule, candidates: clean([...rule.candidates]) }))
  } } } as T;
};
