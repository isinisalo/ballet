import type {
  Agent,
  ProjectAutomationConfig,
  ProjectLoop,
  ProjectStep,
  StepTransitionTarget
} from "@shared/api/workspace-contracts";

export type TransitionTargetKind = "step" | "loop" | "end";

export const createLoopDraft = (agents: Agent[]): ProjectLoop => {
  const firstAgent = agents[0];
  const step: ProjectStep = firstAgent
    ? agentStep("new-step", firstAgent.id)
    : humanStep("new-step");
  return { id: "", start: step.id, steps: [step] };
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
    ? agentStep(id, agents[0].id, "", { approved: inheritedTarget, rejected: { end: "failed" } })
    : humanStep(id, "", { approved: inheritedTarget, rejected: { end: "failed" } });
  const steps = [...loop.steps];
  steps.splice(sourceIndex + 1, 0, step);
  steps[sourceIndex] = { ...source, on: { ...source.on, [result]: id } } as ProjectStep;
  return { ...loop, steps };
};

export const reorderLoopSteps = (loop: ProjectLoop, fromIndex: number, toIndex: number): ProjectLoop => {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= loop.steps.length || toIndex >= loop.steps.length) return loop;
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
      return {
        ...next,
        on: {
          approved: next.on.approved === previousId ? step.id : next.on.approved,
          rejected: next.on.rejected === previousId ? step.id : next.on.rejected
        }
      } as ProjectStep;
    })
  };
};

export const removeStep = (loop: ProjectLoop, stepId: string): ProjectLoop => {
  const steps = loop.steps.filter((step) => step.id !== stepId).map((step) => ({
    ...step,
    on: {
      approved: step.on.approved === stepId ? { end: "blocked" as const } : step.on.approved,
      rejected: step.on.rejected === stepId ? { end: "blocked" as const } : step.on.rejected
    }
  } as ProjectStep));
  return { ...loop, steps, start: loop.start === stepId ? steps[0]?.id ?? "" : loop.start };
};

export const changeStepType = (step: ProjectStep, type: ProjectStep["type"], firstAgentId?: string): ProjectStep => {
  if (type === "human") return humanStep(step.id, step.description, step.on);
  const on = {
    approved: isLoopTarget(step.on.approved) ? { end: "blocked" as const } : step.on.approved,
    rejected: isLoopTarget(step.on.rejected) ? { end: "blocked" as const } : step.on.rejected
  };
  return agentStep(step.id, step.type === "agent" ? step.agentId : firstAgentId ?? "", step.description, on);
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
        steps: next.steps.map((step) => ({
          ...step,
          on: {
            approved: replaceLoopTarget(step.on.approved, previous.id, loop.id),
            rejected: replaceLoopTarget(step.on.rejected, previous.id, loop.id)
          }
        } as ProjectStep))
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
      steps: loop.steps.map((step) => ({
        ...step,
        on: {
          approved: replaceLoopTarget(step.on.approved, removed.id, undefined),
          rejected: replaceLoopTarget(step.on.rejected, removed.id, undefined)
        }
      } as ProjectStep))
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
  on: ProjectStep["on"] = defaultOn()
): ProjectStep => ({ id, type: "agent", agentId, description, on });

const humanStep = (
  id: string,
  description = "",
  on: ProjectStep["on"] = defaultOn()
): ProjectStep => ({ id, type: "human", description, on });

const isLoopTarget = (target: StepTransitionTarget): target is { loop: string } =>
  typeof target === "object" && "loop" in target;

const replaceLoopTarget = (target: StepTransitionTarget, previousId: string, nextId?: string): StepTransitionTarget => {
  if (!isLoopTarget(target) || target.loop !== previousId) return target;
  return nextId ? { loop: nextId } : { end: "blocked" };
};
