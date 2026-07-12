import type {
  Agent,
  LoopNodeSize,
  ProjectAutomationConfig,
  ProjectExecutableStep,
  ProjectLoop,
  ProjectScheduledStep,
  ProjectStep,
  ProjectStepTransitions,
  StepTransitionTarget
} from "@shared/api/workspace-contracts";
import { isProjectExecutableStep, mapProjectStepTransitions } from "@shared/api/workspace-contracts";
import { defaultOnceSchedule } from "./loopSchedulePresentation";

export type TransitionTargetKind = "step" | "loop" | "end";

export const createLoopDraft = (agents: Agent[]): ProjectLoop => {
  const firstAgent = agents[0];
  const step: ProjectStep = firstAgent
    ? agentStep("new-step", firstAgent.id)
    : humanStep("new-step");
  return { id: "", theme: "open-ai", start: step.id, steps: [step] };
};

export const insertStepForTransition = (
  loop: ProjectLoop,
  sourceStepId: string,
  result: "approved" | "rejected",
  agents: Agent[]
): ProjectLoop => {
  const sourceIndex = loop.steps.findIndex((step) => step.id === sourceStepId);
  const source = loop.steps[sourceIndex];
  if (!source || !isProjectExecutableStep(source)) return loop;
  const id = uniqueStepId(loop, "new-step");
  const inheritedTarget = source.on[result];
  const step = agents[0]
    ? agentStep(id, agents[0].id, "", { approved: inheritedTarget, rejected: { end: "failed" } })
    : humanStep(id, "", { approved: inheritedTarget, rejected: { end: "failed" } });
  const steps = [...loop.steps];
  steps.splice(sourceIndex + 1, 0, step);
  steps[sourceIndex] = { ...source, on: { ...source.on, [result]: id } } as ProjectStep;
  return { ...loop, steps };
};

export const reorderLoopSteps = (loop: ProjectLoop, fromIndex: number, toIndex: number): ProjectLoop => {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= loop.steps.length || toIndex >= loop.steps.length) return loop;
  const scheduledStartIndex = loop.steps.findIndex((step) => step.type === "scheduled");
  if (scheduledStartIndex >= 0 && (fromIndex === scheduledStartIndex || toIndex === scheduledStartIndex)) return loop;
  const steps = [...loop.steps];
  const [moved] = steps.splice(fromIndex, 1);
  if (!moved) return loop;
  steps.splice(toIndex, 0, moved);
  return { ...loop, steps, start: steps[0]?.id ?? loop.start };
};

export const replaceStep = (loop: ProjectLoop, previousId: string, step: ProjectStep): ProjectLoop => {
  const renamed = previousId !== step.id;
  return {
    ...loop,
    start: renamed && loop.start === previousId ? step.id : loop.start,
    steps: loop.steps.map((candidate) => {
      const next = candidate.id === previousId ? step : candidate;
      if (!renamed) return next;
      return mapProjectStepTransitions(next, {
        approved: (target) => target === previousId ? step.id : target,
        rejected: (target) => target === previousId ? step.id : target,
        triggered: (target) => target === previousId ? step.id : target
      });
    })
  };
};

export const removeStep = (loop: ProjectLoop, stepId: string): ProjectLoop => {
  if (!canRemoveStep(loop, stepId)) return loop;
  const removed = loop.steps.find((step) => step.id === stepId);
  const remaining = loop.steps.filter((step) => step.id !== stepId);
  const fallback = remaining.find(isProjectExecutableStep)?.id;
  const steps = remaining.map((step) => mapProjectStepTransitions(step, {
    approved: (target) => target === stepId ? { end: "blocked" as const } : target,
    rejected: (target) => target === stepId ? { end: "blocked" as const } : target,
    triggered: (target) => target === stepId ? fallback ?? target : target
  }));
  const scheduledTarget = removed?.type === "scheduled"
    ? steps.find((step) => step.id === removed.on.triggered && isProjectExecutableStep(step))?.id
    : undefined;
  return { ...loop, steps, start: loop.start === stepId ? scheduledTarget ?? steps[0]?.id ?? "" : loop.start };
};

export const canRemoveStep = (loop: ProjectLoop, stepId: string) => {
  if (loop.steps.length <= 1) return false;
  const scheduled = loop.steps.find((step) => step.type === "scheduled");
  if (!scheduled || scheduled.id === stepId) return true;
  return loop.steps.some((step) => step.id !== stepId && isProjectExecutableStep(step));
};

export const canChangeStepToScheduled = (loop: ProjectLoop, stepId: string) =>
  loop.start === stepId && loop.steps.some((step) => step.id !== stepId && isProjectExecutableStep(step));

