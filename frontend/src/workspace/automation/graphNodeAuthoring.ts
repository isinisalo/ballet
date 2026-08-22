import type {
  ProjectAutomationConfig,
  ProjectGraphNode,
  ProjectGraphRouteTarget
} from "@shared/api/workspace-contracts";

export const createGenericGraphNode = (input: {
  id: string;
  description: string;
  executionProfileId: string;
  primaryInstructionId: string;
}): ProjectGraphNode => ({
  id: input.id,
  description: input.description,
  nodeStyle: "vector-planet",
  nodeSize: "medium",
  capabilities: { accepts: [], provides: [] },
  stateContract: { description: "Uses the bounded Graph State contract configured for this capability." },
  orchestrator: {
    id: `${input.id}-orchestrator`,
    description: `Routes aggregate Job Nodes within ${input.id}.`,
    nodeStyle: "luna",
    nodeSize: "medium",
    executionProfileId: input.executionProfileId,
    primaryInstructionId: input.primaryInstructionId,
    skillIds: [],
    maxTransitions: 256,
    maxRouteAttempts: 3,
    routing: {
      start: {
        id: `${input.id}-start`,
        candidates: [
          { target: { jobNodeId: `${input.id}-job` }, description: "Execute the configured capability." },
          { target: { terminal: "PASS" }, description: "Complete this Graph Node successfully." },
          { target: { terminal: "FAIL" }, description: "Complete this Graph Node unsuccessfully." }
        ]
      },
      continuation: [],
      repair: []
    }
  },
  jobNodes: [{
    id: `${input.id}-job`,
    description: `Aggregate job for ${input.id}.`,
    nodeStyle: "terra",
    nodeSize: "medium",
    capabilities: { accepts: [], provides: [] },
    maxRetries: 0,
    workNode: {
      id: `${input.id}-work`, type: "human", description: "Take action", task: "Perform the configured capability action.",
      nodeStyle: "terra", nodeSize: "medium"
    },
    validationNode: {
      id: `${input.id}-validation`, type: "human", description: "Verify result", task: "Verify the capability result.",
      nodeStyle: "luna", nodeSize: "medium"
    }
  }]
});

export const addGraphNode = (config: ProjectAutomationConfig, node: ProjectGraphNode): ProjectAutomationConfig => {
  const strategy = config.graph.strategy;
  const nextStrategy = strategy.kind === "ssp_v1" ? {
    ...strategy,
    capabilityGraph: {
      ...strategy.capabilityGraph,
      actions: [...strategy.capabilityGraph.actions, { graphNodeId: node.id, guards: [] }]
    }
  } : {
    ...strategy,
    orchestrator: {
      ...strategy.orchestrator,
      routing: {
        ...strategy.orchestrator.routing,
        start: {
          ...strategy.orchestrator.routing.start,
          candidates: [...strategy.orchestrator.routing.start.candidates, {
            target: { graphNodeId: node.id }, description: `Allow ${node.id} at Graph start.`
          }]
        }
      }
    }
  };
  return { ...config, graph: { ...config.graph, strategy: nextStrategy, graphNodes: [...config.graph.graphNodes, node] } };
};

export const renameGraphNode = (config: ProjectAutomationConfig, from: string, to: string): ProjectAutomationConfig => {
  const strategy = config.graph.strategy;
  if (strategy.kind === "ssp_v1") {
    const previousIdFeatureIds = new Set(strategy.model.features.filter(({ source }) =>
      source.kind === "runtime" && source.fact === "previous_graph_node_id").map(({ id }) => id));
    return {
      ...config,
      graph: {
        ...config.graph,
        graphNodes: config.graph.graphNodes.map((node) => node.id === from ? { ...node, id: to } : node),
        strategy: {
          ...strategy,
          capabilityGraph: {
            ...strategy.capabilityGraph,
            actions: strategy.capabilityGraph.actions.map((action) => ({
              ...action,
              graphNodeId: action.graphNodeId === from ? to : action.graphNodeId,
              guards: action.guards.map((guard) => previousIdFeatureIds.has(guard.featureId)
                ? { ...guard, allowedValues: guard.allowedValues.map((value) => value === from ? to : value) } : guard)
            }))
          },
          model: {
            ...strategy.model,
            features: strategy.model.features.map((feature) => previousIdFeatureIds.has(feature.id) ? {
              ...feature,
              domain: feature.domain.map((value) => value === from ? to : value),
              missingValue: feature.missingValue === from ? to : feature.missingValue
            } : feature),
            states: strategy.model.states.map((state) => ({
              ...state,
              values: Object.fromEntries(Object.entries(state.values).map(([featureId, value]) =>
                [featureId, previousIdFeatureIds.has(featureId) && value === from ? to : value]))
            })),
            stateActions: strategy.model.stateActions.map((row) =>
              row.graphNodeId === from ? { ...row, graphNodeId: to } : row)
          }
        }
      }
    };
  }
  const routing = strategy.orchestrator.routing;
  return {
    ...config,
    graph: {
      ...config.graph,
      graphNodes: config.graph.graphNodes.map((node) => node.id === from ? { ...node, id: to } : node),
      strategy: {
        ...strategy,
        orchestrator: {
          ...strategy.orchestrator,
          routing: {
            start: { ...routing.start, candidates: renameTargets(routing.start.candidates, from, to) },
            continuation: routing.continuation.map((rule) => ({
              ...rule, sourceId: rule.sourceId === from ? to : rule.sourceId,
              candidates: renameTargets(rule.candidates, from, to)
            })),
            repair: routing.repair.map((rule) => ({
              ...rule, sourceId: rule.sourceId === from ? to : rule.sourceId,
              candidates: renameTargets(rule.candidates, from, to)
            }))
          }
        }
      }
    }
  };
};

export const removeGraphNode = (config: ProjectAutomationConfig, id: string): ProjectAutomationConfig => {
  const strategy = config.graph.strategy;
  const nextStrategy = strategy.kind === "ssp_v1" ? {
    ...strategy,
    capabilityGraph: {
      ...strategy.capabilityGraph,
      actions: strategy.capabilityGraph.actions.filter(({ graphNodeId }) => graphNodeId !== id)
    },
    model: {
      ...strategy.model,
      stateActions: strategy.model.stateActions.filter(({ graphNodeId }) => graphNodeId !== id)
    }
  } : {
    ...strategy,
    orchestrator: {
      ...strategy.orchestrator,
      routing: {
        start: { ...strategy.orchestrator.routing.start, candidates: removeTargets(strategy.orchestrator.routing.start.candidates, id) },
        continuation: strategy.orchestrator.routing.continuation.filter(({ sourceId }) => sourceId !== id)
          .map((rule) => ({ ...rule, candidates: removeTargets(rule.candidates, id) })),
        repair: strategy.orchestrator.routing.repair.filter(({ sourceId }) => sourceId !== id)
          .map((rule) => ({ ...rule, candidates: removeTargets(rule.candidates, id) }))
      }
    }
  };
  return {
    ...config,
    graph: { ...config.graph, strategy: nextStrategy, graphNodes: config.graph.graphNodes.filter((node) => node.id !== id) }
  };
};

const renameTargets = <T extends { target: ProjectGraphRouteTarget }>(entries: T[], from: string, to: string): T[] =>
  entries.map((entry) => "graphNodeId" in entry.target && entry.target.graphNodeId === from
    ? { ...entry, target: { graphNodeId: to } } : entry) as T[];
const removeTargets = <T extends { target: ProjectGraphRouteTarget }>(entries: T[], id: string): T[] =>
  entries.filter((entry) => !("graphNodeId" in entry.target && entry.target.graphNodeId === id));
