import type { Agent } from "../../shared/domain/agents.js";
import type { ProjectAutomationIssue } from "../../shared/domain/automation.js";
import {
  automationFieldLimits,
  automationStringValidationMessage,
  automationTokenValidationMessage,
  automationOutputIdValidationMessage,
  type AutomationFieldLimit
} from "../../shared/api/automationValidation.js";
import {
  actionOutputSlotCount,
  actionOutputSlotKind,
  defaultProjectOutputs,
  normalizePolicyOutputEventType,
  normalizePolicyToken,
  policyEventTypesForActions
} from "../../shared/policy-actions.js";
import { normalizeProjectAutomationConfig } from "./normalizeAutomationConfig.js";

export class AutomationValidationError extends Error {
  constructor(
    message: string,
    readonly issues: ProjectAutomationIssue[]
  ) {
    super(message);
    this.name = "AutomationValidationError";
  }
}

type RawAutomationConfig = Record<string, unknown>;

interface ValidationContext {
  input: RawAutomationConfig;
  rawTriggers: unknown[];
  rawActions: unknown[];
  rawOutputs: unknown[];
  rawPolicies: unknown[];
  rawWorkflows: unknown[];
  rawRuntimes: unknown[];
  eventIdSet: Set<string>;
  triggerIdSet: Set<string>;
  actionIdSet: Set<string>;
  outputIdSet: Set<string>;
  policyIdSet: Set<string>;
  agentIdSet: Set<string>;
  normalizedPolicies: ReturnType<typeof normalizeProjectAutomationConfig>["policies"];
  normalizedActions: ReturnType<typeof normalizeProjectAutomationConfig>["actions"];
}

interface PolicyValidationState {
  run?: Record<string, unknown>;
  rawEvent: string;
  normalizedEvent: string;
  rawTrigger: string;
  rawSource: string;
  rawAction: string;
  legacyPolicy: boolean;
  normalizedPolicy?: ValidationContext["normalizedPolicies"][number];
  isTriggerPolicy: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const stringValue = (value: unknown): string =>
  typeof value === "string" ? value : "";

const addRequiredStringIssue = (issues: ProjectAutomationIssue[], pathName: string, value: unknown, label: string) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    issues.push({ path: pathName, message: `${label} is required.` });
  }
};

const addStringIssue = (
  issues: ProjectAutomationIssue[],
  pathName: string,
  value: unknown,
  label: string,
  limit: AutomationFieldLimit,
  options?: { required?: boolean; token?: boolean }
) => {
  if (typeof value !== "string") {
    if (options?.required !== false) issues.push({ path: pathName, message: `${label} is required.` });
    return;
  }
  const message = options?.token
    ? automationTokenValidationMessage(label, value)
    : automationStringValidationMessage(label, value, limit, { required: options?.required });
  if (message) issues.push({ path: pathName, message });
};

const addOutputIdIssue = (issues: ProjectAutomationIssue[], pathName: string, value: unknown) => {
  if (typeof value !== "string") {
    issues.push({ path: pathName, message: "Output id is required." });
    return;
  }
  const message = automationOutputIdValidationMessage(value);
  if (message) issues.push({ path: pathName, message });
};

const addUniqueIssues = (issues: ProjectAutomationIssue[], ids: Array<{ id: string; path: string }>, label: string) => {
  const seen = new Map<string, string>();
  for (const item of ids) {
    if (!item.id) continue;
    const previousPath = seen.get(item.id);
    if (previousPath) issues.push({ path: item.path, message: `Duplicate ${label} id: ${item.id}.` });
    else seen.set(item.id, item.path);
  }
};

const requireAutomationArrays = (input: RawAutomationConfig, issues: ProjectAutomationIssue[]) => {
  for (const key of ["triggers", "actions", "outputs", "policies", "workflows", "runtimes"] as const) {
    if ((key === "triggers" || key === "actions" || key === "outputs") && input[key] === undefined) continue;
    if (!Array.isArray(input[key])) issues.push({ path: key, message: `${key} must be an array.` });
  }
};

