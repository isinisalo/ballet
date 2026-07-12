import type { Agent } from "../../shared/domain/agents.js";
import type {
  ProjectExecutableStep,
  ProjectAutomationConfig,
  ProjectAutomationIssue,
  ProjectLoop,
  ProjectStep,
  StepTransitionTarget
} from "../../shared/domain/automation.js";
import {
  getProjectStepTransitionEntries,
  getProjectStepTransitionTargets,
  isProjectExecutableStep,
  resolveEffectiveStartStep
} from "../../shared/domain/automation.js";
import { automationConfigSchema } from "../../shared/api/workspace-schemas.js";
import { MAX_ROOT_TRANSITIONS } from "../runtime/RuntimeDbTypes.js";

export class AutomationValidationError extends Error {
  constructor(
    message: string,
    readonly issues: ProjectAutomationIssue[]
  ) {
    super(message);
    this.name = "AutomationValidationError";
  }
}

const pathText = (path: PropertyKey[]): string =>
  path.length > 0 ? path.map(String).join(".") : "automation";

const duplicateIssues = (
  values: Array<{ id: string; path: string }>,
  label: string
): ProjectAutomationIssue[] => {
  const seen = new Set<string>();
  const issues: ProjectAutomationIssue[] = [];
  for (const value of values) {
    if (seen.has(value.id)) issues.push({ path: value.path, message: `Duplicate ${label} id: ${value.id}.` });
    seen.add(value.id);
  }
  return issues;
};

const isLoopTarget = (target: StepTransitionTarget): target is { loop: string } =>
  typeof target === "object" && "loop" in target;

const validateTarget = (
  target: StepTransitionTarget,
  path: string,
  step: ProjectExecutableStep,
  sourceLoopId: string,
  stepsById: ReadonlyMap<string, ProjectStep>,
  loopIds: ReadonlySet<string>
): ProjectAutomationIssue[] => {
  if (typeof target === "string") {
    return stepsById.has(target)
      ? []
      : [{ path, message: `Transition references unknown step: ${target}.` }];
  }
  if (!isLoopTarget(target)) return [];
  const issues: ProjectAutomationIssue[] = [];
  if (step.type !== "human") {
    issues.push({ path, message: "Only a human step may transition to another loop." });
  }
  if (!loopIds.has(target.loop)) {
    issues.push({ path, message: `Transition references unknown loop: ${target.loop}.` });
  }
  if (target.loop === sourceLoopId) {
    issues.push({ path, message: "A loop transition must target a different loop. Use a step id for a same-loop transition." });
  }
  return issues;
};

