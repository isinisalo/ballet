import {
  automationConfigSchema,
  getReachableProjectJobNodeIds,
  hasReachableProjectWorkflowPass,
  isProjectAgentValidationNode,
  isProjectProviderJobNode,
  kebabCaseIdPattern,
  maxProjectStateBytes,
  type ExecutionProfile,
  type JsonValue,
  type LocalRuntime,
  type ProjectAutomationConfig,
  type ProjectAutomationIssue,
  type ProjectExecutionComposition,
  type ProjectFailEdge,
  type ProjectInstruction,
  type ProjectJobNode,
  type ProjectLoop,
  type ProjectPassEdge,
  type ProjectValidationNode,
  type Skill
} from "@shared/api/workspace-contracts";
import { executionProfileBlockingReason } from "../../executionProfiles/executionProfileOptions";

export const automationDraftIsStructurallyValid = (config: ProjectAutomationConfig): boolean =>
  automationConfigSchema.safeParse(config).success;

export const automationDraftIsValid = (
  config: ProjectAutomationConfig,
  executionProfiles: ExecutionProfile[],
  instructions: ProjectInstruction[],
  skills: Skill[],
  runtime: LocalRuntime
): boolean => automationDraftIssues(config, executionProfiles, instructions, skills, runtime).length === 0;

export function automationDraftIssues(
  config: ProjectAutomationConfig,
  executionProfiles: ExecutionProfile[],
  instructions: ProjectInstruction[],
  skills: Skill[],
  runtime: LocalRuntime
): ProjectAutomationIssue[] {
  const parsed = automationConfigSchema.safeParse(config);
  if (!parsed.success) return parsed.error.issues.map((issue) => ({
    path: issue.path.length ? issue.path.map(String).join(".") : "automation",
    message: issue.message
  }));

  const profileById = new Map(executionProfiles.map((profile) => [profile.id, profile]));
  const instructionIds = new Set(instructions.flatMap((instruction) => instruction.valid && instruction.id ? [instruction.id] : []));
  const skillIds = new Set(skills.flatMap((skill) => skill.valid ? [skill.id] : []));
  const loopIds = new Set(config.loops.map((loop) => loop.id));
  const issues: ProjectAutomationIssue[] = [];

  issues.push(...duplicateIdIssues(config.loops.map((loop, index) => ({ id: loop.id, path: `loops.${index}.id` })), "Loop"));
  issues.push(...duplicateIdIssues(config.loops.flatMap((loop, loopIndex) => loop.workflow.jobNodes.map((node, nodeIndex) => ({ id: node.id, path: `loops.${loopIndex}.workflow.jobNodes.${nodeIndex}.id` }))), "Job Node"));
  issues.push(...duplicateIdIssues(config.loops.flatMap((loop, loopIndex) => loop.workflow.validationNodes.map((node, nodeIndex) => ({ id: node.id, path: `loops.${loopIndex}.workflow.validationNodes.${nodeIndex}.id` }))), "Validation Node"));
  issues.push(...duplicateIdIssues([
    ...config.loops.flatMap((loop, loopIndex) => loop.workflow.passEdges.map((edge, edgeIndex) => ({ id: edge.id, path: `loops.${loopIndex}.workflow.passEdges.${edgeIndex}.id` }))),
    ...config.loops.flatMap((loop, loopIndex) => loop.workflow.failEdges.map((edge, edgeIndex) => ({ id: edge.id, path: `loops.${loopIndex}.workflow.failEdges.${edgeIndex}.id` }))),
    ...config.graph.transitions.map((edge, edgeIndex) => ({ id: edge.id, path: `graph.transitions.${edgeIndex}.id` })),
    ...config.graph.repairEdges.map((edge, edgeIndex) => ({ id: edge.id, path: `graph.repairEdges.${edgeIndex}.id` }))
  ], "Edge"));

  if (config.orchestrator.repairRouter) validateComposition(
    config.orchestrator.repairRouter, "orchestrator.repairRouter",
    profileById, instructionIds, skillIds, runtime, issues
  );
  config.loops.forEach((loop, loopIndex) => validateWorkflow(loop, loopIndex, profileById, instructionIds, skillIds, runtime, issues));
  if (!loopIds.has(config.graph.startLoopId)) issues.push({ path: "graph.startLoopId", message: `Unknown start Loop: ${config.graph.startLoopId}.` });
  config.graph.transitions.forEach((edge, edgeIndex) => {
    if (!loopIds.has(edge.source)) issues.push({ path: `graph.transitions.${edgeIndex}.source`, message: `Unknown source Loop: ${edge.source}.` });
    if ("loopId" in edge.target && !loopIds.has(edge.target.loopId)) issues.push({ path: `graph.transitions.${edgeIndex}.target.loopId`, message: `Unknown target Loop: ${edge.target.loopId}.` });
  });
  config.graph.repairEdges.forEach((edge, edgeIndex) => {
    if (!loopIds.has(edge.source)) issues.push({ path: `graph.repairEdges.${edgeIndex}.source`, message: `Unknown source Loop: ${edge.source}.` });
    const target = config.loops.find((loop) => loop.id === edge.target);
    if (!target) issues.push({ path: `graph.repairEdges.${edgeIndex}.target`, message: `Unknown target Loop: ${edge.target}.` });
    else if (!target.capabilities.provides.includes(edge.capability)) issues.push({ path: `graph.repairEdges.${edgeIndex}.capability`, message: `Target Loop ${edge.target} does not provide ${edge.capability}.` });
  });
  if (config.graph.repairEdges.length && !config.orchestrator.repairRouter) issues.push({ path: "orchestrator.repairRouter", message: "Repair edges require a repair router." });
  issues.push(...duplicateIdIssues(config.graph.transitions.map((edge, edgeIndex) => ({ id: `${edge.source}:${edge.decision}:${edge.outcome}`, path: `graph.transitions.${edgeIndex}.outcome` })), "RunBook transition key"));
  return issues;
}

