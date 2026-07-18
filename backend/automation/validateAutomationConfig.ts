import type { Agent } from "../../shared/domain/agents.js";
import type {
  ProjectAutomationConfig,
  ProjectAutomationIssue,
  ProjectLoop,
  ProjectLoopNode,
  StepTransitionTarget
} from "../../shared/domain/automation.js";
import {
  getProjectStepTransitionEntries,
  getProjectStepTransitionTargets,
  isProjectTerminalNode,
  resolveEffectiveStartStep
} from "../../shared/domain/automation.js";
import { automationConfigSchema } from "../../shared/api/workspace-schemas.js";

export class AutomationValidationError extends Error {
  constructor(
    message: string,
    readonly issues: ProjectAutomationIssue[]
  ) {
    super(message);
    this.name = "AutomationValidationError";
  }
}

export class AutomationConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AutomationConflictError";
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
  sourceLoopId: string,
  nodesById: ReadonlyMap<string, ProjectLoopNode>,
  loopIds: ReadonlySet<string>
): ProjectAutomationIssue[] => {
  if (typeof target === "string") {
    return nodesById.has(target)
      ? []
      : [{ path, message: `Transition references unknown node: ${target}.` }];
  }
  if (!isLoopTarget(target)) return [];
  const issues: ProjectAutomationIssue[] = [];
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
  agentIds?: ReadonlySet<string>
): ProjectAutomationIssue[] => {
  const issues: ProjectAutomationIssue[] = [];
  const nodesById = new Map(loop.nodes.map((node) => [node.id, node]));
  issues.push(...duplicateIssues(
    loop.nodes.map((node, nodeIndex) => ({ id: node.id, path: `loops.${loopIndex}.nodes.${nodeIndex}.id` })),
    `node in loop ${loop.id}`
  ));
  if (!resolveEffectiveStartStep(loop)) {
    issues.push({ path: `loops.${loopIndex}.start`, message: `Loop start must reference an executable node: ${loop.start}.` });
  }
  const scheduledSteps = loop.nodes
    .flatMap((node, nodeIndex) => !isProjectTerminalNode(node) && node.type === "scheduled" ? [{ step: node, nodeIndex }] : []);
  if (scheduledSteps.length > 1) {
    issues.push({
      path: `loops.${loopIndex}.nodes`,
      message: "Loop may contain at most one scheduled step."
    });
  }
  loop.nodes.forEach((node, nodeIndex) => {
    if (isProjectTerminalNode(node)) return;
    const step = node;
    const base = `loops.${loopIndex}.nodes.${nodeIndex}`;
    if (step.type === "scheduled") {
      if (step.id !== loop.start) {
        issues.push({ path: `${base}.type`, message: "A scheduled step is allowed only as the loop start step." });
      }
    }
    if (step.type !== "human" && agentIds && !agentIds.has(step.agentId)) {
      issues.push({ path: `${base}.agentId`, message: `Step references unknown agent: ${step.agentId}.` });
    }
    for (const [transitionId, target] of getProjectStepTransitionEntries(step)) {
      issues.push(...validateTarget(target, `${base}.on.${transitionId}`, loop.id, nodesById, loopIds));
    }
  });
  const scheduledIds = new Set(scheduledSteps.map(({ step }) => step.id));
  loop.nodes.forEach((node, nodeIndex) => {
    if (isProjectTerminalNode(node)) return;
    const step = node;
    for (const [transitionId, target] of getProjectStepTransitionEntries(step)) {
      if (typeof target === "string" && scheduledIds.has(target)) {
        issues.push({
          path: `loops.${loopIndex}.nodes.${nodeIndex}.on.${transitionId}`,
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
    const node = nodesById.get(stepId);
    if (!node) continue;
    if (isProjectTerminalNode(node)) {
      hasReachableExit = true;
      continue;
    }
    const step = node;
    for (const target of getProjectStepTransitionTargets(step)) {
      if (typeof target === "string") {
        const targetNode = nodesById.get(target);
        if (targetNode && isProjectTerminalNode(targetNode)) hasReachableExit = true;
        else pending.push(target);
      }
      else hasReachableExit = true;
    }
  }
  if (!hasReachableExit) {
    issues.push({ path: `loops.${loopIndex}.nodes`, message: "Loop must have a terminal or cross-loop transition reachable from its start node." });
  }
  return issues;
};

export const validateProjectAutomationConfig = (
  input: unknown,
  agents?: readonly Agent[]
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
  const agentIds = agents ? new Set(agents.map((agent) => agent.id)) : undefined;
  const issues = duplicateIssues(
    config.loops.map((loop, index) => ({ id: loop.id, path: `loops.${index}.id` })),
    "loop"
  );
  config.loops.forEach((loop, index) => {
    issues.push(...validateLoop(loop, index, loopIds, agentIds));
  });
  return issues;
};
