import type {
  ProjectAutomationConfig,
  ProjectAutomationIssue,
  ProjectLoop,
  ProjectLoopNode,
  StepTransitionTarget
} from "../../shared/domain/automation.js";
import type { ProjectResourceCatalog } from "../../shared/domain/documents.js";
import type { ExecutionProfile } from "../../shared/domain/projectConfig.js";
import {
  getProjectStepTransitionEntries,
  getProjectStepTransitionTargets,
  isProjectTerminalNode,
  isProjectExecutionStep,
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
  executionProfileIds?: ReadonlySet<string>
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
    if (step.type !== "human" && executionProfileIds && !executionProfileIds.has(step.executionProfileId)) {
      issues.push({
        path: `${base}.executionProfileId`,
        message: `Step references unknown execution profile: ${step.executionProfileId}.`
      });
    }
    for (const [transitionId, target] of getProjectStepTransitionEntries(step)) {
      issues.push(...validateTarget(target, `${base}.on.${transitionId}`, loop.id, nodesById, loopIds));
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
  executionProfiles?: readonly ExecutionProfile[]
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
  const executionProfileIds = executionProfiles
    ? new Set(executionProfiles.map((profile) => profile.id))
    : undefined;
  const issues = duplicateIssues(
    config.loops.map((loop, index) => ({ id: loop.id, path: `loops.${index}.id` })),
    "loop"
  );
  config.loops.forEach((loop, index) => {
    issues.push(...validateLoop(loop, index, loopIds, executionProfileIds));
  });
  return issues;
};

export const validateProjectExecutionResources = (
  config: ProjectAutomationConfig,
  resources: ProjectResourceCatalog
): ProjectAutomationIssue[] => {
  const instructionsById = validResourcesById(resources.instructions);
  const skillsById = validResourcesById(resources.skills);
  const issues: ProjectAutomationIssue[] = resources.issues.map((issue) => ({
    path: issue.relativePath,
    message: issue.message
  }));
  config.loops.forEach((loop, loopIndex) => loop.nodes.forEach((node, nodeIndex) => {
    if (!isProjectExecutionStep(node)) return;
    const base = `loops.${loopIndex}.nodes.${nodeIndex}`;
    if (!instructionsById.has(node.primaryInstructionId)) issues.push({
      path: `${base}.primaryInstructionId`,
      message: `Step references a missing or invalid primary instruction: ${node.primaryInstructionId}.`
    });
    node.skillIds.forEach((skillId, skillIndex) => {
      if (!skillsById.has(skillId)) issues.push({
        path: `${base}.skillIds.${skillIndex}`,
        message: `Step references a missing or invalid skill: ${skillId}.`
      });
    });
  }));
  return issues;
};

const validResourcesById = <T extends { id?: string; valid: boolean }>(resources: readonly T[]): Set<string> =>
  new Set(resources.flatMap((resource) => resource.valid && resource.id ? [resource.id] : []));
