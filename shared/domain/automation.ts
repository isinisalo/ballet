export const projectConfigurationVersion = 11 as const;
export const maxProjectStateBytes = 262_144;
export const maxLocalAttemptsLimit = 100;
export const maxRepairDepthLimit = 32;
export const maxRepairAttemptsLimit = 100;
export const maxLoopCapabilities = 64;
export const maxLoopCapabilityLength = 200;
export const loopCapabilityPattern = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*:[a-z][a-z0-9]*(?:[._/-][a-z0-9]+)*$/;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export const loopTerminals = ["completed", "blocked", "failed"] as const;
export type LoopTerminal = (typeof loopTerminals)[number];

export const loopNodeSizes = ["tiny", "small", "medium", "large"] as const;
export type LoopNodeSize = (typeof loopNodeSizes)[number];
export type LoopNodePixels = 24 | 36 | 48 | 64;

export interface LoopNodeSizeDefinition {
  label: string;
  pixels: LoopNodePixels;
}

export const loopNodeSizeCatalog: Readonly<Record<LoopNodeSize, LoopNodeSizeDefinition>> = {
  tiny: { label: "Tiny", pixels: 24 },
  small: { label: "Small", pixels: 36 },
  medium: { label: "Medium", pixels: 48 },
  large: { label: "Large", pixels: 64 }
};

export const loopNodeStyles = ["flat", "luna", "mars", "terra", "sol", "vector-planet"] as const;
export type LoopNodeStyle = (typeof loopNodeStyles)[number];
export type LoopNodeStyleGroup = "classic" | "planet";

export interface LoopNodeStyleDefinition {
  label: string;
  group: LoopNodeStyleGroup;
}

export const loopNodeStyleCatalog: Readonly<Record<LoopNodeStyle, LoopNodeStyleDefinition>> = {
  flat: { label: "Flat", group: "classic" },
  luna: { label: "Luna", group: "classic" },
  mars: { label: "Mars", group: "classic" },
  terra: { label: "Terra", group: "classic" },
  sol: { label: "Sol", group: "classic" },
  "vector-planet": { label: "Vector planet", group: "planet" }
};

export const defaultLoopNodeStyle: LoopNodeStyle = "flat";
export const defaultLoopNodeSize: LoopNodeSize = "medium";

export interface ProjectNodeAppearance {
  nodeStyle: LoopNodeStyle;
  nodeSize: LoopNodeSize;
}

export interface ProjectExecutionComposition {
  executionProfileId: string;
  primaryInstructionId: string;
  skillIds: string[];
}

export type ProjectScheduleWeekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export type ProjectScheduleCadence = "daily" | "weekdays" | "weekly" | "monthly";

interface ProjectWorkScheduleBase {
  time: string;
  timeZone: string;
}

export interface ProjectOnceWorkSchedule extends ProjectWorkScheduleBase {
  kind: "once";
  date: string;
}

interface ProjectRecurringWorkScheduleBase extends ProjectWorkScheduleBase {
  kind: "recurring";
  startsOn: string;
}

export interface ProjectDailyWorkSchedule extends ProjectRecurringWorkScheduleBase {
  cadence: "daily";
}

export interface ProjectWeekdaysWorkSchedule extends ProjectRecurringWorkScheduleBase {
  cadence: "weekdays";
}

export interface ProjectWeeklyWorkSchedule extends ProjectRecurringWorkScheduleBase {
  cadence: "weekly";
  weekdays: ProjectScheduleWeekday[];
}

export interface ProjectMonthlyWorkSchedule extends ProjectRecurringWorkScheduleBase {
  cadence: "monthly";
  dayOfMonth: number;
}

export type ProjectRecurringWorkSchedule =
  | ProjectDailyWorkSchedule
  | ProjectWeekdaysWorkSchedule
  | ProjectWeeklyWorkSchedule
  | ProjectMonthlyWorkSchedule;

export type ProjectWorkSchedule = ProjectOnceWorkSchedule | ProjectRecurringWorkSchedule;

interface ProjectWorkNodeBase extends ProjectNodeAppearance {
  task: string;
}

export interface ProjectAgentWorkNode extends ProjectWorkNodeBase, ProjectExecutionComposition {
  type: "agent";
}

export interface ProjectHumanWorkNode extends ProjectWorkNodeBase {
  type: "human";
  executionProfileId?: never;
  primaryInstructionId?: never;
  skillIds?: never;
}

