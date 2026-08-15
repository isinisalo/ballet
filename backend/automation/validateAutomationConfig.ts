import { automationConfigSchema } from "../../shared/api/workspace-schemas.js";
import {
  getProjectNodeEdges,
  getReachableProjectNodeIds,
  hasReachableProjectLoopTerminal,
  isProjectAgentValidationNode,
  isProjectNodeTerminalTarget,
  isProjectProviderWorkNode,
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
  const base = `loops.${loopIndex}`;
  const nodeIds = new Set(loop.nodes.map((node) => node.id));
  if (!nodeIds.has(loop.startNodeId)) issues.push({
    path: `${base}.startNodeId`,
    message: `Loop startNodeId references an unknown Work Loop Node: ${loop.startNodeId}.`
  });
  loop.nodes.forEach((node, nodeIndex) => {
    const nodeBase = `${base}.nodes.${nodeIndex}`;
    const outgoing = getProjectNodeEdges(loop, node.id);
    if (outgoing.length !== 1) issues.push({
      path: `${base}.edges`,
      message: `Validation OK output for Work Loop Node ${node.id} must have exactly one target; found ${outgoing.length}.`
    });
    if (node.work.type === "scheduled" && node.id !== loop.startNodeId) issues.push({
      path: `${nodeBase}.work.type`,
      message: "A scheduled Work Node is allowed only in the Loop start Work Loop Node."
    });
    if (profileIds) {
      issues.push(...validateCompositionProfile(node.work, `${nodeBase}.work`, profileIds));
      issues.push(...validateCompositionProfile(node.validation, `${nodeBase}.validation`, profileIds));
    }
  });
  loop.edges.forEach((edge, edgeIndex) => {
    const edgeBase = `${base}.edges.${edgeIndex}`;
    if (!nodeIds.has(edge.source)) issues.push({
      path: `${edgeBase}.source`,
      message: `Node edge references an unknown source Work Loop Node: ${edge.source}.`
    });
    if (!isProjectNodeTerminalTarget(edge.target) && !nodeIds.has(edge.target.nodeId)) issues.push({
      path: `${edgeBase}.target.nodeId`,
      message: `Node edge references an unknown target Work Loop Node: ${edge.target.nodeId}.`
    });
  });
  if (nodeIds.has(loop.startNodeId)) {
    const reachable = getReachableProjectNodeIds(loop);
    loop.nodes.forEach((node, nodeIndex) => {
      if (!reachable.has(node.id)) issues.push({
        path: `${base}.nodes.${nodeIndex}.id`,
        message: `Work Loop Node is unreachable from startNodeId: ${node.id}.`
      });
    });
    if (!hasReachableProjectLoopTerminal(loop)) issues.push({
      path: `${base}.edges`,
      message: "Loop must have a terminal target reachable from its start Work Loop Node; non-terminating node cycles are invalid."
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
    config.loops.flatMap((loop, loopIndex) => loop.nodes.map((node, nodeIndex) => ({
      id: node.id,
      path: `loops.${loopIndex}.nodes.${nodeIndex}.id`
    }))),
    "Work Loop Node"
  ));
  issues.push(...duplicateIssues([
    ...config.loops.flatMap((loop, loopIndex) => loop.edges.map((edge, edgeIndex) => ({
      id: edge.id,
      path: `loops.${loopIndex}.edges.${edgeIndex}.id`
    }))),
    ...config.loopEdges.map((edge, edgeIndex) => ({ id: edge.id, path: `loopEdges.${edgeIndex}.id` }))
  ], "Edge"));
  if (profileIds && !profileIds.has(config.orchestrator.executionProfileId)) issues.push({
    path: "orchestrator.executionProfileId",
    message: `Orchestrator references unknown execution profile: ${config.orchestrator.executionProfileId}.`
  });
  config.loops.forEach((loop, index) => issues.push(...validateLoop(loop, index, profileIds)));
  config.loopEdges.forEach((edge, index) => {
    if (!loopIds.has(edge.source)) issues.push({
      path: `loopEdges.${index}.source`,
      message: `Loop Edge references an unknown source Loop: ${edge.source}.`
    });
    if (!loopIds.has(edge.target)) issues.push({
      path: `loopEdges.${index}.target`,
      message: `Loop Edge references an unknown target Loop: ${edge.target}.`
    });
  });
  const flowSources = config.loopEdges.filter((edge) => edge.kind === "flow");
  issues.push(...duplicateIssues(
    flowSources.map((edge) => ({ id: edge.source, path: `loopEdges.${config.loopEdges.indexOf(edge)}.source` })),
    "outgoing flow Loop Edge source"
  ));
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
  validateCompositionResources(config.orchestrator, "orchestrator", instructions, skills, issues);
  config.loops.forEach((loop, loopIndex) => loop.nodes.forEach((node, nodeIndex) => {
    const base = `loops.${loopIndex}.nodes.${nodeIndex}`;
    if (isProjectProviderWorkNode(node.work)) {
      validateCompositionResources(node.work, `${base}.work`, instructions, skills, issues);
    }
    if (isProjectAgentValidationNode(node.validation)) {
      validateCompositionResources(node.validation, `${base}.validation`, instructions, skills, issues);
    }
  }));
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