const collectIdentityIssues = (context: ValidationContext, issues: ProjectAutomationIssue[]) => {
  const normalized = normalizeProjectAutomationConfig(context.input);
  const policyIds = normalized.policies.map((policy, index) => ({ id: policy.id, path: `policies[${index}].id` }));
  const runtimeIds = context.rawRuntimes.map((runtime, index) => ({
    id: isRecord(runtime) ? stringValue(runtime.id) : "",
    path: `runtimes[${index}].id`
  }));
  const outputIds = context.rawOutputs.map((output, index) => ({
    id: isRecord(output) ? normalizePolicyToken(stringValue(output.id)) : "",
    path: `outputs[${index}].id`
  }));
  const workflowIds = context.rawWorkflows.map((workflow, index) => ({
    id: isRecord(workflow) ? stringValue(workflow.id) : "",
    path: `workflows[${index}].id`
  }));

  addUniqueIssues(issues, policyIds, "policy");
  addUniqueIssues(issues, normalized.triggers.map((trigger, index) => ({ id: trigger.id, path: `triggers[${index}].id` })), "trigger");
  addUniqueIssues(issues, normalized.actions.map((action, index) => ({ id: action.id, path: `actions[${index}].id` })), "action");
  addUniqueIssues(issues, outputIds.length > 0 ? outputIds : normalized.outputs.map((output, index) => ({ id: output.id, path: `outputs[${index}].id` })), "output");
  addUniqueIssues(issues, runtimeIds, "runtime");
  addUniqueIssues(issues, workflowIds, "workflow");
};

const createValidationContext = (input: RawAutomationConfig, agents: Agent[]): ValidationContext => {
  const normalized = normalizeProjectAutomationConfig(input, agents);
  const rawPolicies = Array.isArray(input.policies) ? input.policies : [];
  const rawOutputs = Array.isArray(input.outputs) ? input.outputs : [];
  const rawPolicyIds = rawPolicies
    .map((policy) => isRecord(policy) ? stringValue(policy.id) : "")
    .filter(Boolean);
  const configuredOutputIds = (rawOutputs.length > 0 ? rawOutputs : defaultProjectOutputs())
    .map((output) => isRecord(output) ? normalizePolicyToken(stringValue(output.id)) : "")
    .filter(Boolean);
  const generatedEventIds = policyEventTypesForActions(normalized.actions, normalized.outputs);
  const policyIds = normalized.policies.map((policy) => policy.id).filter(Boolean);
  return {
    input,
    rawTriggers: Array.isArray(input.triggers) ? input.triggers : [],
    rawActions: Array.isArray(input.actions) ? input.actions : [],
    rawOutputs,
    rawPolicies,
    rawWorkflows: Array.isArray(input.workflows) ? input.workflows : [],
    rawRuntimes: Array.isArray(input.runtimes) ? input.runtimes : [],
    eventIdSet: new Set(generatedEventIds),
    triggerIdSet: new Set(normalized.triggers.map((trigger) => trigger.id)),
    actionIdSet: new Set(normalized.actions.map((action) => action.id)),
    outputIdSet: new Set(configuredOutputIds),
    policyIdSet: new Set([...policyIds, ...rawPolicyIds]),
    agentIdSet: new Set(agents.map((agent) => agent.id)),
    normalizedPolicies: normalized.policies,
    normalizedActions: normalized.actions
  };
};

const normalizedActionOutputIds = (action: Record<string, unknown>): string[] | undefined =>
  Array.isArray(action.outputIds)
    ? [...new Set(action.outputIds
      .filter((outputId): outputId is string => typeof outputId === "string")
      .map(normalizePolicyToken)
      .filter(Boolean))]
    : undefined;

const legacyCompatibleOutputIds = (outputIds: string[]): boolean => {
  const slotKinds = new Set(outputIds.map(actionOutputSlotKind).filter(Boolean));
  if (outputIds.length === 1) return Boolean(actionOutputSlotKind(outputIds[0] ?? ""));
  return outputIds.length > actionOutputSlotCount &&
    outputIds.every((outputId) => Boolean(actionOutputSlotKind(outputId))) &&
    slotKinds.has("approval") &&
    slotKinds.has("rework");
};

const validateTrigger = (trigger: unknown, index: number, issues: ProjectAutomationIssue[]) => {
  const base = `triggers[${index}]`;
  if (!isRecord(trigger)) {
    issues.push({ path: base, message: "Trigger must be an object." });
    return;
  }
  addStringIssue(issues, `${base}.id`, trigger.id, "Trigger id", automationFieldLimits.token, { token: true });
  addStringIssue(issues, `${base}.description`, trigger.description, "Trigger description", automationFieldLimits.description);
};

