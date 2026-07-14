import type {
  Agent,
  LoopNodeStyle,
  ProjectAutomationConfig,
  ProjectLoop,
  ProjectScheduledStep,
  ProjectStep,
  ProjectStepTransitions,
  StepTransitionTarget
} from "@shared/api/workspace-contracts";
import { defaultTransitionFor, getProjectStepTransitionTargets, mapProjectStepTransitions } from "@shared/api/workspace-contracts";
import { defaultOnceSchedule } from "./loopSchedulePresentation";

export type TransitionTargetKind = "step" | "loop" | "end";

export const createLoopDraft = (): ProjectLoop => ({ id: "", start: "", steps: [] });

export const addFirstStep = (loop: ProjectLoop, agents: Agent[]): ProjectLoop => {
  if (loop.steps.length > 0) return loop;
  const step = defaultStep("new-step", agents);
  return { ...loop, start: step.id, steps: [step] };
};

export const insertStepForTransition = (
  loop: ProjectLoop,
  sourceStepId: string,
  result: "approved" | "rejected",
  agents: Agent[]
): ProjectLoop => {
  const sourceIndex = loop.steps.findIndex((step) => step.id === sourceStepId);
  const source = loop.steps[sourceIndex];
  if (!source) return loop;
  const id = uniqueStepId(loop, "new-step");
  const inheritedTarget = source.on[result];
  const step = agents[0]
    ? agentStep(id, agents[0].id, "", { approved: inheritedTarget, rejected: defaultTransitionFor("rejected") })
    : humanStep(id, "", { approved: inheritedTarget, rejected: defaultTransitionFor("rejected") });
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
        rejected: (target) => target === previousId ? step.id : target
      });
    })
  };
};

export const removeStep = (loop: ProjectLoop, stepId: string): ProjectLoop => {
  if (!canRemoveStep(loop, stepId)) return loop;
  const steps = loop.steps
    .filter((step) => step.id !== stepId)
    .map((step) => mapProjectStepTransitions(step, {
      approved: (target) => target === stepId ? defaultTransitionFor("approved") : target,
      rejected: (target) => target === stepId ? defaultTransitionFor("rejected") : target
    }));
  return { ...loop, steps, start: loop.start === stepId ? steps[0]?.id ?? "" : loop.start };
};

export const canRemoveStep = (loop: ProjectLoop, stepId: string) =>
  loop.steps.length > 1 && loop.steps.some((step) => step.id === stepId);

export const canChangeStepToScheduled = (loop: ProjectLoop, stepId: string) =>
  loop.start === stepId
  && !loop.steps.some((step) => step.id !== stepId && step.type === "scheduled")
  && !loop.steps.some((step) => getProjectStepTransitionTargets(step).includes(stepId));

export const changeStepType = (step: ProjectStep, type: ProjectStep["type"], options: {
  loop: ProjectLoop;
  firstAgentId?: string;
  now?: Date;
}): ProjectStep => {
  if (type === step.type) return step;
  if (type === "scheduled") return scheduledStep(step, options.firstAgentId, options.now);
  if (type === "human") return humanStep(step.id, step.description, step.on, step.nodeStyle);
  const agentId = step.type === "scheduled" ? step.agentId : options.firstAgentId ?? "";
  return agentStep(step.id, agentId, step.description, localTransitions(step.on), step.nodeStyle);
};

export const updateLoopAtIndex = (config: ProjectAutomationConfig, index: number, loop: ProjectLoop): ProjectAutomationConfig => {
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
          approved: (target) => replaceLoopTarget(target, previous.id, loop.id, "approved"),
          rejected: (target) => replaceLoopTarget(target, previous.id, loop.id, "rejected")
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
        approved: (target) => replaceLoopTarget(target, removed.id, undefined, "approved"),
        rejected: (target) => replaceLoopTarget(target, removed.id, undefined, "rejected")
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

const defaultOn = (): ProjectStepTransitions => ({
  approved: defaultTransitionFor("approved"),
  rejected: defaultTransitionFor("rejected")
});

const defaultStep = (id: string, agents: Agent[]): ProjectStep => {
  const firstAgent = agents[0];
  return firstAgent ? agentStep(id, firstAgent.id) : humanStep(id);
};

const agentStep = (id: string, agentId: string, description = "", on = defaultOn(), nodeStyle: LoopNodeStyle = "flat"): ProjectStep =>
  ({ id, type: "agent", agentId, description, nodeStyle, on });

const humanStep = (id: string, description = "", on = defaultOn(), nodeStyle: LoopNodeStyle = "flat"): ProjectStep =>
  ({ id, type: "human", description, nodeStyle, on });

const scheduledStep = (step: ProjectStep, firstAgentId?: string, now?: Date): ProjectScheduledStep => ({
  id: step.id,
  type: "scheduled",
  agentId: step.type === "agent" || step.type === "scheduled" ? step.agentId : firstAgentId ?? "",
  description: step.description,
  nodeStyle: step.nodeStyle,
  schedule: step.type === "scheduled" ? step.schedule : defaultOnceSchedule(now),
  on: localTransitions(step.on)
});

const localTransitions = (on: ProjectStepTransitions): ProjectStepTransitions => ({
  approved: isLoopTarget(on.approved) ? defaultTransitionFor("approved") : on.approved,
  rejected: isLoopTarget(on.rejected) ? defaultTransitionFor("rejected") : on.rejected
});

const isLoopTarget = (target: StepTransitionTarget): target is { loop: string } =>
  typeof target === "object" && "loop" in target;

const replaceLoopTarget = (
  target: StepTransitionTarget,
  previousId: string,
  nextId: string | undefined,
  output: "approved" | "rejected"
): StepTransitionTarget => {
  if (!isLoopTarget(target) || target.loop !== previousId) return target;
  return nextId ? { loop: nextId } : defaultTransitionFor(output);
};
