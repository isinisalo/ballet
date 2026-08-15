import type {
  LoopNodeSize,
  LoopNodeStyle,
  ProjectAutomationConfig,
  ProjectLoop,
  ProjectLoopNode,
  ProjectScheduledStep,
  ProjectStep,
  ProjectStepTransitions,
  StepTransitionTarget
} from "@shared/api/workspace-contracts";
import { defaultLoopNodeSize, defaultTerminalNodes, defaultTransitionFor, isProjectExecutionStep, isProjectTerminalNode, mapProjectStepTransitions } from "@shared/api/workspace-contracts";
import { defaultOnceSchedule } from "./loopSchedulePresentation";

export const createLoopDraft = (): ProjectLoop => ({ id: "", start: "", nodes: defaultTerminalNodes() });

export const addFirstStep = (loop: ProjectLoop): ProjectLoop => {
  if (loop.nodes.some((node) => !isProjectTerminalNode(node))) return loop;
  const step = defaultStep("new-step");
  return { ...loop, start: step.id, nodes: [step, ...loop.nodes] };
};

export const reorderLoopSteps = (loop: ProjectLoop, fromIndex: number, toIndex: number): ProjectLoop => {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= loop.nodes.length || toIndex >= loop.nodes.length) return loop;
  if (isProjectTerminalNode(loop.nodes[fromIndex]!) || isProjectTerminalNode(loop.nodes[toIndex]!)) return loop;
  const scheduledStartIndex = loop.nodes.findIndex((step) => step.type === "scheduled");
  if (scheduledStartIndex >= 0 && (fromIndex === scheduledStartIndex || toIndex === scheduledStartIndex)) return loop;
  const nodes = [...loop.nodes];
  const [moved] = nodes.splice(fromIndex, 1);
  if (!moved) return loop;
  nodes.splice(toIndex, 0, moved);
  const firstStep = nodes.find((node) => !isProjectTerminalNode(node));
  return { ...loop, nodes, start: firstStep?.id ?? loop.start };
};

export const replaceNode = (loop: ProjectLoop, previousId: string, node: ProjectLoopNode): ProjectLoop => {
  const renamed = previousId !== node.id;
  return {
    ...loop,
    start: renamed && loop.start === previousId ? node.id : loop.start,
    nodes: loop.nodes.map((candidate) => {
      const next = candidate.id === previousId ? node : candidate;
      if (!renamed || isProjectTerminalNode(next)) return next;
      return mapProjectStepTransitions(next, {
        approved: (target) => target === previousId ? node.id : target,
        rejected: (target) => target === previousId ? node.id : target
      });
    })
  };
};

export const removeStep = (loop: ProjectLoop, stepId: string): ProjectLoop => {
  if (!canRemoveStep(loop, stepId)) return loop;
  const nodes = loop.nodes
    .filter((node) => node.id !== stepId)
    .map((node) => isProjectTerminalNode(node) ? node : mapProjectStepTransitions(node, {
      approved: (target) => target === stepId ? defaultTransitionFor("approved") : target,
      rejected: (target) => target === stepId ? defaultTransitionFor("rejected") : target
    }));
  const firstStep = nodes.find((node) => !isProjectTerminalNode(node));
  return { ...loop, nodes, start: loop.start === stepId ? firstStep?.id ?? "" : loop.start };
};

export const canRemoveStep = (loop: ProjectLoop, stepId: string) =>
  loop.nodes.filter((node) => !isProjectTerminalNode(node)).length > 1
  && loop.nodes.some((node) => node.id === stepId && !isProjectTerminalNode(node));

export const canChangeStepToScheduled = (loop: ProjectLoop, stepId: string) =>
  loop.start === stepId
  && !loop.nodes.some((node) => node.id !== stepId && node.type === "scheduled");

export const changeStepType = (step: ProjectStep, type: ProjectStep["type"], options: {
  loop: ProjectLoop;
  now?: Date;
}): ProjectStep => {
  if (type === step.type) return step;
  if (type === "scheduled") return scheduledStep(step, options.now);
  if (type === "human") return humanStep(step.id, step.description, step.on, step.nodeStyle, step.nodeSize);
  const composition = isProjectExecutionStep(step) ? step : emptyComposition();
  return agentStep(step.id, composition, step.description, step.on, step.nodeStyle, step.nodeSize);
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
        nodes: next.nodes.map((node) => isProjectTerminalNode(node) ? node : mapProjectStepTransitions(node, {
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
      nodes: loop.nodes.map((node) => isProjectTerminalNode(node) ? node : mapProjectStepTransitions(node, {
        approved: (target) => replaceLoopTarget(target, removed.id, undefined, "approved"),
        rejected: (target) => replaceLoopTarget(target, removed.id, undefined, "rejected")
      }))
    }))
  };
};

export const transitionTargetSelectValue = (target: StepTransitionTarget): string =>
  typeof target === "string" ? `node:${target}` : `loop:${target.loop}`;

export const transitionTargetFromSelectValue = (value: string): StepTransitionTarget => {
  if (value.startsWith("node:")) return value.slice("node:".length);
  if (value.startsWith("loop:")) return { loop: value.slice("loop:".length) };
  throw new Error("Unsupported transition target select value.");
};

const defaultOn = (): ProjectStepTransitions => ({
  approved: defaultTransitionFor("approved"),
  rejected: defaultTransitionFor("rejected")
});

const defaultStep = (id: string): ProjectStep => agentStep(id, emptyComposition());

type StepComposition = Pick<ProjectScheduledStep, "executionProfileId" | "primaryInstructionId" | "skillIds">;
const emptyComposition = (): StepComposition => ({ executionProfileId: "", primaryInstructionId: "", skillIds: [] });

const agentStep = (id: string, composition: StepComposition, description = "", on = defaultOn(), nodeStyle: LoopNodeStyle = "flat", nodeSize: LoopNodeSize = defaultLoopNodeSize): ProjectStep =>
  ({ id, type: "agent", ...composition, skillIds: [...composition.skillIds], description, nodeStyle, nodeSize, on });

const humanStep = (id: string, description = "", on = defaultOn(), nodeStyle: LoopNodeStyle = "flat", nodeSize: LoopNodeSize = defaultLoopNodeSize): ProjectStep =>
  ({ id, type: "human", description, nodeStyle, nodeSize, on });

const scheduledStep = (step: ProjectStep, now?: Date): ProjectScheduledStep => ({
  id: step.id,
  type: "scheduled",
  ...(isProjectExecutionStep(step) ? {
    executionProfileId: step.executionProfileId,
    primaryInstructionId: step.primaryInstructionId,
    skillIds: [...step.skillIds]
  } : emptyComposition()),
  description: step.description,
  nodeStyle: step.nodeStyle,
  nodeSize: step.nodeSize,
  schedule: step.type === "scheduled" ? step.schedule : defaultOnceSchedule(now),
  on: step.on
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