const validateAction = (action: unknown, index: number, context: ValidationContext, issues: ProjectAutomationIssue[]) => {
  const base = `actions[${index}]`;
  if (!isRecord(action)) {
    issues.push({ path: base, message: "Action must be an object." });
    return;
  }
  addStringIssue(issues, `${base}.id`, action.id, "Action id", automationFieldLimits.token, { token: true });
  if (action.description !== undefined && typeof action.description !== "string") {
    issues.push({ path: `${base}.description`, message: "Action description must be a string." });
  } else {
    addStringIssue(issues, `${base}.description`, action.description, "Action description", automationFieldLimits.description, { required: false });
  }
  if (action.outputIds !== undefined && !Array.isArray(action.outputIds)) {
    issues.push({ path: `${base}.outputIds`, message: "Action outputIds must be an array." });
    return;
  }
  if (Array.isArray(action.outputIds)) {
    const seenRawOutputIds = new Set<string>();
    action.outputIds.forEach((outputId, outputIndex) => {
      if (typeof outputId !== "string") {
        issues.push({ path: `${base}.outputIds[${outputIndex}]`, message: "Action output id must be a string." });
        return;
      }
      addOutputIdIssue(issues, `${base}.outputIds[${outputIndex}]`, outputId);
      const normalizedOutputId = normalizePolicyOutputEventType(outputId);
      if (seenRawOutputIds.has(normalizedOutputId)) {
        issues.push({ path: `${base}.outputIds[${outputIndex}]`, message: `Duplicate action output id: ${normalizedOutputId}.` });
      }
      seenRawOutputIds.add(normalizedOutputId);
    });
  }
  const normalizedOutputIds = context.normalizedActions[index]?.outputIds ?? [];
  const rawNormalizedOutputIds = normalizedActionOutputIds(action);
  const normalizedAgentIds = context.normalizedActions[index]?.agentIds ?? [];
  if (normalizedAgentIds.length === 0 && (rawNormalizedOutputIds ?? normalizedOutputIds).length > 0) {
    issues.push({ path: `${base}.outputIds`, message: "Action without agents cannot select outputs." });
  }
  if (
    normalizedAgentIds.length > 0 &&
    rawNormalizedOutputIds &&
    rawNormalizedOutputIds.length !== actionOutputSlotCount &&
    !legacyCompatibleOutputIds(rawNormalizedOutputIds)
  ) {
    issues.push({ path: `${base}.outputIds`, message: "Action must define exactly 2 outputs: approval and rework." });
  }
  const seen = new Set<string>();
  const outputIdsToValidate = rawNormalizedOutputIds ?? normalizedOutputIds;
  outputIdsToValidate.forEach((outputId, outputIndex) => {
    if (seen.has(outputId)) issues.push({ path: `${base}.outputIds[${outputIndex}]`, message: `Duplicate action output id: ${outputId}.` });
    seen.add(outputId);
    if (!context.outputIdSet.has(outputId) && !actionOutputSlotKind(outputId)) {
      issues.push({ path: `${base}.outputIds[${outputIndex}]`, message: `Action references unknown output: ${outputId}.` });
    }
  });

  if (action.agentIds !== undefined && !Array.isArray(action.agentIds)) {
    issues.push({ path: `${base}.agentIds`, message: "Action agentIds must be an array." });
    return;
  }
  if (Array.isArray(action.agentIds)) {
    const seenRawAgentIds = new Set<string>();
    action.agentIds.forEach((agentId, agentIndex) => {
      if (typeof agentId !== "string") {
        issues.push({ path: `${base}.agentIds[${agentIndex}]`, message: "Action agent id must be a string." });
        return;
      }
      if (seenRawAgentIds.has(agentId)) {
        issues.push({ path: `${base}.agentIds[${agentIndex}]`, message: `Duplicate action agent id: ${agentId}.` });
      }
      seenRawAgentIds.add(agentId);
    });
  }
  if (normalizedAgentIds.length > 5) {
    issues.push({ path: `${base}.agentIds`, message: "Action can select at most 5 agents." });
  }
  const seenAgents = new Set<string>();
  normalizedAgentIds.forEach((agentId, agentIndex) => {
    if (seenAgents.has(agentId)) issues.push({ path: `${base}.agentIds[${agentIndex}]`, message: `Duplicate action agent id: ${agentId}.` });
    seenAgents.add(agentId);
    if (context.agentIdSet.size > 0 && !context.agentIdSet.has(agentId)) {
      issues.push({ path: `${base}.agentIds[${agentIndex}]`, message: `Action references unknown agent: ${agentId}.` });
    }
  });
};

