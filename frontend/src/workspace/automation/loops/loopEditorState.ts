import type {
  Agent,
  LoopNodeSize,
  LoopNodeStyle,
  ProjectAgentStepTransitions,
  ProjectAutomationConfig,
  ProjectHumanStepTransitions,
  ProjectLoop,
  ProjectLoopNode,
  ProjectScheduledStep,
  ProjectStep,
  ProjectStepTransitionId,
  StepTransitionTarget
} from "@shared/api/workspace-contracts";
import {
  defaultAgentStepTransitions,
  defaultHumanStepTransitions,
  defaultLoopNodeSize,
  defaultTerminalNodes,
  getProjectStepTransitionTargets,
  isProjectTerminalNode,
  mapProjectStepTransitions
} from "@shared/api/workspace-contracts";
import { defaultOnceSchedule } from "./loopSchedulePresentation";

export type TransitionTargetKind = "node" | "loop";

export const createLoopDraft = (): ProjectLoop => ({ id: "", start: "", nodes: defaultTerminalNodes() });

export const addFirstStep = (loop: ProjectLoop, agents: Agent[]): ProjectLoop => {
  if (loop.nodes.some((node) => !isProjectTerminalNode(node))) return loop;
  const step = defaultStep("new-step", agents);
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
      return mapEveryTransition(next, (target) => target === previousId ? node.id : target);
    })
  };
};

export const removeStep = (loop: ProjectLoop, stepId: string): ProjectLoop => {
  if (!canRemoveStep(loop, stepId)) return loop;
  const nodes = loop.nodes
    .filter((node) => node.id !== stepId)
    .map((node) => isProjectTerminalNode(node)
      ? node
      : mapEveryTransition(node, (target) => target === stepId ? undefined : target));
  const firstStep = nodes.find((node) => !isProjectTerminalNode(node));
  return { ...loop, nodes, start: loop.start === stepId ? firstStep?.id ?? "" : loop.start };
};

export const canRemoveStep = (loop: ProjectLoop, stepId: string) =>
  loop.nodes.filter((node) => !isProjectTerminalNode(node)).length > 1
  && loop.nodes.some((node) => node.id === stepId && !isProjectTerminalNode(node));

export const canChangeStepToScheduled = (loop: ProjectLoop, stepId: string) =>
  loop.start === stepId
  && !loop.nodes.some((node) => node.id !== stepId && node.type === "scheduled")
  && !loop.nodes.some((node) => node.id !== stepId && !isProjectTerminalNode(node)
    && getProjectStepTransitionTargets(node).some((target) => target === stepId));

export const changeStepType = (step: ProjectStep, type: ProjectStep["type"], options: {
  loop: ProjectLoop;
  firstAgentId?: string;
  now?: Date;
}): ProjectStep => {
  if (type === step.type) return step;
  if (type === "scheduled") return scheduledStep(step, options.firstAgentId, options.now);
  if (type === "human") return humanStep(step.id, step.description, toHumanTransitions(step), step.nodeStyle, step.nodeSize);
  const agentId = step.type === "scheduled" ? step.agentId : options.firstAgentId ?? "";
  return agentStep(step.id, agentId, step.description, toAgentTransitions(step), step.nodeStyle, step.nodeSize);
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
        nodes: next.nodes.map((node) => isProjectTerminalNode(node)
          ? node
          : mapEveryTransition(node, (target) => replaceLoopTarget(target, previous.id, loop.id)))
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
      nodes: loop.nodes.map((node) => isProjectTerminalNode(node)
        ? node
        : mapEveryTransition(node, (target) => replaceLoopTarget(target, removed.id)))
    }))
  };
};

export const transitionTargetKind = (target: StepTransitionTarget): TransitionTargetKind =>
  typeof target === "string" ? "node" : "loop";

export const transitionTargetValue = (target: StepTransitionTarget): string =>
  typeof target === "string" ? target : target.loop;

export const transitionTarget = (kind: TransitionTargetKind, value: string): StepTransitionTarget =>
  kind === "node" ? value : { loop: value };

const defaultStep = (id: string, agents: Agent[]): ProjectStep => {
  const firstAgent = agents[0];
  return firstAgent ? agentStep(id, firstAgent.id) : humanStep(id);
};

const agentStep = (
  id: string,
  agentId: string,
  description = "",
  on = defaultAgentStepTransitions(),
  nodeStyle: LoopNodeStyle = "flat",
  nodeSize: LoopNodeSize = defaultLoopNodeSize
): ProjectStep => ({ id, type: "agent", agentId, description, nodeStyle, nodeSize, on });

const humanStep = (
  id: string,
  description = "",
  on = defaultHumanStepTransitions(),
  nodeStyle: LoopNodeStyle = "flat",
  nodeSize: LoopNodeSize = defaultLoopNodeSize
): ProjectStep => ({ id, type: "human", description, nodeStyle, nodeSize, on });

const scheduledStep = (
  step: ProjectStep,
  firstAgentId?: string,
  now?: Date
): ProjectScheduledStep => ({
  id: step.id,
  type: "scheduled",
  agentId: step.type === "agent" || step.type === "scheduled" ? step.agentId : firstAgentId ?? "",
  description: step.description,
  nodeStyle: step.nodeStyle,
  nodeSize: step.nodeSize,
  schedule: step.type === "scheduled" ? step.schedule : defaultOnceSchedule(now),
  on: toAgentTransitions(step)
});

const toHumanTransitions = (step: ProjectStep): ProjectHumanStepTransitions => step.type === "human"
  ? step.on
  : { ...defaultHumanStepTransitions(), approved: step.on.approved };

const toAgentTransitions = (step: ProjectStep): ProjectAgentStepTransitions => step.type !== "human"
  ? step.on
  : { ...defaultAgentStepTransitions(), approved: step.on.approved };

const mapEveryTransition = <T extends ProjectStep>(
  step: T,
  mapper: (target: StepTransitionTarget) => StepTransitionTarget | undefined
): T => {
  const signals = Object.keys(step.on) as ProjectStepTransitionId[];
  return mapProjectStepTransitions(step, Object.fromEntries(signals.map((signal) => [signal, mapper])));
};

const replaceLoopTarget = (
  target: StepTransitionTarget,
  previousId: string,
  nextId?: string
): StepTransitionTarget | undefined => {
  if (typeof target === "string" || target.loop !== previousId) return target;
  return nextId ? { loop: nextId } : undefined;
};
