import { automationConfigSchema } from "../../shared/api/workspace-schemas.js";
import {
  getProjectFailEdges,
  getProjectPassEdges,
  getReachableProjectLoopGraph,
  getReachableProjectJobNodeIds,
  hasReachableProjectWorkflowPass,
  isProjectAgentValidationNode,
  isProjectProviderJobNode,
  type ProjectAutomationConfig,
  type ProjectAutomationIssue,
  type ProjectExecutionComposition,
  type ProjectLoop
} from "../../shared/domain/automation.js";
import type { ProjectResourceCatalog } from "../../shared/domain/documents.js";
import type { ExecutionProfile } from "../../shared/domain/projectConfig.js";

export class AutomationValidationError extends Error {
  constructor(message: string, readonly issues: ProjectAutomationIssue[]) {
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

const duplicateIssues = (
  values: Array<{ id: string; path: string }>,
  label: string
): ProjectAutomationIssue[] => {
  const seen = new Set<string>();
  return values.flatMap((value) => {
    const duplicate = seen.has(value.id);
    seen.add(value.id);
    return duplicate ? [{ path: value.path, message: `Duplicate ${label} id: ${value.id}.` }] : [];
  });
};

const validateLoop = (
  loop: ProjectLoop,
  loopIndex: number,
  profileIds?: ReadonlySet<string>
): ProjectAutomationIssue[] => {
  const issues: ProjectAutomationIssue[] = [];
  const base = `loops.${loopIndex}.workflow`;
  const jobIds = new Set(loop.workflow.jobNodes.map((node) => node.id));
  const validationIds = new Set(loop.workflow.validationNodes.map((node) => node.id));
  if (!jobIds.has(loop.workflow.startJobNodeId)) issues.push({
    path: `${base}.startJobNodeId`,
    message: `Workflow startJobNodeId references an unknown JobNode: ${loop.workflow.startJobNodeId}.`
  });
  const claimedValidations = new Map<string, string>();
  loop.workflow.jobNodes.forEach((node, nodeIndex) => {
    const nodeBase = `${base}.jobNodes.${nodeIndex}`;
    if (!validationIds.has(node.validationNodeId)) issues.push({
      path: `${nodeBase}.validationNodeId`,
      message: `JobNode ${node.id} references an unknown ValidationNode: ${node.validationNodeId}.`
    });
    const owner = claimedValidations.get(node.validationNodeId);
    if (owner) issues.push({
      path: `${nodeBase}.validationNodeId`,
      message: `ValidationNode ${node.validationNodeId} is already owned by JobNode ${owner}.`
    });
    claimedValidations.set(node.validationNodeId, node.id);
    if (node.type === "scheduled" && node.id !== loop.workflow.startJobNodeId) issues.push({
      path: `${nodeBase}.type`,
      message: "A scheduled JobNode is allowed only as the Workflow start JobNode."
    });
    if (profileIds) {
      issues.push(...validateCompositionProfile(node, nodeBase, profileIds));
    }
  });
  loop.workflow.validationNodes.forEach((node, nodeIndex) => {
    const nodeBase = `${base}.validationNodes.${nodeIndex}`;
    if (!claimedValidations.has(node.id)) issues.push({
      path: `${nodeBase}.id`,
      message: `ValidationNode ${node.id} is not owned by a JobNode.`
    });
    const passEdges = getProjectPassEdges(loop, node.id);
    const failEdges = getProjectFailEdges(loop, node.id);
    if (passEdges.length !== 1) issues.push({
      path: `${base}.passEdges`,
      message: `ValidationNode ${node.id} must have exactly one PassEdge; found ${passEdges.length}.`
    });
    if (failEdges.length !== 1) issues.push({
      path: `${base}.failEdges`,
      message: `ValidationNode ${node.id} must have exactly one FailEdge; found ${failEdges.length}.`
    });
    if (profileIds) issues.push(...validateCompositionProfile(node, nodeBase, profileIds));
  });
  loop.workflow.passEdges.forEach((edge, edgeIndex) => {
    const edgeBase = `${base}.passEdges.${edgeIndex}`;
    if (!validationIds.has(edge.sourceValidationNodeId)) issues.push({
      path: `${edgeBase}.sourceValidationNodeId`, message: `PassEdge references an unknown ValidationNode: ${edge.sourceValidationNodeId}.`
    });
    if ("jobNodeId" in edge.target && !jobIds.has(edge.target.jobNodeId)) issues.push({
      path: `${edgeBase}.target.jobNodeId`, message: `PassEdge references an unknown JobNode: ${edge.target.jobNodeId}.`
    });
  });
  loop.workflow.failEdges.forEach((edge, edgeIndex) => {
    if (!validationIds.has(edge.sourceValidationNodeId)) issues.push({
      path: `${base}.failEdges.${edgeIndex}.sourceValidationNodeId`,
      message: `FailEdge references an unknown ValidationNode: ${edge.sourceValidationNodeId}.`
    });
  });
  if (jobIds.has(loop.workflow.startJobNodeId)) {
    const reachable = getReachableProjectJobNodeIds(loop);
    loop.workflow.jobNodes.forEach((node, nodeIndex) => {
      if (!reachable.has(node.id)) issues.push({
        path: `${base}.jobNodes.${nodeIndex}.id`,
        message: `JobNode is unreachable from startJobNodeId: ${node.id}.`
      });
    });
    if (!hasReachableProjectWorkflowPass(loop)) issues.push({
      path: `${base}.passEdges`,
      message: "Workflow must have a PASS result reachable from its start JobNode; non-terminating Job cycles are invalid."
    });
  }
  return issues;
};

const validateCompositionProfile = (
  value: { type: string } & Partial<ProjectExecutionComposition>,
  path: string,
  profileIds: ReadonlySet<string>
): ProjectAutomationIssue[] => value.type !== "human" && value.executionProfileId
  && !profileIds.has(value.executionProfileId)
  ? [{ path: `${path}.executionProfileId`, message: `Execution composition references unknown execution profile: ${value.executionProfileId}.` }]
  : [];

export const validateProjectAutomationConfig = (
  input: unknown,
  executionProfiles?: readonly ExecutionProfile[]
): ProjectAutomationIssue[] => {
  const parsed = automationConfigSchema.safeParse(input);
  if (!parsed.success) return parsed.error.issues.map((issue) => ({
    path: issue.path.length > 0 ? issue.path.map(String).join(".") : "automation",
    message: issue.message
  }));

  const config = parsed.data;
  const loopIds = new Set(config.loops.map((loop) => loop.id));
  const profileIds = executionProfiles ? new Set(executionProfiles.map((profile) => profile.id)) : undefined;
  const issues = duplicateIssues(
    config.loops.map((loop, index) => ({ id: loop.id, path: `loops.${index}.id` })),
    "Loop"
  );
  issues.push(...duplicateIssues(
    config.loops.flatMap((loop, loopIndex) => [
      ...loop.workflow.jobNodes.map((node, nodeIndex) => ({
      id: node.id,
      path: `loops.${loopIndex}.workflow.jobNodes.${nodeIndex}.id`
      })),
      ...loop.workflow.validationNodes.map((node, nodeIndex) => ({
        id: node.id,
        path: `loops.${loopIndex}.workflow.validationNodes.${nodeIndex}.id`
      }))
    ]),
    "Workflow Node"
  ));
  issues.push(...duplicateIssues([
    ...config.loops.flatMap((loop, loopIndex) => [
      ...loop.workflow.passEdges.map((edge, edgeIndex) => ({ id: edge.id, path: `loops.${loopIndex}.workflow.passEdges.${edgeIndex}.id` })),
      ...loop.workflow.failEdges.map((edge, edgeIndex) => ({ id: edge.id, path: `loops.${loopIndex}.workflow.failEdges.${edgeIndex}.id` }))
    ]),
    ...config.graph.transitions.map((edge, edgeIndex) => ({ id: edge.id, path: `graph.transitions.${edgeIndex}.id` })),
    ...config.graph.repairEdges.map((edge, edgeIndex) => ({ id: edge.id, path: `graph.repairEdges.${edgeIndex}.id` }))
  ], "Edge"));
  if (profileIds && config.orchestrator.repairRouter
    && !profileIds.has(config.orchestrator.repairRouter.executionProfileId)) issues.push({
    path: "orchestrator.repairRouter.executionProfileId",
    message: `Repair router references unknown execution profile: ${config.orchestrator.repairRouter.executionProfileId}.`
  });
  if (config.graph.repairEdges.length > 0 && !config.orchestrator.repairRouter) issues.push({
    path: "orchestrator.repairRouter",
    message: "A repairRouter is required when the graph contains Repair Edges."
  });
  config.loops.forEach((loop, index) => issues.push(...validateLoop(loop, index, profileIds)));
  const loopsById = new Map(config.loops.map((loop) => [loop.id, loop]));
  if (config.loops.length > 0 && !loopIds.has(config.graph.startLoopId)) issues.push({
    path: "graph.startLoopId",
    message: `Graph startLoopId references an unknown Loop: ${config.graph.startLoopId}.`
  });
  config.graph.transitions.forEach((transition, index) => {
    if (!loopIds.has(transition.source)) issues.push({
      path: `graph.transitions.${index}.source`,
      message: `Transition references an unknown source Loop: ${transition.source}.`
    });
    if ("loopId" in transition.target && !loopIds.has(transition.target.loopId)) issues.push({
      path: `graph.transitions.${index}.target.loopId`,
      message: `Transition references an unknown target Loop: ${transition.target.loopId}.`
    });
  });
  config.graph.repairEdges.forEach((edge, index) => {
    if (!loopIds.has(edge.source)) issues.push({
      path: `graph.repairEdges.${index}.source`,
      message: `Repair Edge references an unknown source Loop: ${edge.source}.`
    });
    if (!loopIds.has(edge.target)) issues.push({
      path: `graph.repairEdges.${index}.target`,
      message: `Repair Edge references an unknown target Loop: ${edge.target}.`
    });
    const target = loopsById.get(edge.target);
    if (target && !target.capabilities.provides.includes(edge.capability)) issues.push({
      path: `graph.repairEdges.${index}.capability`,
      message: `Repair Edge capability ${edge.capability} is not provided by target Loop ${edge.target}.`
    });
  });
  issues.push(...duplicateIssues(
    config.graph.transitions.map((transition, index) => ({
      id: `${transition.source}:${transition.decision}:${transition.outcome}`,
      path: `graph.transitions.${index}.outcome`
    })),
    "RunBook transition key"
  ));
  if (loopIds.has(config.graph.startLoopId)) {
    const reachable = getReachableProjectLoopGraph(
      config,
      config.graph.startLoopId,
      config.orchestrator.repairRouter?.maxRepairDepth ?? 0
    ).loopIds;
    config.loops.forEach((loop, index) => {
      if (!reachable.has(loop.id)) issues.push({
        path: `loops.${index}.id`, message: `Loop is unreachable from graph.startLoopId: ${loop.id}.`
      });
    });
    if (!config.graph.transitions.some((transition) => reachable.has(transition.source) && "runResult" in transition.target)) {
      issues.push({ path: "graph.transitions", message: "Graph must contain a reachable DONE transition." });
    }
  }
  return issues;
};

export const validateProjectExecutionResources = (
  config: ProjectAutomationConfig,
  resources: ProjectResourceCatalog
): ProjectAutomationIssue[] => {
  const instructions = validResourcesById(resources.instructions);
  const skills = validResourcesById(resources.skills);
  const issues: ProjectAutomationIssue[] = resources.issues.map((issue) => ({
    path: issue.relativePath,
    message: issue.message
  }));
  if (config.orchestrator.repairRouter) validateCompositionResources(
    config.orchestrator.repairRouter, "orchestrator.repairRouter", instructions, skills, issues
  );
  config.loops.forEach((loop, loopIndex) => {
    loop.workflow.jobNodes.forEach((node, nodeIndex) => {
      if (isProjectProviderJobNode(node)) validateCompositionResources(
        node, `loops.${loopIndex}.workflow.jobNodes.${nodeIndex}`, instructions, skills, issues
      );
    });
    loop.workflow.validationNodes.forEach((node, nodeIndex) => {
      if (isProjectAgentValidationNode(node)) validateCompositionResources(
        node, `loops.${loopIndex}.workflow.validationNodes.${nodeIndex}`, instructions, skills, issues
      );
    });
  });
  return issues;
};

const validateCompositionResources = (
  composition: ProjectExecutionComposition,
  path: string,
  instructions: ReadonlySet<string>,
  skills: ReadonlySet<string>,
  issues: ProjectAutomationIssue[]
): void => {
  if (!instructions.has(composition.primaryInstructionId)) issues.push({
    path: `${path}.primaryInstructionId`,
    message: `Execution composition references a missing or invalid primary instruction: ${composition.primaryInstructionId}.`
  });
  composition.skillIds.forEach((skillId, index) => {
    if (!skills.has(skillId)) issues.push({
      path: `${path}.skillIds.${index}`,
      message: `Execution composition references a missing or invalid skill: ${skillId}.`
    });
  });
};

const validResourcesById = <T extends { id?: string; valid: boolean }>(resources: readonly T[]): Set<string> =>
  new Set(resources.flatMap((resource) => resource.valid && resource.id ? [resource.id] : []));
