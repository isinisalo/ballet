import type {
  Agent,
  LoopNodeSize,
  LoopNodeStyle,
  ProjectAutomationConfig,
  ProjectLoop,
  ProjectLoopNode,
  ProjectAgentStepTransitions,
  ProjectHumanStepTransitions,
  ProjectScheduledStep,
  ProjectStep,
  StepTransitionTarget
} from "@shared/api/workspace-contracts";
import { defaultAgentStepTransitions, defaultHumanStepTransitions, defaultLoopNodeSize, defaultTerminalNodes, defaultTransitionFor, getProjectStepTransitionTargets, isProjectTerminalNode, mapProjectStepTransitions } from "@shared/api/workspace-contracts";
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
      return mapProjectStepTransitions(next, {
        ready: (target) => target === previousId ? node.id : target,
        approved: (target) => target === previousId ? node.id : target,
        rejected: (target) => target === previousId ? node.id : target,
        "changes-requested": (target) => target === previousId ? node.id : target,
        needs_input: (target) => target === previousId ? node.id : target
      });
    })
  };
};

export const removeStep = (loop: ProjectLoop, stepId: string): ProjectLoop => {
  if (!canRemoveStep(loop, stepId)) return loop;
  const nodes = loop.nodes
    .filter((node) => node.id !== stepId)
    .map((node) => isProjectTerminalNode(node) ? node : mapProjectStepTransitions(node, {
      ready: (target) => target === stepId ? undefined : target,
      approved: (target) => target === stepId ? defaultTransitionFor("approved") : target,
      rejected: (target) => target === stepId ? defaultTransitionFor("rejected") : target,
      "changes-requested": (target) => target === stepId ? undefined : target,
      needs_input: (target) => target === stepId ? undefined : target
    }));
  const firstStep = nodes.find((node) => !isProjectTerminalNode(node));
  return { ...loop, nodes, start: loop.start === stepId ? firstStep?.id ?? "" : loop.start };
};

export const canRemoveStep = (loop: ProjectLoop, stepId: string) =>
  loop.nodes.filter((node) => !isProjectTerminalNode(node)).length > 1
  && loop.nodes.some((node) => node.id === stepId && !isProjectTerminalNode(node));

export const canChangeStepToScheduled = (loop: ProjectLoop, stepId: string) =>
  loop.start === stepId
  && !loop.nodes.some((node) => node.id !== stepId && node.type === "scheduled")
  && !loop.nodes.some((node) => !isProjectTerminalNode(node) && getProjectStepTransitionTargets(node).includes(stepId));

export const changeStepType = (step: ProjectStep, type: ProjectStep["type"], options: {
  loop: ProjectLoop;
  firstAgentId?: string;
  now?: Date;
}): ProjectStep => {
  if (type === step.type) return step;
  if (type === "scheduled") return scheduledStep(step, options.loop, options.firstAgentId, options.now);
  if (type === "human") return humanStep(step.id, step.description, toHumanTransitions(step), step.nodeStyle, step.nodeSize);
  const agentId = step.type === "scheduled" ? step.agentId : options.firstAgentId ?? "";
  return agentStep(step.id, agentId, step.description, toAgentTransitions(step, options.loop), step.nodeStyle, step.nodeSize);
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

export const transitionTargetKind = (target: StepTransitionTarget): TransitionTargetKind =>
  typeof target === "string" ? "node" : "loop";

export const transitionTargetValue = (target: StepTransitionTarget): string =>
  typeof target === "string" ? target : target.loop;

export const transitionTarget = (kind: TransitionTargetKind, value: string): StepTransitionTarget => {
  return kind === "node" ? value : { loop: value };
};

const defaultStep = (id: string, agents: Agent[]): ProjectStep => {
  const firstAgent = agents[0];
  return firstAgent ? agentStep(id, firstAgent.id) : humanStep(id);
};

const agentStep = (id: string, agentId: string, description = "", on = defaultAgentStepTransitions(), nodeStyle: LoopNodeStyle = "flat", nodeSize: LoopNodeSize = defaultLoopNodeSize): ProjectStep =>
  ({ id, type: "agent", agentId, description, nodeStyle, nodeSize, on });

const humanStep = (id: string, description = "", on = defaultHumanStepTransitions(), nodeStyle: LoopNodeStyle = "flat", nodeSize: LoopNodeSize = defaultLoopNodeSize): ProjectStep =>
  ({ id, type: "human", description, nodeStyle, nodeSize, on });

const scheduledStep = (step: ProjectStep, loop: ProjectLoop, firstAgentId?: string, now?: Date): ProjectScheduledStep => ({
  id: step.id,
  type: "scheduled",
  agentId: step.type === "agent" || step.type === "scheduled" ? step.agentId : firstAgentId ?? "",
  description: step.description,
  nodeStyle: step.nodeStyle,
  nodeSize: step.nodeSize,
  schedule: step.type === "scheduled" ? step.schedule : defaultOnceSchedule(now),
  on: toAgentTransitions(step, loop)
});

const toHumanTransitions = (step: ProjectStep): ProjectHumanStepTransitions => step.type === "human"
  ? step.on
  : { approved: localTarget(step.on.approved, "completed"), rejected: "blocked" };

const toAgentTransitions = (step: ProjectStep, loop: ProjectLoop): ProjectAgentStepTransitions => {
  if (step.type !== "human") return {
    ...step.on,
    ready: localTarget(step.on.ready, "completed"),
    approved: localTarget(step.on.approved, "completed")
  };
  const progress = localTarget(step.on.approved, "completed");
  const rejected = typeof step.on.rejected === "string"
    && loop.nodes.some((node) => node.id === step.on.rejected && node.type === "agent")
    ? { repair: step.on.rejected }
    : { terminate: "blocked" as const };
  const human = loop.nodes.find((node) => node.id !== step.id && node.type === "human");
  return {
    ...defaultAgentStepTransitions(),
    ready: progress,
    approved: progress,
    "changes-requested": rejected,
    needs_input: human ? { human: human.id } : { wait: true }
  };
};

const localTarget = (target: StepTransitionTarget, fallback: string): StepTransitionTarget =>
  isLoopTarget(target) ? fallback : target;

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
