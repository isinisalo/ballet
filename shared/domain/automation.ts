import {
  agentOutcomeStatuses,
  humanDecisions,
  type AgentOutcomeStatus,
  type HumanDecision
} from "./outcomes.js";

export type ProjectStepTransitionId = AgentOutcomeStatus | HumanDecision;
export type StepEndStatus = "completed" | "blocked" | "failed";

export const MAX_ROOT_TRANSITIONS = 10_000;
export const MAX_TRANSITION_RETRY_ATTEMPTS = 1024;

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

export const transitionInputModes = ["current", "signal", "append-signal"] as const;
export type TransitionInputMode = (typeof transitionInputModes)[number];

export type GotoTransitionAction = {
  action: "goto";
  target: StepTransitionTarget;
  input?: TransitionInputMode;
};

export type TerminateTransitionAction = {
  action: "terminate";
  status: StepEndStatus;
};

export type WaitTransitionAction = {
  action: "wait";
  resume: "same-step" | { target: StepTransitionTarget };
  input?: TransitionInputMode;
};

export type TransitionFallbackAction =
  | GotoTransitionAction
  | TerminateTransitionAction
  | WaitTransitionAction;

export interface RetryTransitionPolicy {
  /** Maximum follow-up executions started by this retry action. */
  maxAttempts: number;
  onExhausted: TransitionFallbackAction;
  when?: { failureClassification: "transient" | "permanent" };
  stallDetection?: "same-evidence";
}

export type RetryTransitionAction = {
  action: "retry";
  target?: string;
  input?: TransitionInputMode;
  policy: RetryTransitionPolicy;
};

export type TransitionAction = TransitionFallbackAction | RetryTransitionAction;

export type ProjectHumanStepTransitions = Record<HumanDecision, TransitionAction>;
export type ProjectAgentStepTransitions = Record<AgentOutcomeStatus, TransitionAction>;

export type ProjectStepTransitions = ProjectAgentStepTransitions | ProjectHumanStepTransitions;

interface ProjectLoopNodeVisual {
  description: string;
  nodeStyle: LoopNodeStyle;
  nodeSize: LoopNodeSize;
}

interface ProjectStepBase<TTransitions extends ProjectStepTransitions> extends ProjectLoopNodeVisual {
  id: string;
  on: TTransitions;
}

export interface ProjectAgentStep extends ProjectStepBase<ProjectAgentStepTransitions> {
  type: "agent";
  agentId: string;
}

export interface ProjectHumanStep extends ProjectStepBase<ProjectHumanStepTransitions> {
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

export interface ProjectScheduledStep extends ProjectStepBase<ProjectAgentStepTransitions> {
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

export type ProjectStepTransitionEntry = readonly [ProjectStepTransitionId, TransitionAction];

export function getProjectStepTransitionEntries(step: ProjectStep): ProjectStepTransitionEntry[] {
  const signals = step.type === "human" ? humanDecisions : agentOutcomeStatuses;
  return signals.map((signal) => [signal, step.on[signal as keyof typeof step.on] as TransitionAction]);
}

export function getProjectStepTransitionTargets(step: ProjectStep): StepTransitionTarget[] {
  return getProjectStepTransitionEntries(step)
    .flatMap(([, action]) => getTransitionActionTargets(action, step.id));
}

export type ProjectStepTransitionMappers = Partial<Record<
  ProjectStepTransitionId,
  (target: StepTransitionTarget) => StepTransitionTarget | undefined
>>;

export function getTransitionActionTargets(
  action: TransitionAction,
  sourceStepId: string
): StepTransitionTarget[] {
  if (action.action === "goto") return [action.target];
  if (action.action === "terminate") return [action.status];
  if (action.action === "wait") {
    return [action.resume === "same-step" ? sourceStepId : action.resume.target];
  }
  return [
    action.target ?? sourceStepId,
    ...getTransitionActionTargets(action.policy.onExhausted, sourceStepId)
  ];
}

export function mapTransitionActionTargets(
  action: TransitionAction,
  mapper: (target: StepTransitionTarget) => StepTransitionTarget | undefined
): TransitionAction {
  if (action.action === "terminate") return action;
  if (action.action === "goto") {
    const target = mapper(action.target);
    return target ? { ...action, target } : { action: "terminate", status: "blocked" };
  }
  if (action.action === "wait") {
    if (action.resume === "same-step") return action;
    const target = mapper(action.resume.target);
    return target ? { ...action, resume: { target } } : { action: "terminate", status: "blocked" };
  }
  const mappedTarget = action.target ? mapper(action.target) : undefined;
  const onExhausted = mapTransitionActionTargets(
    action.policy.onExhausted,
    mapper
  ) as TransitionFallbackAction;
  if (action.target && typeof mappedTarget !== "string") return onExhausted;
  return {
    action: "retry",
    ...(typeof mappedTarget === "string" ? { target: mappedTarget } : {}),
    ...(action.input ? { input: action.input } : {}),
    policy: {
      ...action.policy,
      onExhausted
    }
  };
}

export function mapProjectStepTransitions<T extends ProjectStep>(
  step: T,
  mappers: ProjectStepTransitionMappers
): T {
  const entries = getProjectStepTransitionEntries(step).map(([signal, action]) => {
    const mapper = mappers[signal];
    return [signal, mapper ? mapTransitionActionTargets(action, mapper) : action] as const;
  });
  return { ...step, on: Object.fromEntries(entries) } as T;
}

export const gotoTransition = (
  target: StepTransitionTarget,
  input?: TransitionInputMode
): GotoTransitionAction => ({ action: "goto", target, ...(input ? { input } : {}) });

export const terminateTransition = (status: StepEndStatus): TerminateTransitionAction =>
  ({ action: "terminate", status });

export const defaultAgentStepTransitions = (): ProjectAgentStepTransitions => ({
  ready: gotoTransition("completed"),
  approved: gotoTransition("completed"),
  "changes-requested": terminateTransition("blocked"),
  needs_input: { action: "wait", resume: "same-step", input: "append-signal" },
  blocked: terminateTransition("blocked"),
  failed: {
    action: "retry",
    policy: {
      maxAttempts: 1,
      when: { failureClassification: "transient" },
      onExhausted: terminateTransition("failed")
    }
  }
});

export const defaultHumanStepTransitions = (): ProjectHumanStepTransitions => ({
  approved: gotoTransition("completed", "append-signal"),
  rejected: gotoTransition("blocked", "append-signal")
});

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