export interface ProjectScheduledWorkNode extends ProjectWorkNodeBase, ProjectExecutionComposition {
  type: "scheduled";
  schedule: ProjectWorkSchedule;
}

export type ProjectProviderWorkNode = ProjectAgentWorkNode | ProjectScheduledWorkNode;
export type ProjectWorkNode = ProjectProviderWorkNode | ProjectHumanWorkNode;

interface ProjectValidationNodeBase extends ProjectNodeAppearance {
  task: string;
}

export interface ProjectAgentValidationNode extends ProjectValidationNodeBase, ProjectExecutionComposition {
  type: "agent";
}

export interface ProjectHumanValidationNode extends ProjectValidationNodeBase {
  type: "human";
  executionProfileId?: never;
  primaryInstructionId?: never;
  skillIds?: never;
}

export type ProjectValidationNode = ProjectAgentValidationNode | ProjectHumanValidationNode;

export interface ProjectWorkLoopNode {
  id: string;
  description: string;
  work: ProjectWorkNode;
  validation: ProjectValidationNode;
  /** Total Work/Validation attempts, including the initial attempt. */
  maxLocalAttempts: number;
}

export type ProjectNodeEdgeTarget =
  | { nodeId: string }
  | { terminal: LoopTerminal };

export interface ProjectNodeEdge {
  id: string;
  source: string;
  target: ProjectNodeEdgeTarget;
}

export type ProjectLoopEdgeKind = "flow" | "repair";

export interface ProjectLoopEdge {
  id: string;
  source: string;
  target: string;
  kind: ProjectLoopEdgeKind;
  capability: string;
  description: string;
}

export interface ProjectGraph {
  loopEdges: ProjectLoopEdge[];
}

export interface ProjectLoopCapabilities {
  accepts: string[];
  provides: string[];
}

export interface ProjectLoopState {
  description: string;
  initial: JsonValue;
}

export interface ProjectLoop {
  id: string;
  description: string;
  capabilities: ProjectLoopCapabilities;
  state: ProjectLoopState;
  startNodeId: string;
  nodes: ProjectWorkLoopNode[];
  edges: ProjectNodeEdge[];
}

export interface ProjectLoopOrchestrator extends ProjectExecutionComposition {
  maxRepairDepth: number;
  maxRepairAttempts: number;
}

export interface ProjectAutomationConfig {
  version: typeof projectConfigurationVersion;
  orchestrator: ProjectLoopOrchestrator;
  graph: ProjectGraph;
  loops: ProjectLoop[];
}

export const defaultProjectLoopOrchestrator = (): ProjectLoopOrchestrator => ({
  executionProfileId: "",
  primaryInstructionId: "",
  skillIds: [],
  maxRepairDepth: 4,
  maxRepairAttempts: 3
});

export const defaultProjectAutomationConfig = (): ProjectAutomationConfig => ({
  version: projectConfigurationVersion,
  orchestrator: defaultProjectLoopOrchestrator(),
  graph: { loopEdges: [] },
  loops: [],
});

export const isProjectProviderWorkNode = (node: ProjectWorkNode): node is ProjectProviderWorkNode =>
  node.type === "agent" || node.type === "scheduled";

export const isProjectHumanWorkNode = (node: ProjectWorkNode): node is ProjectHumanWorkNode =>
  node.type === "human";

export const isProjectScheduledWorkNode = (node: ProjectWorkNode): node is ProjectScheduledWorkNode =>
  node.type === "scheduled";

export const isProjectAgentValidationNode = (
  node: ProjectValidationNode
): node is ProjectAgentValidationNode => node.type === "agent";

export const isProjectHumanValidationNode = (
  node: ProjectValidationNode
): node is ProjectHumanValidationNode => node.type === "human";

export const isProjectNodeTerminalTarget = (
  target: ProjectNodeEdgeTarget
): target is { terminal: LoopTerminal } => "terminal" in target;

export const resolveProjectLoopStartNode = (loop: ProjectLoop): ProjectWorkLoopNode | undefined =>
  loop.nodes.find((node) => node.id === loop.startNodeId);

export const getProjectNodeEdges = (
  loop: ProjectLoop,
  sourceNodeId?: string
): ProjectNodeEdge[] => sourceNodeId === undefined
  ? [...loop.edges]
  : loop.edges.filter((edge) => edge.source === sourceNodeId);