const validateLoop = (
  loop: ProjectLoop,
  loopIndex: number,
  loopIds: ReadonlySet<string>,
  agentIds: ReadonlySet<string>
): ProjectAutomationIssue[] => {
  const issues: ProjectAutomationIssue[] = [];
  const stepsById = new Map(loop.steps.map((step) => [step.id, step]));
  issues.push(...duplicateIssues(
    loop.steps.map((step, stepIndex) => ({ id: step.id, path: `loops.${loopIndex}.steps.${stepIndex}.id` })),
    `step in loop ${loop.id}`
  ));
  if (!stepsById.has(loop.start)) {
    issues.push({ path: `loops.${loopIndex}.start`, message: `Loop start references unknown step: ${loop.start}.` });
  }
  const scheduledSteps = loop.steps
    .map((step, stepIndex) => ({ step, stepIndex }))
    .filter(({ step }) => step.type === "scheduled");
  if (scheduledSteps.length > 1) {
    issues.push({
      path: `loops.${loopIndex}.steps`,
      message: "Loop may contain at most one scheduled step."
    });
  }
  loop.steps.forEach((step, stepIndex) => {
    const base = `loops.${loopIndex}.steps.${stepIndex}`;
    if (step.type === "scheduled") {
      if (step.id !== loop.start) {
        issues.push({ path: `${base}.type`, message: "A scheduled step is allowed only as the loop start step." });
      }
      const target = stepsById.get(step.on.triggered);
      if (!target) {
        issues.push({
          path: `${base}.on.triggered`,
          message: `Transition references unknown step: ${step.on.triggered}.`
        });
      } else if (!isProjectExecutableStep(target) || target.id === step.id) {
        issues.push({
          path: `${base}.on.triggered`,
          message: "A scheduled step must trigger another agent or human step in the same loop."
        });
      }
      return;
    }
    if (step.type === "agent" && agentIds.size > 0 && !agentIds.has(step.agentId)) {
      issues.push({ path: `${base}.agentId`, message: `Step references unknown agent: ${step.agentId}.` });
    }
    for (const [transitionId, target] of getProjectStepTransitionEntries(step)) {
      issues.push(...validateTarget(target, `${base}.on.${transitionId}`, step, loop.id, stepsById, loopIds));
    }
  });
  const scheduledIds = new Set(scheduledSteps.map(({ step }) => step.id));
  loop.steps.forEach((step, stepIndex) => {
    for (const [transitionId, target] of getProjectStepTransitionEntries(step)) {
      if (typeof target === "string" && scheduledIds.has(target)) {
        issues.push({
          path: `loops.${loopIndex}.steps.${stepIndex}.on.${transitionId}`,
          message: "No transition may target a scheduled start step."
        });
      }
    }
  });
  const reachable = new Set<string>();
  const pending = [loop.start];
  let hasReachableExit = false;
  while (pending.length > 0) {
    const stepId = pending.shift();
    if (!stepId || reachable.has(stepId)) continue;
    reachable.add(stepId);
    const step = stepsById.get(stepId);
    if (!step) continue;
    for (const target of getProjectStepTransitionTargets(step)) {
      if (typeof target === "string") pending.push(target);
      else hasReachableExit = true;
    }
  }
  if (!hasReachableExit) {
    issues.push({ path: `loops.${loopIndex}.steps`, message: "Loop must have an end or cross-loop transition reachable from its start step." });
  }
  return issues;
};

const validateApprovedPaths = (
  config: ProjectAutomationConfig
): ProjectAutomationIssue[] => {
  const loopsById = new Map(config.loops.map((loop) => [loop.id, loop]));
  const issues: ProjectAutomationIssue[] = [];

  config.loops.forEach((rootLoop, loopIndex) => {
    let loop = rootLoop;
    let step = resolveEffectiveStartStep(rootLoop);
    let transitionCount = 0;
    const visited = new Set<string>();

    while (true) {
      if (!step) return;

      const state = `${loop.id}\0${step.id}`;
      if (visited.has(state)) {
        issues.push({
          path: `loops.${loopIndex}.start`,
          message: "The all-approved path cycles before reaching a terminal target."
        });
        return;
      }
      visited.add(state);

      transitionCount += 1;
      if (transitionCount > MAX_ROOT_TRANSITIONS) {
        issues.push({
          path: `loops.${loopIndex}.start`,
          message: `The all-approved path exceeds the root transition limit of ${MAX_ROOT_TRANSITIONS} before reaching a terminal target.`
        });
        return;
      }

      const target = step.on.approved;
      if (typeof target === "string") {
        const nextStep = loop.steps.find((candidate) => candidate.id === target);
        if (!nextStep || !isProjectExecutableStep(nextStep)) return;
        step = nextStep;
        continue;
      }
      if (!isLoopTarget(target)) return;

      const targetLoop = loopsById.get(target.loop);
      if (!targetLoop) return;
      loop = targetLoop;
      step = resolveEffectiveStartStep(targetLoop);
    }
  });

  return issues;
};

export const validateProjectAutomationConfig = (
  input: unknown,
  agents: Agent[] = []
): ProjectAutomationIssue[] => {
  const parsed = automationConfigSchema.safeParse(input);
  if (!parsed.success) {
    return parsed.error.issues.map((issue) => ({
      path: pathText(issue.path),
      message: issue.message
    }));
  }

  const config: ProjectAutomationConfig = parsed.data;
  const loopIds = new Set(config.loops.map((loop) => loop.id));
  const agentIds = new Set(agents.map((agent) => agent.id));
  const issues = duplicateIssues(
    config.loops.map((loop, index) => ({ id: loop.id, path: `loops.${index}.id` })),
    "loop"
  );
  config.loops.forEach((loop, index) => {
    issues.push(...validateLoop(loop, index, loopIds, agentIds));
  });
  issues.push(...validateApprovedPaths(config));
  return issues;
};
