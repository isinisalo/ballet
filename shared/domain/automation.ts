import type { LoopThemeId } from "./loopThemes.js";

export type OutputId = "approved" | "rejected";
export type ProjectStepTransitionId = OutputId | "triggered";
export type StepEndStatus = "completed" | "blocked" | "failed";

export const loopNodeSizes = ["small", "medium", "large"] as const;
export type LoopNodeSize = (typeof loopNodeSizes)[number];

export type StepTransitionTarget =
  | string
  | { loop: string }
  | { end: StepEndStatus };

export interface ProjectStepTransitions {
  approved: StepTransitionTarget;
  rejected: StepTransitionTarget;
}

export interface ProjectScheduledStepTransitions {
  triggered: string;
}

interface ProjectStepBase<TTransitions> {
  id: string;
  description: string;
  nodeSize: LoopNodeSize;
  on: TTransitions;
}

export interface ProjectAgentStep extends ProjectStepBase<ProjectStepTransitions> {
  type: "agent";
  agentId: string;
}

export interface ProjectHumanStep extends ProjectStepBase<ProjectStepTransitions> {
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

export interface ProjectScheduledStep extends ProjectStepBase<ProjectScheduledStepTransitions> {
  type: "scheduled";
  schedule: ProjectStepSchedule;
  agentId?: never;
}

export type ProjectExecutableStep = ProjectAgentStep | ProjectHumanStep;
export type ProjectStep = ProjectExecutableStep | ProjectScheduledStep;

export type ProjectStepTransitionEntry =
  | readonly [OutputId, StepTransitionTarget]
  | readonly ["triggered", string];

export function getProjectStepTransitionEntries(
  step: ProjectScheduledStep
): Array<readonly ["triggered", string]>;
export function getProjectStepTransitionEntries(
  step: ProjectExecutableStep
): Array<readonly [OutputId, StepTransitionTarget]>;
export function getProjectStepTransitionEntries(step: ProjectStep): ProjectStepTransitionEntry[];
export function getProjectStepTransitionEntries(step: ProjectStep): ProjectStepTransitionEntry[] {
  return step.type === "scheduled"
    ? [["triggered", step.on.triggered]]
    : [["approved", step.on.approved], ["rejected", step.on.rejected]];
}

export function getProjectStepTransitionTargets(step: ProjectScheduledStep): string[];
export function getProjectStepTransitionTargets(step: ProjectExecutableStep): StepTransitionTarget[];
export function getProjectStepTransitionTargets(step: ProjectStep): StepTransitionTarget[];
export function getProjectStepTransitionTargets(step: ProjectStep): StepTransitionTarget[] {
  return getProjectStepTransitionEntries(step).map(([, target]) => target);
}

export interface ProjectStepTransitionMappers {
  approved?: (target: StepTransitionTarget) => StepTransitionTarget;
  rejected?: (target: StepTransitionTarget) => StepTransitionTarget;
  triggered?: (target: string) => string;
}

export function mapProjectStepTransitions(
  step: ProjectScheduledStep,
  mappers: ProjectStepTransitionMappers
): ProjectScheduledStep;
export function mapProjectStepTransitions(
  step: ProjectExecutableStep,
  mappers: ProjectStepTransitionMappers
): ProjectExecutableStep;
export function mapProjectStepTransitions(
  step: ProjectStep,
  mappers: ProjectStepTransitionMappers
): ProjectStep;
export function mapProjectStepTransitions(
  step: ProjectStep,
  mappers: ProjectStepTransitionMappers
): ProjectStep {
  if (step.type === "scheduled") {
    const triggered = mappers.triggered?.(step.on.triggered) ?? step.on.triggered;
    return { ...step, on: { triggered } };
  }
  const approved = mappers.approved?.(step.on.approved) ?? step.on.approved;
  const rejected = mappers.rejected?.(step.on.rejected) ?? step.on.rejected;
  return { ...step, on: { approved, rejected } };
}

export const isProjectExecutableStep = (step: ProjectStep): step is ProjectExecutableStep =>
  step.type === "agent" || step.type === "human";

export interface ProjectLoop {
  id: string;
  theme: LoopThemeId;
  start: string;
  steps: ProjectStep[];
}

export const resolveEffectiveStartStep = (
  loop: ProjectLoop
): ProjectExecutableStep | undefined => {
  const configuredStart = loop.steps.find((step) => step.id === loop.start);
  if (!configuredStart) return undefined;
  if (isProjectExecutableStep(configuredStart)) return configuredStart;
  const target = loop.steps.find((step) => step.id === configuredStart.on.triggered);
  return target && isProjectExecutableStep(target) ? target : undefined;
};

export interface ProjectAutomationConfig {
  version: 6;
  loops: ProjectLoop[];
}

export const defaultProjectAutomationConfig = (): ProjectAutomationConfig => ({
  version: 6,
  loops: []
});

export interface ProjectAutomationIssue {
  path: string;
  message: string;
}

// Policies remain a Markdown document model. They are not part of automation v6
// execution or project.json routing.
export type PolicyPredicateOperator = "equals" | "in" | "exists";
export type PolicyPredicateScalar = string | number | boolean | null;

export interface PolicyPredicate {
  operator: PolicyPredicateOperator;
  value?: PolicyPredicateScalar | PolicyPredicateScalar[];
}

export interface PolicyMatch {
  eventTypes?: string[];
  projectId?: string | PolicyPredicate;
  source?: string | PolicyPredicate;
  subject?: string | PolicyPredicate;
  tags?: string[] | PolicyPredicate;
  payload?: Record<string, PolicyPredicate | PolicyPredicateScalar | PolicyPredicateScalar[]>;
}

export interface PolicyAction {
  type: "start_agent_run";
  targetAgentId: string;
}

export interface Policy {
  id: string;
  name: string;
  description: string;
  active: boolean;
  match?: PolicyMatch;
  action?: PolicyAction;
  projectId: string | "*";
  eventTypes: string[];
  source: string;
  payloadMetadata: Record<string, string>;
  targetAgentId: string;
  createdAt: string;
  updatedAt: string;
  frontmatter?: Record<string, unknown>;
  body?: string;
  relativePath?: string;
  slug?: string;
  errors?: string[];
}