export const changeStepType = (step: ProjectStep, type: ProjectStep["type"], options: {
  loop: ProjectLoop;
  firstAgentId?: string;
  now?: Date;
}): ProjectStep => {
  if (type === step.type) return step;
  if (type === "scheduled") return scheduledStep(step, options.loop, options.now);
  const previousOn: ProjectStepTransitions = step.type === "scheduled"
    ? { approved: step.on.triggered, rejected: { end: "failed" } }
    : step.on;
  if (type === "human") return humanStep(step.id, step.description, previousOn, step.nodeSize);
  const on = {
    approved: isLoopTarget(previousOn.approved) ? { end: "blocked" as const } : previousOn.approved,
    rejected: isLoopTarget(previousOn.rejected) ? { end: "blocked" as const } : previousOn.rejected
  };
  return agentStep(step.id, step.type === "agent" ? step.agentId : options.firstAgentId ?? "", step.description, on, step.nodeSize);
};

export const updateLoopAtIndex = (
  config: ProjectAutomationConfig,
  index: number,
  loop: ProjectLoop
): ProjectAutomationConfig => {
  const previous = config.loops[index];
  if (!previous) return config;
  const renamed = previous.id !== loop.id;
  return {
    ...config,
    loops: config.loops.map((candidate, candidateIndex) => {
      const next = candidateIndex === index ? loop : candidate;
      if (!renamed) return next;
      return {
        ...next,
        steps: next.steps.map((step) => mapProjectStepTransitions(step, {
          approved: (target) => replaceLoopTarget(target, previous.id, loop.id),
          rejected: (target) => replaceLoopTarget(target, previous.id, loop.id)
        }))
      };
    })
  };
};

export const removeLoopAtIndex = (config: ProjectAutomationConfig, index: number): ProjectAutomationConfig => {
  const removed = config.loops[index];
  if (!removed) return config;
  return {
    ...config,
    loops: config.loops.filter((_, candidateIndex) => candidateIndex !== index).map((loop) => ({
      ...loop,
      steps: loop.steps.map((step) => mapProjectStepTransitions(step, {
        approved: (target) => replaceLoopTarget(target, removed.id, undefined),
        rejected: (target) => replaceLoopTarget(target, removed.id, undefined)
      }))
    }))
  };
};

export const transitionTargetKind = (target: StepTransitionTarget): TransitionTargetKind =>
  typeof target === "string" ? "step" : "loop" in target ? "loop" : "end";

export const transitionTargetValue = (target: StepTransitionTarget): string =>
  typeof target === "string" ? target : "loop" in target ? target.loop : target.end;

export const transitionTarget = (kind: TransitionTargetKind, value: string): StepTransitionTarget => {
  if (kind === "step") return value;
  if (kind === "loop") return { loop: value };
  return { end: value as "completed" | "blocked" | "failed" };
};

const uniqueStepId = (loop: ProjectLoop, base: string) => {
  const ids = new Set(loop.steps.map((step) => step.id));
  if (!ids.has(base)) return base;
  let suffix = 2;
  while (ids.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
};

const terminal = { end: "failed" as const };
const defaultOn = () => ({ approved: terminal, rejected: terminal });

const agentStep = (
  id: string,
  agentId: string,
  description = "",
  on: ProjectStepTransitions = defaultOn(),
  nodeSize: LoopNodeSize = "medium"
): ProjectExecutableStep => ({ id, type: "agent", agentId, description, nodeSize, on });

const humanStep = (
  id: string,
  description = "",
  on: ProjectStepTransitions = defaultOn(),
  nodeSize: LoopNodeSize = "small"
): ProjectExecutableStep => ({ id, type: "human", description, nodeSize, on });

const scheduledStep = (step: ProjectStep, loop: ProjectLoop, now?: Date): ProjectScheduledStep => {
  const preferred = step.type !== "scheduled" && typeof step.on.approved === "string"
    ? loop.steps.find((candidate) => candidate.id === step.on.approved && candidate.id !== step.id && isProjectExecutableStep(candidate))
    : undefined;
  const target = step.type === "scheduled"
    ? step.on.triggered
    : preferred?.id ?? loop.steps.find((candidate) => candidate.id !== step.id && isProjectExecutableStep(candidate))?.id ?? "";
  return { id: step.id, type: "scheduled", description: step.description, nodeSize: step.nodeSize, schedule: defaultOnceSchedule(now), on: { triggered: target } };
};

const isLoopTarget = (target: StepTransitionTarget): target is { loop: string } =>
  typeof target === "object" && "loop" in target;

const replaceLoopTarget = (target: StepTransitionTarget, previousId: string, nextId?: string): StepTransitionTarget => {
  if (!isLoopTarget(target) || target.loop !== previousId) return target;
  return nextId ? { loop: nextId } : { end: "blocked" };
};
