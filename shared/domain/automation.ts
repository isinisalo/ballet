export const projectConfigurationVersion = 12 as const;
export const maxProjectStateBytes = 262_144;
export const maxJobRetriesLimit = 100;
export {
  getProjectFailEdges,
  getProjectLoopEdges,
  getProjectPassEdges,
  getProjectPassTargetJobId,
  getProjectValidationNode,
  getReachableProjectJobNodeIds,
  getReachableProjectLoopGraph,
  getReachableProjectLoopIds,
  hasReachableProjectWorkflowPass,
  isAllowedProjectRepairRoute,
  maxRepairDepthLimit,
  resolveProjectWorkflowStartJob,
  type ReachableProjectLoopGraph
} from "./automationReachability.js";
export const maxRepairAttemptsLimit = 100;
export const maxLoopCapabilities = 64;
export const maxLoopCapabilityLength = 200;
export const loopCapabilityPattern = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*:[a-z][a-z0-9]*(?:[._/-][a-z0-9]+)*$/;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export const workflowResults = ["PASS", "FAIL"] as const;
export type WorkflowResult = (typeof workflowResults)[number];

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

interface ProjectJobScheduleBase {
  time: string;
  timeZone: string;
}

export interface ProjectOnceJobSchedule extends ProjectJobScheduleBase {
  kind: "once";
  date: string;
}

interface ProjectRecurringJobScheduleBase extends ProjectJobScheduleBase {
  kind: "recurring";
  startsOn: string;
}

export interface ProjectDailyJobSchedule extends ProjectRecurringJobScheduleBase {
  cadence: "daily";
}

export interface ProjectWeekdaysJobSchedule extends ProjectRecurringJobScheduleBase {
  cadence: "weekdays";
}

export interface ProjectWeeklyJobSchedule extends ProjectRecurringJobScheduleBase {
  cadence: "weekly";
  weekdays: ProjectScheduleWeekday[];
}

export interface ProjectMonthlyJobSchedule extends ProjectRecurringJobScheduleBase {
  cadence: "monthly";
  dayOfMonth: number;
}

export type ProjectRecurringJobSchedule =
  | ProjectDailyJobSchedule
  | ProjectWeekdaysJobSchedule
  | ProjectWeeklyJobSchedule
  | ProjectMonthlyJobSchedule;

export type ProjectJobSchedule = ProjectOnceJobSchedule | ProjectRecurringJobSchedule;

interface ProjectJobNodeBase extends ProjectNodeAppearance {
  id: string;
  description: string;
  task: string;
  validationNodeId: string;
  /** Additional local executions after the first Job execution. */
  maxRetries: number;
}

export interface ProjectAgentJobNode extends ProjectJobNodeBase, ProjectExecutionComposition {
  type: "agent";
}

export interface ProjectHumanJobNode extends ProjectJobNodeBase {
  type: "human";
  executionProfileId?: never;
  primaryInstructionId?: never;
  skillIds?: never;
}

export interface ProjectScheduledJobNode extends ProjectJobNodeBase, ProjectExecutionComposition {
  type: "scheduled";
  schedule: ProjectJobSchedule;
}

export type ProjectProviderJobNode = ProjectAgentJobNode | ProjectScheduledJobNode;
export type ProjectJobNode = ProjectProviderJobNode | ProjectHumanJobNode;

interface ProjectValidationNodeBase extends ProjectNodeAppearance {
  id: string;
  description: string;
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

export type ProjectPassEdgeTarget =
  | { jobNodeId: string }
  | { workflowResult: "PASS" };

export interface ProjectPassEdge {
  id: string;
  sourceValidationNodeId: string;
  target: ProjectPassEdgeTarget;
}

export interface ProjectFailEdge {
  id: string;
  sourceValidationNodeId: string;
  target: { workflowResult: "FAIL" };
}

export interface ProjectWorkflow {
  startJobNodeId: string;
  jobNodes: ProjectJobNode[];
  validationNodes: ProjectValidationNode[];
  passEdges: ProjectPassEdge[];
  failEdges: ProjectFailEdge[];
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
  workflow: ProjectWorkflow;
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

export const isProjectProviderJobNode = (node: ProjectJobNode): node is ProjectProviderJobNode =>
  node.type === "agent" || node.type === "scheduled";

export const isProjectHumanJobNode = (node: ProjectJobNode): node is ProjectHumanJobNode =>
  node.type === "human";

export const isProjectScheduledJobNode = (node: ProjectJobNode): node is ProjectScheduledJobNode =>
  node.type === "scheduled";

export const isProjectAgentValidationNode = (
  node: ProjectValidationNode
): node is ProjectAgentValidationNode => node.type === "agent";

export const isProjectHumanValidationNode = (
  node: ProjectValidationNode
): node is ProjectHumanValidationNode => node.type === "human";

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
