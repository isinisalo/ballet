import type {
  ProjectAutomationConfig,
  ProjectGraphNode,
  ProjectActionNode,
  ProjectRewardDecisionStrategyV3
} from "@shared/api/workspace-contracts";

type NodeInput = {
  id: string;
  description: string;
  executionProfileId: string;
  primaryInstructionId: string;
};

export const createGenericActionNode = (input: NodeInput): ProjectActionNode => ({
  id: input.id,
  description: input.description,
  capabilities: { accepts: [], provides: [] },
  outcomes: [
    { outcomeId: `${input.id}-complete`, result: "PASS" },
    { outcomeId: `${input.id}-failed`, result: "FAIL" }
  ],
  maxRetries: 0,
  workNode: {
    id: `${input.id}-work`,
    type: "agent",
    description: "Take action",
    task: "Perform the configured capability action.",
    nodeStyle: "terra",
    nodeSize: "medium",
    executionProfileId: input.executionProfileId,
    primaryInstructionId: input.primaryInstructionId,
    skillIds: []
  },
  validationNode: {
    id: `${input.id}-validation`,
    type: "agent",
    description: "Verify result",
    task: "Verify the capability result and emit one configured semantic outcome.",
    nodeStyle: "luna",
    nodeSize: "medium",
    executionProfileId: input.executionProfileId,
    primaryInstructionId: input.primaryInstructionId,
    skillIds: []
  }
});

export const createGenericGraphNode = (input: NodeInput): ProjectGraphNode => ({
  id: input.id,
  description: input.description,
  capabilities: { accepts: [], provides: [] },
  outcomes: [
    { outcomeId: `${input.id}-complete`, result: "PASS" },
    { outcomeId: `${input.id}-failed`, result: "FAIL" }
  ],
  stateContract: { description: "Uses the bounded Graph State and acceptance-ledger contracts." },
  actionNodes: [createGenericActionNode({
    ...input,
    id: `${input.id}-action`,
    description: `Ordered action for ${input.id}.`
  })]
});

export const addGraphNode = (config: ProjectAutomationConfig, node: ProjectGraphNode): ProjectAutomationConfig => ({
  ...config,
  graph: {
    ...config.graph,
    graphNodes: [...config.graph.graphNodes, node],
    strategy: {
      ...config.graph.strategy,
      capabilityModel: {
        ...config.graph.strategy.capabilityModel,
        actions: [...config.graph.strategy.capabilityModel.actions, { actionId: node.id, guards: [] }],
        outcomes: [...config.graph.strategy.capabilityModel.outcomes, ...node.outcomes.map((outcome) => ({
          id: outcome.outcomeId,
          description: `${node.description}: ${outcome.outcomeId}`,
          result: outcome.result,
          penaltyClass: outcome.result === "PASS" ? "none" as const : "implementation_defect" as const
        }))]
      }
    }
  }
});

export const renameGraphNode = (
  config: ProjectAutomationConfig,
  from: string,
  to: string
): ProjectAutomationConfig => ({
  ...config,
  graph: {
    ...config.graph,
    graphNodes: config.graph.graphNodes.map((node) => node.id === from ? { ...node, id: to } : node),
    strategy: renameGraphAction(config.graph.strategy, from, to)
  }
});

export const removeGraphNode = (config: ProjectAutomationConfig, id: string): ProjectAutomationConfig => {
  const node = config.graph.graphNodes.find((candidate) => candidate.id === id);
  const removedOutcomeIds = new Set(node?.outcomes.map(({ outcomeId }) => outcomeId) ?? []);
  return {
    ...config,
    graph: {
      ...config.graph,
      graphNodes: config.graph.graphNodes.filter((candidate) => candidate.id !== id),
      strategy: {
        ...config.graph.strategy,
        capabilityModel: {
          ...config.graph.strategy.capabilityModel,
          actions: config.graph.strategy.capabilityModel.actions.filter(({ actionId }) => actionId !== id),
          outcomes: config.graph.strategy.capabilityModel.outcomes.filter(({ id: outcomeId }) => !removedOutcomeIds.has(outcomeId))
        },
        model: {
          ...config.graph.strategy.model,
          stateActions: config.graph.strategy.model.stateActions.filter(({ actionId }) => actionId !== id)
        }
      }
    }
  };
};

export const addActionNode = (config: ProjectAutomationConfig, graphNodeId: string, action: ProjectActionNode) =>
  updateGraphNode(config, graphNodeId, (node) => ({ ...node, actionNodes: [...node.actionNodes, action] }));

export const renameActionNode = (
  config: ProjectAutomationConfig,
  graphNodeId: string,
  from: string,
  to: string
) => updateGraphNode(config, graphNodeId, (node) => ({
  ...node,
  actionNodes: node.actionNodes.map((action) => action.id === from ? { ...action, id: to } : action)
}));

export const removeActionNode = (config: ProjectAutomationConfig, graphNodeId: string, id: string) =>
  updateGraphNode(config, graphNodeId, (node) => ({
    ...node,
    actionNodes: node.actionNodes.filter((action) => action.id !== id)
  }));

export const actionNodeReferences = (node: ProjectGraphNode, actionNodeId: string): string[] => {
  void node;
  void actionNodeId;
  return [];
};

const updateGraphNode = (
  config: ProjectAutomationConfig,
  id: string,
  update: (node: ProjectGraphNode) => ProjectGraphNode
): ProjectAutomationConfig => ({
  ...config,
  graph: {
    ...config.graph,
    graphNodes: config.graph.graphNodes.map((node) => node.id === id ? update(node) : node)
  }
});

const renameGraphAction = (
  strategy: ProjectRewardDecisionStrategyV3,
  from: string,
  to: string
): ProjectRewardDecisionStrategyV3 => ({
  ...strategy,
  capabilityModel: {
    ...strategy.capabilityModel,
    actions: strategy.capabilityModel.actions.map((action) => ({
      ...action,
      actionId: action.actionId === from ? to : action.actionId
    }))
  },
  model: {
    ...strategy.model,
    stateActions: strategy.model.stateActions.map((row) =>
      row.actionId === from ? { ...row, actionId: to } : row)
  }
});