const validateOutput = (output: unknown, index: number, issues: ProjectAutomationIssue[]) => {
  const base = `outputs[${index}]`;
  if (!isRecord(output)) {
    issues.push({ path: base, message: "Output must be an object." });
    return;
  }
  addOutputIdIssue(issues, `${base}.id`, output.id);
};

const policyValidationState = (
  policy: Record<string, unknown>,
  context: ValidationContext,
  index: number
): PolicyValidationState => {
  const run = isRecord(policy.run) ? policy.run : undefined;
  const rawEvent = stringValue(policy.event) || stringValue(policy.on);
  const normalizedPolicy = context.normalizedPolicies[index];
  return {
    run,
    rawEvent,
    normalizedEvent: normalizedPolicy?.event ?? normalizePolicyOutputEventType(rawEvent),
    rawTrigger: stringValue(policy.trigger),
    rawSource: stringValue(policy.source),
    rawAction: stringValue(policy.action),
    legacyPolicy: policy.event === undefined && policy.agent === undefined && run !== undefined,
    normalizedPolicy,
    isTriggerPolicy: normalizedPolicy?.source === "trigger"
  };
};

const validatePolicySource = (
  state: PolicyValidationState,
  base: string,
  issues: ProjectAutomationIssue[]
) => {
  if (state.rawSource && !["event", "trigger"].includes(state.rawSource)) {
    issues.push({ path: `${base}.source`, message: "Policy source must be event or trigger." });
  }
  if (state.rawEvent && state.rawTrigger) {
    issues.push({ path: base, message: "Policy must reference either event or trigger, not both." });
  }
};

const validatePolicyRequiredFields = (
  policy: Record<string, unknown>,
  state: PolicyValidationState,
  base: string,
  issues: ProjectAutomationIssue[]
) => {
  const sourceField = state.isTriggerPolicy ? "trigger" : "event";
  const sourceValue = state.isTriggerPolicy ? state.rawTrigger : state.rawEvent;
  addRequiredStringIssue(issues, `${base}.${sourceField}`, sourceValue, `Policy ${sourceField}`);
  addStringIssue(
    issues,
    `${base}.${sourceField}`,
    sourceValue,
    `Policy ${sourceField}`,
    state.isTriggerPolicy ? automationFieldLimits.token : automationFieldLimits.eventType,
    { token: state.isTriggerPolicy }
  );
  if (!state.legacyPolicy) addRequiredStringIssue(issues, `${base}.action`, state.rawAction, "Policy action");
  if (!state.legacyPolicy) addStringIssue(issues, `${base}.action`, state.rawAction, "Policy action", automationFieldLimits.token, { token: true });
  if (typeof policy.enabled !== "boolean") issues.push({ path: `${base}.enabled`, message: "Policy enabled must be boolean." });
};

const validatePolicyKnownReferences = (
  state: PolicyValidationState,
  base: string,
  context: ValidationContext,
  issues: ProjectAutomationIssue[]
) => {
  if (state.normalizedPolicy?.action && !context.actionIdSet.has(state.normalizedPolicy.action)) {
    issues.push({ path: `${base}.action`, message: `Policy references unknown action: ${state.rawAction || state.normalizedPolicy.action}.` });
  }
  if (!state.isTriggerPolicy && state.normalizedEvent && !context.eventIdSet.has(state.normalizedEvent)) {
    issues.push({ path: `${base}.event`, message: `Policy references unknown event: ${state.rawEvent}.` });
  }
  if (state.isTriggerPolicy && state.normalizedPolicy?.trigger && !context.triggerIdSet.has(state.normalizedPolicy.trigger)) {
    issues.push({ path: `${base}.trigger`, message: `Policy references unknown trigger: ${state.rawTrigger}.` });
  }
};

const validatePolicyReference = (
  policy: Record<string, unknown>,
  base: string,
  context: ValidationContext,
  index: number,
  issues: ProjectAutomationIssue[]
) => {
  const state = policyValidationState(policy, context, index);
  validatePolicySource(state, base, issues);
  validatePolicyRequiredFields(policy, state, base, issues);
  validatePolicyKnownReferences(state, base, context, issues);
};