function validateWorkflow(
  loop: ProjectLoop,
  loopIndex: number,
  profiles: ReadonlyMap<string, ExecutionProfile>,
  instructions: ReadonlySet<string>,
  skills: ReadonlySet<string>,
  runtime: LocalRuntime,
  issues: ProjectAutomationIssue[]
) {
  const base = `loops.${loopIndex}.workflow`;
  const jobIds = new Set(loop.workflow.jobNodes.map((job) => job.id));
  const validationIds = new Set(loop.workflow.validationNodes.map((validation) => validation.id));
  if (!jobIds.has(loop.workflow.startJobNodeId)) issues.push({ path: `${base}.startJobNodeId`, message: `Unknown start Job Node: ${loop.workflow.startJobNodeId}.` });

  loop.workflow.jobNodes.forEach((job, jobIndex) => {
    const jobBase = `${base}.jobNodes.${jobIndex}`;
    const pairedValidationCount = loop.workflow.validationNodes.filter((validation) => validation.id === job.validationNodeId).length;
    if (pairedValidationCount !== 1) issues.push({ path: `${jobBase}.validationNodeId`, message: `Job ${job.id} must own exactly one Validation Node; found ${pairedValidationCount}.` });
    if (loop.workflow.jobNodes.filter((candidate) => candidate.validationNodeId === job.validationNodeId).length !== 1) issues.push({ path: `${jobBase}.validationNodeId`, message: `Validation Node ${job.validationNodeId} cannot be shared.` });
    if (job.type === "scheduled" && job.id !== loop.workflow.startJobNodeId) issues.push({ path: `${jobBase}.type`, message: "Scheduled Job is allowed only as the Workflow start." });
    if (isProjectProviderJobNode(job)) validateComposition(job, jobBase, profiles, instructions, skills, runtime, issues);
  });
  loop.workflow.validationNodes.forEach((validation, validationIndex) => {
    const validationBase = `${base}.validationNodes.${validationIndex}`;
    if (!loop.workflow.jobNodes.some((job) => job.validationNodeId === validation.id)) issues.push({ path: `${validationBase}.id`, message: `Orphan Validation Node: ${validation.id}.` });
    const passCount = loop.workflow.passEdges.filter((edge) => edge.sourceValidationNodeId === validation.id).length;
    const failCount = loop.workflow.failEdges.filter((edge) => edge.sourceValidationNodeId === validation.id).length;
    if (passCount !== 1) issues.push({ path: `${base}.passEdges`, message: `Validation ${validation.id} must have exactly one Pass Edge; found ${passCount}.` });
    if (failCount !== 1) issues.push({ path: `${base}.failEdges`, message: `Validation ${validation.id} must have exactly one Fail Edge; found ${failCount}.` });
    if (isProjectAgentValidationNode(validation)) validateComposition(validation, validationBase, profiles, instructions, skills, runtime, issues);
  });
  loop.workflow.passEdges.forEach((edge, edgeIndex) => {
    if (!validationIds.has(edge.sourceValidationNodeId)) issues.push({ path: `${base}.passEdges.${edgeIndex}.sourceValidationNodeId`, message: `Unknown source Validation Node: ${edge.sourceValidationNodeId}.` });
    if ("jobNodeId" in edge.target && !jobIds.has(edge.target.jobNodeId)) issues.push({ path: `${base}.passEdges.${edgeIndex}.target.jobNodeId`, message: `Unknown target Job Node: ${edge.target.jobNodeId}.` });
  });
  loop.workflow.failEdges.forEach((edge, edgeIndex) => {
    if (!validationIds.has(edge.sourceValidationNodeId)) issues.push({ path: `${base}.failEdges.${edgeIndex}.sourceValidationNodeId`, message: `Unknown source Validation Node: ${edge.sourceValidationNodeId}.` });
  });

  if (jobIds.has(loop.workflow.startJobNodeId)) {
    const reachable = getReachableProjectJobNodeIds(loop);
    loop.workflow.jobNodes.forEach((job, jobIndex) => {
      if (!reachable.has(job.id)) issues.push({ path: `${base}.jobNodes.${jobIndex}.id`, message: `Unreachable Job Node: ${job.id}.` });
    });
    if (!hasReachableProjectWorkflowPass(loop)) issues.push({ path: `${base}.passEdges`, message: "Workflow needs a reachable PASS endpoint." });
  }
}

