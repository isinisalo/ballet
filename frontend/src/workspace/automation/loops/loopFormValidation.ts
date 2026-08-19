import {
  automationConfigSchema,
  getProjectNodeEdges,
  getReachableProjectNodeIds,
  hasReachableProjectLoopTerminal,
  isProjectAgentValidationNode,
  isProjectNodeTerminalTarget,
  isProjectProviderWorkNode,
  kebabCaseIdPattern,
  maxProjectStateBytes,
  type ExecutionProfile,
  type JsonValue,
  type LocalRuntime,
  type ProjectAutomationConfig,
  type ProjectAutomationIssue,
  type ProjectExecutionComposition,
  type ProjectInstruction,
  type ProjectLoop,
  type ProjectLoopEdge,
  type ProjectWorkLoopNode,
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
  const instructionIds = new Set(instructions.flatMap((instruction) =>
    instruction.valid && instruction.id ? [instruction.id] : []));
  const skillIds = new Set(skills.flatMap((skill) => skill.valid ? [skill.id] : []));
  const loopIds = new Set(config.loops.map((loop) => loop.id));
  const issues: ProjectAutomationIssue[] = [];

  issues.push(...duplicateIdIssues(config.loops.map((loop, index) => ({ id: loop.id, path: `loops.${index}.id` })), "Loop"));
  issues.push(...duplicateIdIssues(config.loops.flatMap((loop, loopIndex) => loop.nodes.map((node, nodeIndex) => ({
    id: node.id,
    path: `loops.${loopIndex}.nodes.${nodeIndex}.id`
  }))), "Work Loop Node"));
  issues.push(...duplicateIdIssues([
    ...config.loops.flatMap((loop, loopIndex) => loop.edges.map((edge, edgeIndex) => ({ id: edge.id, path: `loops.${loopIndex}.edges.${edgeIndex}.id` }))),
    ...config.graph.loopEdges.map((edge, edgeIndex) => ({ id: edge.id, path: `graph.loopEdges.${edgeIndex}.id` }))
  ], "Edge"));

  validateComposition(config.orchestrator, "orchestrator", profileById, instructionIds, skillIds, runtime, issues);
  config.loops.forEach((loop, loopIndex) => validateLoop(
    loop, loopIndex, profileById, instructionIds, skillIds, runtime, issues
  ));
  config.graph.loopEdges.forEach((edge, edgeIndex) => {
    if (!loopIds.has(edge.source)) issues.push({ path: `graph.loopEdges.${edgeIndex}.source`, message: `Unknown source Loop: ${edge.source}.` });
    if (!loopIds.has(edge.target)) issues.push({ path: `graph.loopEdges.${edgeIndex}.target`, message: `Unknown target Loop: ${edge.target}.` });
  });
  issues.push(...duplicateIdIssues(config.graph.loopEdges.map((edge, edgeIndex) => ({
    id: `${edge.source}→${edge.target}:${edge.kind}:${edge.capability}`,
    path: `graph.loopEdges.${edgeIndex}.capability`
  })), "Loop Edge route candidate"));
  return issues;
}

