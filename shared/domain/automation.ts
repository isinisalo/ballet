export type OutputId = "approved" | "rejected";
export type ProjectStepTransitionId = OutputId;
export type StepEndStatus = "completed" | "blocked" | "failed";

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

export const loopNodeStyles = [
  "flat",
  "luna",
  "mars",
  "terra",
  "sol",
  "vector-planet"
] as const;
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
export const defaultTerminalNodeSize: LoopNodeSize = "tiny";

export type StepTransitionTarget =
  | string
  | { loop: string };

export interface ProjectStepTransitions {
  approved: StepTransitionTarget;
  rejected: StepTransitionTarget;
}

interface ProjectLoopNodeVisual {
  description: string;
  nodeStyle: LoopNodeStyle;
  nodeSize: LoopNodeSize;
}

interface ProjectStepBase extends ProjectLoopNodeVisual {
  id: string;
  on: ProjectStepTransitions;
}

export interface ProjectAgentStep extends ProjectStepBase {
  type: "agent";
  agentId: string;
}

export interface ProjectHumanStep extends ProjectStepBase {
  type: "human";
  agentId?: never;
}

export type ProjectScheduleWeekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export type ProjectScheduleCadence = "daily" | "weekdays" | "weekly" | "monthly";

interface ProjectStepScheduleBase {
  time: string;
  timeZone: string;
}

export interface ProjectOnceStepSchedule extends ProjectStepScheduleBase {
  kind: "once";
  date: string;
}

interface ProjectRecurringStepScheduleBase extends ProjectStepScheduleBase {
  kind: "recurring";
  startsOn: string;
}

export interface ProjectDailyStepSchedule extends ProjectRecurringStepScheduleBase {
  cadence: "daily";
}

export interface ProjectWeekdaysStepSchedule extends ProjectRecurringStepScheduleBase {
  cadence: "weekdays";
}

export interface ProjectWeeklyStepSchedule extends ProjectRecurringStepScheduleBase {
  cadence: "weekly";
  weekdays: ProjectScheduleWeekday[];
}

export interface ProjectMonthlyStepSchedule extends ProjectRecurringStepScheduleBase {
  cadence: "monthly";
  dayOfMonth: number;
}

export type ProjectRecurringStepSchedule =
  | ProjectDailyStepSchedule
  | ProjectWeekdaysStepSchedule
  | ProjectWeeklyStepSchedule
  | ProjectMonthlyStepSchedule;

export type ProjectStepSchedule = ProjectOnceStepSchedule | ProjectRecurringStepSchedule;

export interface ProjectScheduledStep extends ProjectStepBase {
  type: "scheduled";
  schedule: ProjectStepSchedule;
  agentId: string;
}

export type ProjectAgentBackedStep = ProjectAgentStep | ProjectScheduledStep;
export type ProjectExecutableStep = ProjectAgentBackedStep | ProjectHumanStep;
export type ProjectStep = ProjectExecutableStep;
export type ProjectTerminalNode = {
  [Status in StepEndStatus]: ProjectLoopNodeVisual & { id: Status; type: Status }
}[StepEndStatus];
export type ProjectLoopNode = ProjectStep | ProjectTerminalNode;

export type ProjectStepTransitionEntry = readonly [OutputId, StepTransitionTarget];

export function getProjectStepTransitionEntries(step: ProjectStep): ProjectStepTransitionEntry[] {
  return [["approved", step.on.approved], ["rejected", step.on.rejected]];
}

export function getProjectStepTransitionTargets(step: ProjectStep): StepTransitionTarget[] {
  return getProjectStepTransitionEntries(step).map(([, target]) => target);
}

export interface ProjectStepTransitionMappers {
  approved?: (target: StepTransitionTarget) => StepTransitionTarget;
  rejected?: (target: StepTransitionTarget) => StepTransitionTarget;
}

export function mapProjectStepTransitions<T extends ProjectStep>(
  step: T,
  mappers: ProjectStepTransitionMappers
): T {
  const approved = mappers.approved?.(step.on.approved) ?? step.on.approved;
  const rejected = mappers.rejected?.(step.on.rejected) ?? step.on.rejected;
  return { ...step, on: { approved, rejected } };
}

export const defaultTransitionFor = (output: OutputId): StepTransitionTarget =>
  output === "approved" ? "completed" : "blocked";

export const isProjectAgentBackedStep = (step: ProjectStep): step is ProjectAgentBackedStep =>
  step.type === "agent" || step.type === "scheduled";

export const isProjectTerminalNode = (node: ProjectLoopNode): node is ProjectTerminalNode =>
  node.type === "completed" || node.type === "blocked" || node.type === "failed";

export const defaultTerminalNodes = (): ProjectTerminalNode[] => ([
  { id: "completed", type: "completed", description: "", nodeStyle: "flat", nodeSize: defaultTerminalNodeSize },
  { id: "blocked", type: "blocked", description: "", nodeStyle: "flat", nodeSize: defaultTerminalNodeSize },
  { id: "failed", type: "failed", description: "", nodeStyle: "flat", nodeSize: defaultTerminalNodeSize }
]);

export interface ProjectLoop {
  id: string;
  start: string;
  nodes: ProjectLoopNode[];
}

export const resolveEffectiveStartStep = (
  loop: ProjectLoop
): ProjectExecutableStep | undefined => {
  const node = loop.nodes.find((candidate) => candidate.id === loop.start);
  return node && !isProjectTerminalNode(node) ? node : undefined;
};

export interface ProjectAutomationConfig {
  version: 8;
  loops: ProjectLoop[];
}

export const defaultProjectAutomationConfig = (): ProjectAutomationConfig => ({
  version: 8,
  loops: []
});

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
