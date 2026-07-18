import type { AgentOutcomeStatus, HumanDecision } from "./outcomes.js";

export type ProjectStepTransitionId = AgentOutcomeStatus | HumanDecision;
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

export interface ProjectHumanStepTransitions {
  approved: StepTransitionTarget;
  rejected: StepTransitionTarget;
}

export type ChangesRequestedTransition =
  | { repair: string }
  | { terminate: "blocked" };

export type NeedsInputTransition =
  | { human: string }
  | { wait: true };

export interface ProjectAgentStepTransitions {
  ready: StepTransitionTarget;
  approved: StepTransitionTarget;
  "changes-requested": ChangesRequestedTransition;
  needs_input: NeedsInputTransition;
  blocked: { terminal: "blocked" };
  failed: {
    terminal: "failed";
    retry?: { when: "transient"; limit: 1 };
  };
}

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

export type ProjectStepTransitionEntry = readonly [ProjectStepTransitionId, StepTransitionTarget];

export function getProjectStepTransitionEntries(step: ProjectStep): ProjectStepTransitionEntry[] {
  if (step.type === "human") return [["approved", step.on.approved], ["rejected", step.on.rejected]];
  const changesRequested = "repair" in step.on["changes-requested"]
    ? step.on["changes-requested"].repair
    : "blocked";
  const needsInput = "human" in step.on.needs_input
    ? [["needs_input", step.on.needs_input.human] as const]
    : [];
  return [
    ["ready", step.on.ready],
    ["approved", step.on.approved],
    ["changes-requested", changesRequested],
    ...needsInput,
    ["blocked", "blocked"],
    ["failed", "failed"]
  ];
}

export function getProjectStepTransitionTargets(step: ProjectStep): StepTransitionTarget[] {
  return getProjectStepTransitionEntries(step).map(([, target]) => target);
}

export interface ProjectStepTransitionMappers {
  ready?: (target: StepTransitionTarget) => StepTransitionTarget | undefined;
  approved?: (target: StepTransitionTarget) => StepTransitionTarget | undefined;
  rejected?: (target: StepTransitionTarget) => StepTransitionTarget | undefined;
  "changes-requested"?: (target: StepTransitionTarget) => StepTransitionTarget | undefined;
  needs_input?: (target: StepTransitionTarget) => StepTransitionTarget | undefined;
}

export function mapProjectStepTransitions<T extends ProjectStep>(
  step: T,
  mappers: ProjectStepTransitionMappers
): T {
  if (step.type === "human") {
    const approved = mappers.approved ? mappers.approved(step.on.approved) ?? "completed" : step.on.approved;
    const rejected = mappers.rejected ? mappers.rejected(step.on.rejected) ?? "blocked" : step.on.rejected;
    return { ...step, on: { approved, rejected } } as T;
  }
  const ready = mappers.ready ? mappers.ready(step.on.ready) ?? "completed" : step.on.ready;
  const approved = mappers.approved ? mappers.approved(step.on.approved) ?? "completed" : step.on.approved;
  const changes = step.on["changes-requested"];
  const mappedRepair = "repair" in changes && mappers["changes-requested"]
    ? mappers["changes-requested"](changes.repair)
    : "repair" in changes ? changes.repair : undefined;
  const changesRequested = typeof mappedRepair === "string" ? { repair: mappedRepair } : { terminate: "blocked" as const };
  const needs = step.on.needs_input;
  const mappedHuman = "human" in needs && mappers.needs_input
    ? mappers.needs_input(needs.human)
    : "human" in needs ? needs.human : undefined;
  const needsInput = typeof mappedHuman === "string" ? { human: mappedHuman } : { wait: true as const };
  return {
    ...step,
    on: {
      ...step.on,
      ready,
      approved,
      "changes-requested": changesRequested,
      needs_input: needsInput
    }
  } as T;
}

export const defaultTransitionFor = (output: HumanDecision | "ready" | "approved"): StepTransitionTarget =>
  output === "rejected" ? "blocked" : "completed";

export const defaultAgentStepTransitions = (): ProjectAgentStepTransitions => ({
  ready: "completed",
  approved: "completed",
  "changes-requested": { terminate: "blocked" },
  needs_input: { wait: true },
  blocked: { terminal: "blocked" },
  failed: { terminal: "failed", retry: { when: "transient", limit: 1 } }
});

export const defaultHumanStepTransitions = (): ProjectHumanStepTransitions => ({
  approved: "completed",
  rejected: "blocked"
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
