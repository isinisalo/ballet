export type OutputId = "approved" | "rejected";
export type ProjectStepTransitionId = OutputId;
export type StepEndStatus = "completed" | "blocked" | "failed";

export const loopNodeSizes = ["tiny", "small", "medium", "large"] as const;
export type LoopNodeSize = (typeof loopNodeSizes)[number];

export const loopNodeStyles = [
  "flat",
  "luna",
  "black-hole",
  "satellite",
  "meteorite",
  "spaceman",
  "mars",
  "terra",
  "sol"
] as const;
export type LoopNodeStyle = (typeof loopNodeStyles)[number];
export type LoopNodePixels = 24 | 36 | 48 | 64;

export interface LoopNodeStyleDefinition {
  label: string;
  size: LoopNodeSize;
  pixels: LoopNodePixels;
}

export const loopNodeStyleCatalog: Readonly<Record<LoopNodeStyle, LoopNodeStyleDefinition>> = {
  flat: { label: "Flat", size: "medium", pixels: 48 },
  luna: { label: "Luna", size: "tiny", pixels: 24 },
  "black-hole": { label: "Black hole", size: "tiny", pixels: 24 },
  satellite: { label: "Satellite", size: "tiny", pixels: 24 },
  meteorite: { label: "Meteorite", size: "tiny", pixels: 24 },
  spaceman: { label: "Spaceman", size: "tiny", pixels: 24 },
  mars: { label: "Mars", size: "small", pixels: 36 },
  terra: { label: "Terra", size: "medium", pixels: 48 },
  sol: { label: "Sol", size: "large", pixels: 64 }
};

export const defaultLoopNodeStyle: LoopNodeStyle = "flat";

export type StepTransitionTarget =
  | string
  | { loop: string }
  | { end: StepEndStatus };

export interface ProjectStepTransitions {
  approved: StepTransitionTarget;
  rejected: StepTransitionTarget;
}

interface ProjectStepBase {
  id: string;
  description: string;
  nodeStyle: LoopNodeStyle;
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
  output === "approved" ? { end: "completed" } : { end: "blocked" };

export const isProjectAgentBackedStep = (step: ProjectStep): step is ProjectAgentBackedStep =>
  step.type === "agent" || step.type === "scheduled";

export interface ProjectLoop {
  id: string;
  start: string;
  steps: ProjectStep[];
}

export const resolveEffectiveStartStep = (
  loop: ProjectLoop
): ProjectExecutableStep | undefined => loop.steps.find((step) => step.id === loop.start);

export interface ProjectAutomationConfig {
  version: 7;
  loops: ProjectLoop[];
}

export const defaultProjectAutomationConfig = (): ProjectAutomationConfig => ({
  version: 7,
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