function validateComposition(
  composition: ProjectExecutionComposition,
  path: string,
  profiles: ReadonlyMap<string, ExecutionProfile>,
  instructions: ReadonlySet<string>,
  skills: ReadonlySet<string>,
  runtime: LocalRuntime,
  issues: ProjectAutomationIssue[]
) {
  const profile = profiles.get(composition.executionProfileId);
  if (!profile) issues.push({ path: `${path}.executionProfileId`, message: "Select an existing execution profile." });
  else {
    const blockingReason = executionProfileBlockingReason(profile, runtime);
    if (blockingReason) issues.push({ path: `${path}.executionProfileId`, message: blockingReason });
  }
  if (!instructions.has(composition.primaryInstructionId)) issues.push({ path: `${path}.primaryInstructionId`, message: "Select an existing primary instruction." });
  composition.skillIds.forEach((skillId, index) => {
    if (!skills.has(skillId)) issues.push({ path: `${path}.skillIds.${index}`, message: `Missing or invalid skill: ${skillId}.` });
  });
}

function duplicateIdIssues(values: Array<{ id: string; path: string }>, label: string): ProjectAutomationIssue[] {
  const seen = new Set<string>();
  return values.flatMap((value) => {
    const duplicate = seen.has(value.id);
    seen.add(value.id);
    return duplicate ? [{ path: value.path, message: `Duplicate ${label} id: ${value.id}.` }] : [];
  });
}

export const loopIdError = (loop: ProjectLoop, loops: readonly ProjectLoop[]): string | undefined => {
  if (!loop.id) return "Loop ID is required.";
  if (!kebabCaseIdPattern.test(loop.id)) return "Loop ID must be lowercase kebab-case.";
  if (loops.some((candidate) => candidate !== loop && candidate.id === loop.id)) return "Loop ID must be unique.";
  return undefined;
};

export const jobNodeIdError = (node: ProjectJobNode, loop: ProjectLoop, loops: readonly ProjectLoop[] = [loop]): string | undefined => {
  if (!node.id) return "Job Node ID is required.";
  if (!kebabCaseIdPattern.test(node.id)) return "Job Node ID must be lowercase kebab-case.";
  if (loops.some((candidateLoop) => candidateLoop.workflow.jobNodes.some((candidate) => candidate !== node && candidate.id === node.id))) return "Job Node ID must be unique.";
  return undefined;
};

export const validationNodeIdError = (node: ProjectValidationNode, loop: ProjectLoop, loops: readonly ProjectLoop[] = [loop]): string | undefined => {
  if (!node.id) return "Validation Node ID is required.";
  if (!kebabCaseIdPattern.test(node.id)) return "Validation Node ID must be lowercase kebab-case.";
  if (loops.some((candidateLoop) => candidateLoop.workflow.validationNodes.some((candidate) => candidate !== node && candidate.id === node.id))) return "Validation Node ID must be unique.";
  return undefined;
};

export const workflowEdgeIdError = (edge: ProjectPassEdge | ProjectFailEdge, loop: ProjectLoop): string | undefined => {
  if (!edge.id) return "Workflow Edge ID is required.";
  if (!kebabCaseIdPattern.test(edge.id)) return "Workflow Edge ID must be lowercase kebab-case.";
  const duplicate = [...loop.workflow.passEdges, ...loop.workflow.failEdges].some((candidate) => candidate !== edge && candidate.id === edge.id);
  return duplicate ? "Workflow Edge ID must be unique." : undefined;
};

export type InitialStateParseResult = { value: JsonValue; error?: never } | { value?: never; error: string };

export const parseInitialState = (text: string): InitialStateParseResult => {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { error: "Initial State must be valid JSON." };
  }
  if (!isJsonValue(value)) return { error: "Initial State must contain only JSON values." };
  const bytes = new TextEncoder().encode(JSON.stringify(value)).byteLength;
  return bytes > maxProjectStateBytes ? { error: `Initial State must not exceed ${maxProjectStateBytes} bytes.` } : { value };
};

const isJsonValue = (value: unknown): value is JsonValue => {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (typeof value !== "object") return false;
  return Object.values(value as Record<string, unknown>).every(isJsonValue);
};
