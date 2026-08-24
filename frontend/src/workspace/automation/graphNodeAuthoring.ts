import type {
  ProjectAutomationConfig,
  ProjectGraphNode,
  ProjectActionNode,
  ProjectScopedRewardDecisionStrategyV4
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

export const createGenericGraphNode = (input: NodeInput): ProjectGraphNode => {
  const action = createGenericActionNode({
    ...input,
    id: `${input.id}-action`,
    description: `Action for ${input.id}.`
  });
  const passOutcomeId = `${input.id}-complete`;
  const failOutcomeId = `${input.id}-failed`;
  return {
    id: input.id,
    description: input.description,
    capabilities: { accepts: [], provides: [] },
    outcomes: [
      { outcomeId: passOutcomeId, result: "PASS", acceptanceEffects: [] },
      { outcomeId: failOutcomeId, result: "FAIL", acceptanceEffects: [] }
    ],
    stateContract: { description: "Uses the bounded Graph State and acceptance-ledger contracts." },
    strategy: {
      kind: "reward_mdp_v4",
      id: `${input.id}-local-reward-mdp`,
      description: `Selects ${input.id} Action Nodes from its local Reward-MDP.`,
      model: {
        version: 4,
        initialStateId: action.id,
        discountPpm: 990_000,
        reward: {
          actionCostMicros: 1_000_000,
          terminalSuccessBonusMicros: 5_000_000,
          acceptanceProgressPotentialScaleMicros: 0,
          outcomePenaltyMicros: {
            none: 0,
            transient: 2_000_000,
            implementation_defect: 5_000_000,
            invalid_plan: 12_000_000,
            invalid_design: 25_000_000
          }
        },
        stateActions: [{
          stateId: action.id,
          actionId: action.id,
          guards: [],
          successors: [
            {
              outcomeId: action.outcomes[0]!.outcomeId,
              target: { kind: "terminal", terminal: "success", emitOutcomeId: passOutcomeId },
              probabilityPpm: 800_000,
              provenance: "default_prior",
              penaltyClass: "none"
            },
            {
              outcomeId: action.outcomes[1]!.outcomeId,
              target: { kind: "terminal", terminal: "failure", emitOutcomeId: failOutcomeId },
              probabilityPpm: 200_000,
              provenance: "default_prior",
              penaltyClass: "implementation_defect"
            }
          ]
        }],
        solver: {
          algorithm: "discounted_value_iteration_v4",
          maxIterations: 10_000,
          convergenceToleranceMicros: 1
        }
      }
    },
    actionNodes: [action]
  };
};

export const addGraphNode = (config: ProjectAutomationConfig, node: ProjectGraphNode): ProjectAutomationConfig => ({
  ...config,
  graph: { ...config.graph, graphNodes: [...config.graph.graphNodes, node] }
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
    strategy: renameScopeNode(config.graph.strategy, from, to)
  }
});

export const removeGraphNode = (config: ProjectAutomationConfig, id: string): ProjectAutomationConfig =>
  graphNodeReferences(config, id).length ? config : ({
    ...config,
    graph: { ...config.graph, graphNodes: config.graph.graphNodes.filter((candidate) => candidate.id !== id) }
  });

export const addActionNode = (config: ProjectAutomationConfig, graphNodeId: string, action: ProjectActionNode) =>
  updateGraphNode(config, graphNodeId, (node) => ({ ...node, actionNodes: [...node.actionNodes, action] }));

export const renameActionNode = (
  config: ProjectAutomationConfig,
  graphNodeId: string,
  from: string,
  to: string
) => updateGraphNode(config, graphNodeId, (node) => ({
  ...node,
  actionNodes: node.actionNodes.map((action) => action.id === from ? { ...action, id: to } : action),
  strategy: renameScopeNode(node.strategy, from, to)
}));

export const removeActionNode = (config: ProjectAutomationConfig, graphNodeId: string, id: string) =>
  updateGraphNode(config, graphNodeId, (node) => actionNodeReferences(node, id).length ? node : ({
    ...node,
    actionNodes: node.actionNodes.filter((action) => action.id !== id)
  }));

export const graphNodeReferences = (config: ProjectAutomationConfig, graphNodeId: string): string[] =>
  policyReferences(config.graph.strategy, graphNodeId, "graph.strategy");

export const actionNodeReferences = (node: ProjectGraphNode, actionNodeId: string): string[] =>
  policyReferences(node.strategy, actionNodeId, `${node.id}.strategy`);

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

const renameScopeNode = (
  strategy: ProjectScopedRewardDecisionStrategyV4,
  from: string,
  to: string
): ProjectScopedRewardDecisionStrategyV4 => ({
  ...strategy,
  model: {
    ...strategy.model,
    initialStateId: strategy.model.initialStateId === from ? to : strategy.model.initialStateId,
    stateActions: strategy.model.stateActions.map((row) => ({
      ...row,
      stateId: row.stateId === from ? to : row.stateId,
      actionId: row.actionId === from ? to : row.actionId,
      successors: row.successors.map((branch) => ({
        ...branch,
        target: branch.target.kind === "state" && branch.target.stateId === from
          ? { kind: "state", stateId: to } : branch.target
      }))
    }))
  }
});

const policyReferences = (
  strategy: ProjectScopedRewardDecisionStrategyV4,
  nodeId: string,
  prefix: string
): string[] => {
  const references = strategy.model.initialStateId === nodeId ? [`${prefix}.model.initialStateId`] : [];
  strategy.model.stateActions.forEach((row, rowIndex) => {
    if (row.stateId === nodeId) references.push(`${prefix}.model.stateActions.${rowIndex}.stateId`);
    if (row.actionId === nodeId) references.push(`${prefix}.model.stateActions.${rowIndex}.actionId`);
    row.successors.forEach((branch, branchIndex) => {
      if (branch.target.kind === "state" && branch.target.stateId === nodeId) {
        references.push(`${prefix}.model.stateActions.${rowIndex}.successors.${branchIndex}.target.stateId`);
      }
    });
  });
  return references;
};