function validateLoop(
  loop: ProjectLoop,
  loopIndex: number,
  profiles: ReadonlyMap<string, ExecutionProfile>,
  instructions: ReadonlySet<string>,
  skills: ReadonlySet<string>,
  runtime: LocalRuntime,
  issues: ProjectAutomationIssue[]
) {
  const base = `loops.${loopIndex}`;
  const nodeIds = new Set(loop.nodes.map((node) => node.id));
  if (!nodeIds.has(loop.startNodeId)) issues.push({ path: `${base}.startNodeId`, message: `Unknown start Work Loop Node: ${loop.startNodeId}.` });
  loop.nodes.forEach((node, nodeIndex) => {
    const nodeBase = `${base}.nodes.${nodeIndex}`;
    const outgoing = getProjectNodeEdges(loop, node.id);
    if (outgoing.length !== 1) issues.push({
      path: `${base}.edges`,
      message: `Validation OK for ${node.id} must have exactly one target; found ${outgoing.length}.`
    });
    if (node.work.type === "scheduled" && node.id !== loop.startNodeId) issues.push({
      path: `${nodeBase}.work.type`,
      message: "Scheduled Work is allowed only in the start Work Loop Node."
    });
    if (isProjectProviderWorkNode(node.work)) {
      validateComposition(node.work, `${nodeBase}.work`, profiles, instructions, skills, runtime, issues);
    }
    if (isProjectAgentValidationNode(node.validation)) {
      validateComposition(node.validation, `${nodeBase}.validation`, profiles, instructions, skills, runtime, issues);
    }
  });
  loop.edges.forEach((edge, edgeIndex) => {
    if (!nodeIds.has(edge.source)) issues.push({ path: `${base}.edges.${edgeIndex}.source`, message: `Unknown source Work Loop Node: ${edge.source}.` });
    if (!isProjectNodeTerminalTarget(edge.target) && !nodeIds.has(edge.target.nodeId)) issues.push({
      path: `${base}.edges.${edgeIndex}.target.nodeId`,
      message: `Unknown target Work Loop Node: ${edge.target.nodeId}.`
    });
  });
  if (nodeIds.has(loop.startNodeId)) {
    const reachable = getReachableProjectNodeIds(loop);
    loop.nodes.forEach((node, nodeIndex) => {
      if (!reachable.has(node.id)) issues.push({ path: `${base}.nodes.${nodeIndex}.id`, message: `Unreachable Work Loop Node: ${node.id}.` });
    });
    if (!hasReachableProjectLoopTerminal(loop)) issues.push({ path: `${base}.edges`, message: "Loop needs a reachable terminal target." });
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
  if (!instructions.has(composition.primaryInstructionId)) issues.push({
    path: `${path}.primaryInstructionId`, message: "Select an existing primary instruction."
  });
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

export const workLoopNodeIdError = (
  node: ProjectWorkLoopNode,
  loop: ProjectLoop,
  loops: readonly ProjectLoop[] = [loop]
): string | undefined => {
  if (!node.id) return "Work Loop Node ID is required.";
  if (!kebabCaseIdPattern.test(node.id)) return "Work Loop Node ID must be lowercase kebab-case.";
  if (loops.some((candidateLoop) => candidateLoop.nodes.some((candidate) => candidate !== node && candidate.id === node.id))) {
    return "Work Loop Node ID must be unique.";
  }
  return undefined;
};

export const loopEdgeIdError = (edge: ProjectLoopEdge, config: ProjectAutomationConfig): string | undefined => {
  if (!edge.id) return "Loop Edge ID is required.";
  if (!kebabCaseIdPattern.test(edge.id)) return "Loop Edge ID must be lowercase kebab-case.";
  const nodeEdgeHasId = config.loops.some((loop) => loop.edges.some((candidate) => candidate.id === edge.id));
  const loopEdgeHasId = config.graph.loopEdges.some((candidate) => candidate !== edge && candidate.id === edge.id);
  return nodeEdgeHasId || loopEdgeHasId ? "Edge ID must be unique across Node and Loop Edges." : undefined;
};

export const loopEdgeRouteError = (edge: ProjectLoopEdge, config: ProjectAutomationConfig): string | undefined => {
  const duplicate = config.graph.loopEdges.some((candidate) => candidate !== edge
    && candidate.source === edge.source && candidate.target === edge.target
    && candidate.kind === edge.kind && candidate.capability === edge.capability);
  return duplicate ? "This route candidate already exists." : undefined;
};

export type InitialStateParseResult = { value: JsonValue; error?: never } | { value?: never; error: string };

export const parseInitialState = (text: string): InitialStateParseResult => {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { error: "Initial state must be valid JSON." };
  }
  if (!isJsonValue(value)) return { error: "Initial state must contain only JSON values." };
  const bytes = new TextEncoder().encode(JSON.stringify(value)).byteLength;
  return bytes > maxProjectStateBytes
    ? { error: `Initial state must not exceed ${maxProjectStateBytes} bytes.` }
    : { value };
};

const isJsonValue = (value: unknown): value is JsonValue => {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (typeof value !== "object") return false;
  return Object.values(value as Record<string, unknown>).every(isJsonValue);
};