const validatePolicy = (policy: unknown, index: number, context: ValidationContext, issues: ProjectAutomationIssue[]) => {
  const base = `policies[${index}]`;
  if (!isRecord(policy)) {
    issues.push({ path: base, message: "Policy must be an object." });
    return;
  }
  validatePolicyReference(policy, base, context, index, issues);
};

const validateRuntime = (runtime: unknown, index: number, issues: ProjectAutomationIssue[]) => {
  const base = `runtimes[${index}]`;
  if (!isRecord(runtime)) {
    issues.push({ path: base, message: "Runtime must be an object." });
    return;
  }
  addStringIssue(issues, `${base}.id`, runtime.id, "Runtime id", automationFieldLimits.token, { token: true });
  addStringIssue(issues, `${base}.title`, runtime.title, "Runtime title", automationFieldLimits.name);
  addStringIssue(issues, `${base}.command`, runtime.command, "Runtime command", automationFieldLimits.command);
  if (!Array.isArray(runtime.args) || runtime.args.some((item) => typeof item !== "string")) {
    issues.push({ path: `${base}.args`, message: "Runtime args must be a string array." });
  } else {
    runtime.args.forEach((arg, argIndex) =>
      addStringIssue(issues, `${base}.args[${argIndex}]`, arg, "Runtime arg", automationFieldLimits.arg)
    );
  }
};

const validateWorkflowStep = (
  step: unknown,
  stepPath: string,
  policyIdSet: Set<string>,
  issues: ProjectAutomationIssue[]
) => {
  if (typeof step !== "string") {
    issues.push({ path: stepPath, message: "Workflow step must be a policy id string." });
    if (isRecord(step)) {
      for (const forbidden of ["on", "event", "agent", "runtime", "action"]) {
        if (forbidden in step) issues.push({ path: `${stepPath}.${forbidden}`, message: `Workflow step must not contain ${forbidden}.` });
      }
    }
    return;
  }
  if (!step.trim()) {
    issues.push({ path: stepPath, message: "Workflow step policy id is required." });
    return;
  }
  if (step.length > automationFieldLimits.policyId.max) {
    issues.push({ path: stepPath, message: `Workflow step policy id must be ${automationFieldLimits.policyId.max} characters or fewer.` });
    return;
  }
  if (!policyIdSet.has(step)) issues.push({ path: stepPath, message: `Workflow references unknown policy: ${step}.` });
};

const validateWorkflow = (workflow: unknown, index: number, context: ValidationContext, issues: ProjectAutomationIssue[]) => {
  const base = `workflows[${index}]`;
  if (!isRecord(workflow)) {
    issues.push({ path: base, message: "Workflow must be an object." });
    return;
  }
  addStringIssue(issues, `${base}.id`, workflow.id, "Workflow id", automationFieldLimits.token, { token: true });
  addStringIssue(issues, `${base}.title`, workflow.title, "Workflow title", automationFieldLimits.name);
  if (!Array.isArray(workflow.steps)) {
    issues.push({ path: `${base}.steps`, message: "Workflow steps must be an array." });
    return;
  }
  workflow.steps.forEach((step, stepIndex) =>
    validateWorkflowStep(step, `${base}.steps[${stepIndex}]`, context.policyIdSet, issues)
  );
};

export const validateProjectAutomationConfig = (
  input: unknown,
  agents: Agent[] = []
): ProjectAutomationIssue[] => {
  const issues: ProjectAutomationIssue[] = [];
  if (!isRecord(input)) return [{ path: "$", message: "Automation config must be a JSON object." }];
  if (input.version !== 1) issues.push({ path: "version", message: "version must be 1." });

  requireAutomationArrays(input, issues);
  const context = createValidationContext(input, agents);
  collectIdentityIssues(context, issues);
  context.rawTriggers.forEach((trigger, index) => validateTrigger(trigger, index, issues));
  context.rawActions.forEach((action, index) => validateAction(action, index, context, issues));
  context.rawOutputs.forEach((output, index) => validateOutput(output, index, issues));
  context.rawPolicies.forEach((policy, index) => validatePolicy(policy, index, context, issues));
  context.rawRuntimes.forEach((runtime, index) => validateRuntime(runtime, index, issues));
  context.rawWorkflows.forEach((workflow, index) => validateWorkflow(workflow, index, context, issues));
  return issues;
};