export const getProjectLoopEdges = (
  config: Pick<ProjectAutomationConfig, "graph">,
  sourceLoopId?: string,
  kind?: ProjectLoopEdgeKind
): ProjectLoopEdge[] => config.graph.loopEdges.filter((edge) =>
  (sourceLoopId === undefined || edge.source === sourceLoopId)
  && (kind === undefined || edge.kind === kind));

export const isAllowedProjectRepairRoute = (
  config: Pick<ProjectAutomationConfig, "graph">,
  sourceLoopId: string,
  loopEdgeId: string
): boolean => getProjectLoopEdges(config, sourceLoopId, "repair")
  .some((edge) => edge.id === loopEdgeId);

export const getProjectNodeTargetId = (target: ProjectNodeEdgeTarget): string | undefined =>
  "nodeId" in target ? target.nodeId : undefined;

export const getReachableProjectNodeIds = (loop: ProjectLoop): Set<string> => {
  const reachable = new Set<string>();
  const pending = [loop.startNodeId];
  while (pending.length > 0) {
    const nodeId = pending.shift();
    if (!nodeId || reachable.has(nodeId)) continue;
    reachable.add(nodeId);
    for (const edge of getProjectNodeEdges(loop, nodeId)) {
      const targetNodeId = getProjectNodeTargetId(edge.target);
      if (targetNodeId && !reachable.has(targetNodeId)) pending.push(targetNodeId);
    }
  }
  return reachable;
};

export const getReachableProjectLoopIds = (
  config: Pick<ProjectAutomationConfig, "graph">,
  startLoopId: string,
  maxRepairDepth: number
): Set<string> => getReachableProjectLoopGraph(config, startLoopId, maxRepairDepth).loopIds;

export interface ReachableProjectLoopGraph {
  loopIds: Set<string>;
  loopEdgeIds: Set<string>;
  minimumRepairDepthByLoopId: Map<string, number>;
}

/**
 * Computes every statically usable Loop route. Flow Edges preserve the repair
 * depth and Repair Edges consume one level, so cycles terminate while a Loop
 * can still be revisited at a shallower, more permissive depth.
 */
export const getReachableProjectLoopGraph = (
  config: Pick<ProjectAutomationConfig, "graph">,
  startLoopId: string,
  maxRepairDepth: number
): ReachableProjectLoopGraph => {
  if (!Number.isInteger(maxRepairDepth) || maxRepairDepth < 0 || maxRepairDepth > maxRepairDepthLimit) {
    throw new Error(`maxRepairDepth must be an integer between 0 and ${maxRepairDepthLimit}.`);
  }
  const minimumRepairDepthByLoopId = new Map<string, number>([[startLoopId, 0]]);
  const loopEdgeIds = new Set<string>();
  const pending: Array<{ loopId: string; repairDepth: number }> = [{ loopId: startLoopId, repairDepth: 0 }];
  while (pending.length > 0) {
    const current = pending.shift();
    if (!current || minimumRepairDepthByLoopId.get(current.loopId) !== current.repairDepth) continue;
    for (const edge of getProjectLoopEdges(config, current.loopId)) {
      if (edge.kind === "repair" && current.repairDepth >= maxRepairDepth) continue;
      const targetDepth = current.repairDepth + (edge.kind === "repair" ? 1 : 0);
      loopEdgeIds.add(edge.id);
      const previousDepth = minimumRepairDepthByLoopId.get(edge.target);
      if (previousDepth === undefined || targetDepth < previousDepth) {
        minimumRepairDepthByLoopId.set(edge.target, targetDepth);
        pending.push({ loopId: edge.target, repairDepth: targetDepth });
      }
    }
  }
  return {
    loopIds: new Set(minimumRepairDepthByLoopId.keys()),
    loopEdgeIds,
    minimumRepairDepthByLoopId
  };
};

export const hasReachableProjectLoopTerminal = (loop: ProjectLoop): boolean => {
  const reachable = getReachableProjectNodeIds(loop);
  return loop.edges.some((edge) => reachable.has(edge.source) && isProjectNodeTerminalTarget(edge.target));
};

export const clockTimePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export const isCalendarDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

export const isIanaTimeZone = (value: string): boolean => {
  if (!value || /^[+-]\d{2}:\d{2}$/.test(value)) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
};

export interface ProjectAutomationIssue {
  path: string;
  message: string;
}
