export const projectConfigurationVersion = 14 as const;
export const maxProjectStateBytes = 262_144;
export const maxJobRetriesLimit = 100;
export const maxProjectGraphNodes = 40;
export const maxGraphNodeJobNodes = 64;
export const maxOrchestratorTransitions = 256;
export const maxRouteAttemptsLimit = 3;
export const maxRepairAttemptsLimit = 100;
export const maxRepairDepthLimit = 100;
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

export interface ProjectJobNode extends ProjectNodeAppearance {
  id: string;
  description: string;
  capabilities: ProjectNodeCapabilities;
  /** Additional Work executions after the first Work execution. */
  maxRetries: number;
  workNode: ProjectWorkNode;
  validationNode: ProjectValidationNode;
}

export interface ProjectGraphNodeTarget { graphNodeId: string; }
export interface ProjectJobNodeTarget { jobNodeId: string; }
export interface ProjectTerminalTarget { terminal: NodeResult; }

export type ProjectGraphRouteTarget = ProjectGraphNodeTarget | ProjectTerminalTarget;
export type ProjectGraphNodeRouteTarget = ProjectJobNodeTarget | ProjectTerminalTarget;

export interface ProjectRouteCandidate<TTarget> {
  target: TTarget;
  description: string;
}

export interface ProjectStartCandidateRule<TTarget> {
  id: string;
  candidates: ProjectRouteCandidate<TTarget>[];
}

export interface ProjectContinuationCandidateRule<TTarget> {
  id: string;
  sourceId: string;
  result: NodeResult;
  candidates: ProjectRouteCandidate<TTarget>[];
}

export interface ProjectRepairCandidateRule<TTarget> {
  id: string;
  sourceId: string;
  capability: string;
  candidates: ProjectRouteCandidate<TTarget>[];
}

export interface ProjectCandidateRouting<TTarget> {
  start: ProjectStartCandidateRule<TTarget>;
  continuation: ProjectContinuationCandidateRule<TTarget>[];
  repair: ProjectRepairCandidateRule<TTarget>[];
}

export interface ProjectOrchestrator<TTarget> extends ProjectExecutionComposition, ProjectNodeAppearance {
  id: string;
  description: string;
  maxTransitions: number;
  maxRouteAttempts: number;
  routing: ProjectCandidateRouting<TTarget>;
}

export interface ProjectRepairNode extends ProjectExecutionComposition, ProjectNodeAppearance {
  id: string;
  description: string;
  task: string;
  maxRepairDepth: number;
  maxRepairAttempts: number;
}

export interface ProjectGraphNode extends ProjectNodeAppearance {
  id: string;
  description: string;
  capabilities: ProjectNodeCapabilities;
  stateContract: ProjectStateContract;
  orchestrator: ProjectOrchestrator<ProjectGraphNodeRouteTarget>;
  repairNode?: ProjectRepairNode;
  jobNodes: ProjectJobNode[];
}

export interface ProjectGraph {
  id: string;
  name: string;
  state: ProjectStateDefinition;
  orchestrator: ProjectOrchestrator<ProjectGraphRouteTarget>;
  repairNode?: ProjectRepairNode;
  graphNodes: ProjectGraphNode[];
}

export interface ProjectAutomationConfig {
  version: typeof projectConfigurationVersion;
  graph: ProjectGraph;
}

export const defaultProjectOrchestrator = <TTarget>(): ProjectOrchestrator<TTarget> => ({
  id: "orchestrator",
  description: "Selects the next allowed target from the immutable candidate set.",
  nodeStyle: "luna",
  nodeSize: "medium",
  executionProfileId: "",
  primaryInstructionId: "",
  skillIds: [],
  maxTransitions: maxOrchestratorTransitions,
  maxRouteAttempts: maxRouteAttemptsLimit,
  routing: {
    start: { id: "start", candidates: [] },
    continuation: [],
    repair: []
  }
});

export const defaultProjectAutomationConfig = (): ProjectAutomationConfig => ({
  version: projectConfigurationVersion,
  graph: {
    id: "graph-engineering",
    name: "Graph Engineering",
    state: { description: "Shared immutable-snapshot Graph state.", initial: {} },
    orchestrator: defaultProjectOrchestrator<ProjectGraphRouteTarget>(),
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

export const routeTargetKey = (target: ProjectGraphRouteTarget | ProjectGraphNodeRouteTarget): string => {
  if ("graphNodeId" in target) return `graph-node:${target.graphNodeId}`;
  if ("jobNodeId" in target) return `job-node:${target.jobNodeId}`;
  return `terminal:${target.terminal}`;
};

export interface ProjectAutomationIssue {
  path: string;
  message: string;
}
