export const projectConfigurationVersion = 18 as const;
export const maxProjectStateBytes = 262_144;
export const maxActionRetriesLimit = 100;
export const maxProjectGraphNodes = 40;
export const maxGraphNodeActionNodes = 64;
export const maxNodeCapabilities = 64;
export const maxNodeCapabilityLength = 200;
export const nodeCapabilityPattern = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*:[a-z][a-z0-9]*(?:[._/-][a-z0-9]+)*$/;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export const nodeResults = ["PASS", "FAIL"] as const;
export type NodeResult = (typeof nodeResults)[number];

export const canvasNodeSizes = ["tiny", "small", "medium", "large"] as const;
export type CanvasNodeSize = (typeof canvasNodeSizes)[number];
export type CanvasNodePixels = 24 | 36 | 48 | 64;

export interface CanvasNodeSizeDefinition {
  label: string;
  pixels: CanvasNodePixels;
}

export const canvasNodeSizeCatalog: Readonly<Record<CanvasNodeSize, CanvasNodeSizeDefinition>> = {
  tiny: { label: "Tiny", pixels: 24 },
  small: { label: "Small", pixels: 36 },
  medium: { label: "Medium", pixels: 48 },
  large: { label: "Large", pixels: 64 }
};

export const canvasNodeStyles = ["flat", "luna", "mars", "terra", "sol", "vector-planet"] as const;
export type CanvasNodeStyle = (typeof canvasNodeStyles)[number];
export type CanvasNodeStyleGroup = "classic" | "planet";

export interface CanvasNodeStyleDefinition {
  label: string;
  group: CanvasNodeStyleGroup;
}

export const canvasNodeStyleCatalog: Readonly<Record<CanvasNodeStyle, CanvasNodeStyleDefinition>> = {
  flat: { label: "Flat", group: "classic" },
  luna: { label: "Luna", group: "classic" },
  mars: { label: "Mars", group: "classic" },
  terra: { label: "Terra", group: "classic" },
  sol: { label: "Sol", group: "classic" },
  "vector-planet": { label: "Vector planet", group: "planet" }
};

export const defaultCanvasNodeStyle: CanvasNodeStyle = "flat";
export const defaultCanvasNodeSize: CanvasNodeSize = "medium";

export interface ProjectNodeAppearance {
  nodeStyle: CanvasNodeStyle;
  nodeSize: CanvasNodeSize;
}

export interface ProjectExecutionComposition {
  executionProfileId: string;
  primaryInstructionId: string;
  skillIds: string[];
}

export interface ProjectNodeCapabilities {
  accepts: string[];
  provides: string[];
}

export interface ProjectIntrinsicOutcome {
  outcomeId: string;
  result: NodeResult;
}

export interface ProjectStateDefinition {
  description: string;
  initial: JsonValue;
}

export interface ProjectStateContract {
  description: string;
}

interface ProjectExecutableNodeBase extends ProjectNodeAppearance {
  id: string;
  description: string;
  task: string;
}

export interface ProjectAgentWorkNode extends ProjectExecutableNodeBase, ProjectExecutionComposition {
  type: "agent";
}

export interface ProjectHumanWorkNode extends ProjectExecutableNodeBase {
  type: "human";
  executionProfileId?: never;
  primaryInstructionId?: never;
  skillIds?: never;
}

export type ProjectWorkNode = ProjectAgentWorkNode | ProjectHumanWorkNode;

export interface ProjectAgentValidationNode extends ProjectExecutableNodeBase, ProjectExecutionComposition {
  type: "agent";
}

export interface ProjectHumanValidationNode extends ProjectExecutableNodeBase {
  type: "human";
  executionProfileId?: never;
  primaryInstructionId?: never;
  skillIds?: never;
}

export type ProjectValidationNode = ProjectAgentValidationNode | ProjectHumanValidationNode;

export interface ProjectActionNode {
  id: string;
  description: string;
  capabilities: ProjectNodeCapabilities;
  outcomes: ProjectIntrinsicOutcome[];
  /** Additional Work executions after the first Work execution. */
  maxRetries: number;
  workNode: ProjectWorkNode;
  validationNode: ProjectValidationNode;
}

export interface ProjectGraphNode {
  id: string;
  description: string;
  capabilities: ProjectNodeCapabilities;
  outcomes: ProjectIntrinsicOutcome[];
  stateContract: ProjectStateContract;
  actionNodes: ProjectActionNode[];
}

export interface ProjectGraph {
  id: string;
  name: string;
  state: ProjectStateDefinition;
  strategy: import("./decisionModel.js").ProjectRewardDecisionStrategyV3;
  graphNodes: ProjectGraphNode[];
}

export interface ProjectAutomationConfig {
  version: typeof projectConfigurationVersion;
  graph: ProjectGraph;
}

export const defaultProjectAutomationConfig = (): ProjectAutomationConfig => ({
  version: projectConfigurationVersion,
  graph: {
    id: "graph-engineering",
    name: "Graph Engineering",
    state: { description: "Shared immutable-snapshot Graph state.", initial: {} },
    strategy: {
      kind: "reward_mdp_v3",
      id: "graph-reward-mdp",
      description: "Selects Graph Nodes from a compiled discounted Reward-MDP policy.",
      capabilityModel: { version: 3, outcomes: [], actions: [] },
      model: {
        version: 3,
        discountPpm: 990_000,
        acceptance: { version: 1, obligations: [] },
        reward: {
          actionCostMicros: 1_000_000,
          completionBonusMicros: 25_000_000,
          progressPotentialScaleMicros: 100_000_000,
          outcomePenaltyMicros: {
            none: 0,
            transient: 2_000_000,
            implementation_defect: 5_000_000,
            invalid_plan: 12_000_000,
            invalid_design: 25_000_000
          }
        },
        features: [],
        states: [],
        stateActions: [],
        solver: {
          algorithm: "discounted_value_iteration_v3",
          maxIterations: 10_000,
          convergenceToleranceMicros: 1
        }
      }
    },
    graphNodes: []
  }
});

export const isProjectAgentWorkNode = (node: ProjectWorkNode): node is ProjectAgentWorkNode => node.type === "agent";
export const isProjectHumanWorkNode = (node: ProjectWorkNode): node is ProjectHumanWorkNode => node.type === "human";
export const isProjectAgentValidationNode = (
  node: ProjectValidationNode
): node is ProjectAgentValidationNode => node.type === "agent";
export const isProjectHumanValidationNode = (
  node: ProjectValidationNode
): node is ProjectHumanValidationNode => node.type === "human";

export interface ProjectAutomationIssue {
  path: string;
  message: string;
}
