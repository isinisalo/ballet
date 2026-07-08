import type { Agent } from "../../shared/domain/agents.js";
import type { ProjectAutomationIssue } from "../../shared/domain/automation.js";
import {
  automationFieldLimits,
  automationStringValidationMessage,
  automationTokenValidationMessage,
  automationOutputIdValidationMessage,
  automationLoopIdValidationMessage,
  type AutomationFieldLimit
} from "../../shared/api/automationValidation.js";
import {
  actionOutputIds,
  actionOutputSlotMinCount,
  actionOutputSlotCount,
  actionOutputSlotKind,
  humanGateApprovalTriggerId,
  humanGateResponseId,
  normalizePolicyOutputEventType,
  normalizePolicyToken,
  normalizeTriggerToken,
  normalizeLoopId,
  policyEventTypesForActions,
  policyOutputEventTypes,
  projectOutputRouteKey,
  loopIdForPolicy
} from "../../shared/policy-actions.js";
import { normalizeProjectAutomationConfig } from "./normalizeAutomationConfig.js";

// This legacy validation module intentionally stays centralized for now because
// existing policy/action migration checks share one normalized context.
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
  rawActions: unknown[];
  rawOutputs: unknown[];
  rawOutputRoutes: unknown[];
  rawHumanGateResponses: unknown[];
  rawPolicies: unknown[];
  rawLoops: unknown[];
  rawRuntimes: unknown[];
  eventIdSet: Set<string>;
  triggerIdSet: Set<string>;
  actionIdSet: Set<string>;
  outputIdSet: Set<string>;
  policyIdSet: Set<string>;
  loopIdSet: Set<string>;
  agentIdSet: Set<string>;
  normalizedPolicies: ReturnType<typeof normalizeProjectAutomationConfig>["policies"];
  normalizedLoops: ReturnType<typeof normalizeProjectAutomationConfig>["loops"];
  normalizedActions: ReturnType<typeof normalizeProjectAutomationConfig>["actions"];
  normalizedOutputRoutes: ReturnType<typeof normalizeProjectAutomationConfig>["outputRoutes"];
}

interface PolicyValidationState {
  run?: Record<string, unknown>;
  rawEvent: string;
  normalizedEvent: string;
  rawTrigger: string;
  rawExplicitTrigger: string;
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

const addLoopIdIssue = (issues: ProjectAutomationIssue[], pathName: string, value: unknown, label: string) => {
  if (typeof value !== "string") {
    issues.push({ path: pathName, message: `${label} is required.` });
    return;
  }
  const message = automationLoopIdValidationMessage(label, value);
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
  if (input.triggers !== undefined) {
    issues.push({ path: "triggers", message: "Triggers are derived from human gate approval outputs." });
  }
  for (const key of ["actions", "outputs", "outputRoutes", "humanGateResponses", "policies", "loops", "runtimes"] as const) {
    if ((key === "actions" || key === "outputs") && input[key] === undefined) continue;
    if (key === "humanGateResponses" && input[key] === undefined) continue;
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
  const loopIds = normalized.loops.map((loop, index) => ({
    id: loop.id,
    path: `loops[${index}].id`
  }));

  addUniqueIssues(issues, policyIds, "policy");
  addUniqueIssues(issues, normalized.actions.map((action, index) => ({ id: action.id, path: `actions[${index}].id` })), "action");
  addUniqueIssues(issues, outputIds.length > 0 ? outputIds : normalized.outputs.map((output, index) => ({ id: output.id, path: `outputs[${index}].id` })), "output");
  addUniqueIssues(issues, normalized.humanGateResponses.map((response, index) => ({ id: response.id, path: `humanGateResponses[${index}].id` })), "human gate response");
  addUniqueIssues(issues, runtimeIds, "runtime");
  addUniqueIssues(issues, loopIds, "loop");
};

const createValidationContext = (input: RawAutomationConfig, agents: Agent[]): ValidationContext => {
  const normalized = normalizeProjectAutomationConfig(input, agents);
  const rawPolicies = Array.isArray(input.policies) ? input.policies : [];
  const rawOutputs = Array.isArray(input.outputs) ? input.outputs : [];
  const rawLoops = Array.isArray(input.loops) ? input.loops : [];
  const rawPolicyIds = rawPolicies
    .map((policy) => isRecord(policy) ? stringValue(policy.id) : "")
    .filter(Boolean);
  const configuredOutputIds = normalized.outputs
    .map((output) => normalizePolicyToken(output.id))
    .filter(Boolean);
  const generatedEventIds = [
    ...policyEventTypesForActions(normalized.actions, normalized.outputs),
    ...normalized.policies.flatMap((policy) =>
      policyOutputEventTypes(policy, normalized.actions, normalized.outputs)
    ),
    ...normalized.policies.flatMap((policy) =>
      policy.source === "event" && policy.event?.startsWith("trigger.") ? [policy.event] : []
    )
  ];
  const policyIds = normalized.policies.map((policy) => policy.id).filter(Boolean);
  const triggerIds = [
    ...derivedHumanGateTriggerIds(normalized.actions),
    ...normalized.policies.flatMap((policy) => policy.source === "trigger" && policy.trigger ? [policy.trigger] : [])
  ];
  return {
    input,
    rawActions: Array.isArray(input.actions) ? input.actions : [],
    rawOutputs,
    rawOutputRoutes: Array.isArray(input.outputRoutes) ? input.outputRoutes : [],
    rawHumanGateResponses: Array.isArray(input.humanGateResponses) ? input.humanGateResponses : [],
    rawPolicies,
    rawLoops,
    rawRuntimes: Array.isArray(input.runtimes) ? input.runtimes : [],
    eventIdSet: new Set(generatedEventIds),
    triggerIdSet: new Set(triggerIds),
    actionIdSet: new Set(normalized.actions.map((action) => action.id)),
    outputIdSet: new Set(configuredOutputIds),
    policyIdSet: new Set([...policyIds, ...rawPolicyIds]),
    loopIdSet: new Set(normalized.loops.map((loop) => loop.id).filter(Boolean)),
    agentIdSet: new Set(agents.map((agent) => agent.id)),
    normalizedPolicies: normalized.policies,
    normalizedLoops: normalized.loops,
    normalizedActions: normalized.actions,
    normalizedOutputRoutes: normalized.outputRoutes
  };
};

const derivedHumanGateTriggerIds = (actions: ValidationContext["normalizedActions"]): string[] =>
  actions.flatMap((action) => {
    if (!action.humanGate) return [];
    const approvalOutputId = actionOutputIds(actions, action.id)[0];
    return approvalOutputId ? [humanGateApprovalTriggerId(action.id, approvalOutputId)] : [];
  });

const normalizedActionOutputIds = (action: Record<string, unknown>): string[] | undefined =>
  Array.isArray(action.outputIds)
    ? [...new Set(action.outputIds
      .filter((outputId): outputId is string => typeof outputId === "string")
      .map(normalizePolicyToken)
      .filter(Boolean))]
    : undefined;

const isLegacyCompatibleOutputId = (outputId: string, outputIndex: number): boolean =>
  Boolean(actionOutputSlotKind(outputId)) || outputIndex < actionOutputSlotCount;

const legacyCompatibleOutputIds = (outputIds: string[]): boolean => {
  const slotKinds = new Set(outputIds.map(actionOutputSlotKind).filter(Boolean));
  return outputIds.length > actionOutputSlotCount &&
    outputIds.every((outputId) => Boolean(actionOutputSlotKind(outputId))) &&
    slotKinds.has("approval") &&
    slotKinds.has("rework");
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
  if (action.humanGate !== undefined && typeof action.humanGate !== "boolean") {
    issues.push({ path: `${base}.humanGate`, message: "Action humanGate must be boolean." });
  }
  const isHumanGate = action.humanGate === true;
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
  if (!isHumanGate && normalizedAgentIds.length === 0 && (rawNormalizedOutputIds ?? normalizedOutputIds).length > 0) {
    issues.push({ path: `${base}.outputIds`, message: "Action without agents cannot select outputs." });
  }
  if (
    (normalizedAgentIds.length > 0 || isHumanGate) &&
    rawNormalizedOutputIds &&
    (rawNormalizedOutputIds.length < actionOutputSlotMinCount || rawNormalizedOutputIds.length > actionOutputSlotCount) &&
    !legacyCompatibleOutputIds(rawNormalizedOutputIds)
  ) {
    issues.push({ path: `${base}.outputIds`, message: "Action must define 1 or 2 outputs: approval and optional rework." });
  }
  if (isHumanGate && (rawNormalizedOutputIds ?? normalizedOutputIds).length < actionOutputSlotMinCount) {
    issues.push({ path: `${base}.outputIds`, message: "Human gate action must define an approval output." });
  }
  const seen = new Set<string>();
  const outputIdsToValidate = rawNormalizedOutputIds ?? normalizedOutputIds;
  outputIdsToValidate.forEach((outputId, outputIndex) => {
    if (seen.has(outputId)) issues.push({ path: `${base}.outputIds[${outputIndex}]`, message: `Duplicate action output id: ${outputId}.` });
    seen.add(outputId);
    if (!context.outputIdSet.has(outputId) && !isLegacyCompatibleOutputId(outputId, outputIndex)) {
      issues.push({ path: `${base}.outputIds[${outputIndex}]`, message: `Action references unknown output: ${outputId}.` });
    }
  });

  if (action.agentIds !== undefined && !Array.isArray(action.agentIds)) {
    issues.push({ path: `${base}.agentIds`, message: "Action agentIds must be an array." });
    return;
  }
  const rawAgentIds = Array.isArray(action.agentIds)
    ? action.agentIds.filter((agentId) => typeof agentId === "string" && agentId.trim().length > 0)
    : [];
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
  if (isHumanGate && rawAgentIds.length > 0) {
    issues.push({ path: `${base}.agentIds`, message: "Human gate action cannot select agents." });
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

const validateHumanGateResponse = (
  response: unknown,
  index: number,
  context: ValidationContext,
  issues: ProjectAutomationIssue[]
) => {
  const base = `humanGateResponses[${index}]`;
  if (!isRecord(response)) {
    issues.push({ path: base, message: "Human gate response must be an object." });
    return;
  }
  addStringIssue(issues, `${base}.id`, response.id, "Human gate response id", { min: 1, max: 260 });
  addStringIssue(issues, `${base}.policyId`, response.policyId, "Human gate response policy", automationFieldLimits.policyId);
  addStringIssue(issues, `${base}.actionId`, response.actionId, "Human gate response action", automationFieldLimits.token, { token: true });
  addOutputIdIssue(issues, `${base}.outputId`, response.outputId);
  if (response.prompt !== undefined && typeof response.prompt !== "string") {
    issues.push({ path: `${base}.prompt`, message: "Human gate response prompt must be a string." });
  } else {
    addStringIssue(issues, `${base}.prompt`, response.prompt, "Human gate response prompt", { min: 1, max: 2000 });
  }
  addStringIssue(issues, `${base}.submittedAt`, response.submittedAt, "Human gate response submittedAt", { min: 1, max: 80 });

  const loopId = normalizeLoopId(stringValue(response.loopId));
  if (response.loopId !== undefined) {
    addLoopIdIssue(issues, `${base}.loopId`, response.loopId, "Human gate response loop");
    if (loopId && !context.loopIdSet.has(loopId)) {
      issues.push({ path: `${base}.loopId`, message: `Human gate response references unknown loop: ${loopId}.` });
    }
  }

  const policyId = stringValue(response.policyId);
  const policy = context.normalizedPolicies.find((candidate) => candidate.id === policyId);
  if (policyId && !policy) {
    issues.push({ path: `${base}.policyId`, message: `Human gate response references unknown policy: ${policyId}.` });
  }
  const actionId = normalizePolicyToken(stringValue(response.actionId));
  const action = context.normalizedActions.find((candidate) => candidate.id === actionId);
  if (actionId && !action) {
    issues.push({ path: `${base}.actionId`, message: `Human gate response references unknown action: ${actionId}.` });
  } else if (action && !action.humanGate) {
    issues.push({ path: `${base}.actionId`, message: `Human gate response action is not a human gate: ${actionId}.` });
  }
  if (policy && actionId && policy.action !== actionId) {
    issues.push({ path: `${base}.policyId`, message: `Human gate response policy does not run action: ${actionId}.` });
  }
  const rawOutputId = normalizePolicyToken(stringValue(response.outputId));
  const responseSlot = actionOutputSlotKind(rawOutputId);
  const outputId = responseSlot === "approval"
    ? action?.outputIds[0] ?? rawOutputId
    : responseSlot === "rework"
      ? action?.outputIds[1] ?? rawOutputId
      : rawOutputId;
  if (action && outputId && !actionOutputIds(context.normalizedActions, action.id).includes(outputId)) {
    issues.push({ path: `${base}.outputId`, message: `Human gate response references unavailable output ${outputId} for action ${action.id}.` });
  }
  const expectedId = policyId && actionId ? humanGateResponseId({ loopId, policyId, actionId }) : "";
  if (expectedId && stringValue(response.id) !== expectedId) {
    issues.push({ path: `${base}.id`, message: `Human gate response id must be ${expectedId}.` });
  }
};

const validateOutputRouteTarget = (
  target: unknown,
  base: string,
  issues: ProjectAutomationIssue[]
): boolean => {
  if (!isRecord(target)) {
    issues.push({ path: base, message: "Output route target must be an object." });
    return false;
  }

  if (target.type !== "policy" && target.type !== "event") {
    issues.push({ path: `${base}.type`, message: "Output route target type must be policy." });
    return false;
  }

  if (target.type === "policy") {
    addStringIssue(issues, `${base}.policyId`, target.policyId, "Output route target policy", automationFieldLimits.policyId);
    return typeof target.policyId === "string" && target.policyId.trim().length > 0;
  }

  // Raw legacy configs may name an event target; ProjectOutputTarget itself is
  // still the normalized policy reference projected from that event.
  if (target.type === "event") {
    if (target.eventType !== undefined) {
      addStringIssue(issues, `${base}.eventType`, target.eventType, "Output route event type", automationFieldLimits.eventType);
    }
    return true;
  }

  issues.push({ path: `${base}.type`, message: "Output route target type must be policy." });
  return false;
};

const validateOutputRoute = (
  route: unknown,
  index: number,
  context: ValidationContext,
  issues: ProjectAutomationIssue[],
  seenRouteKeys: Set<string>
) => {
  const base = `outputRoutes[${index}]`;
  if (!isRecord(route)) {
    issues.push({ path: base, message: "Output route must be an object." });
    return;
  }

  addStringIssue(issues, `${base}.sourcePolicyId`, route.sourcePolicyId, "Output route source policy", automationFieldLimits.policyId);
  addOutputIdIssue(issues, `${base}.outputId`, route.outputId);
  const validTargetShape = validateOutputRouteTarget(route.target, `${base}.target`, issues);

  const sourcePolicyId = stringValue(route.sourcePolicyId);
  const rawOutputId = normalizePolicyToken(stringValue(route.outputId));
  if (!sourcePolicyId || !rawOutputId || !validTargetShape) return;

  const sourcePolicy = context.normalizedPolicies.find((policy) => policy.id === sourcePolicyId);
  if (!sourcePolicy) {
    issues.push({ path: `${base}.sourcePolicyId`, message: `Output route references unknown policy: ${sourcePolicyId}.` });
    return;
  }

  const availableOutputIds = actionOutputIds(context.normalizedActions, sourcePolicy.action);
  const routeSlot = actionOutputSlotKind(rawOutputId);
  const outputId = routeSlot === "approval"
    ? availableOutputIds[0] ?? rawOutputId
    : routeSlot === "rework"
      ? availableOutputIds[1] ?? rawOutputId
      : rawOutputId;
  const routeKey = projectOutputRouteKey(sourcePolicyId, outputId);
  if (seenRouteKeys.has(routeKey)) {
    issues.push({ path: base, message: `Duplicate output route: ${routeKey}.` });
  }
  seenRouteKeys.add(routeKey);

  if (!availableOutputIds.includes(outputId)) {
    issues.push({ path: `${base}.outputId`, message: `Output route references unavailable output ${outputId} for policy ${sourcePolicyId}.` });
  }

  const outputIndex = availableOutputIds.indexOf(outputId);
  const sourceAction = context.normalizedActions.find((action) => action.id === sourcePolicy.action);
  if (sourceAction?.humanGate && outputIndex === 0) {
    issues.push({ path: base, message: "Human gate approval output routes are derived automatically." });
  }

  const normalizedRoute = context.normalizedOutputRoutes.find((candidate) =>
    projectOutputRouteKey(candidate.sourcePolicyId, candidate.outputId) === routeKey
  );
  const targetPolicy = normalizedRoute
    ? context.normalizedPolicies.find((policy) => policy.id === normalizedRoute.target.policyId)
    : undefined;
  if (!targetPolicy) {
    issues.push({ path: `${base}.target`, message: "Output route target must reference an event policy." });
  } else if (targetPolicy.source !== "event") {
    issues.push({ path: `${base}.target.policyId`, message: `Output route target policy must be an event policy: ${targetPolicy.id}.` });
  }
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
    rawTrigger: stringValue(policy.trigger) || (normalizedPolicy?.source === "trigger" ? normalizedPolicy.trigger ?? "" : ""),
    rawExplicitTrigger: stringValue(policy.trigger),
    rawSource: stringValue(policy.source),
    rawAction: stringValue(policy.action),
    legacyPolicy: policy.event === undefined && policy.agent === undefined && run !== undefined,
    normalizedPolicy,
    isTriggerPolicy: stringValue(policy.source) === "trigger" || typeof policy.trigger === "string" || normalizedPolicy?.source === "trigger"
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
  if (state.rawEvent && state.rawExplicitTrigger) {
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
    automationFieldLimits.eventType
  );
  if (!state.legacyPolicy) addRequiredStringIssue(issues, `${base}.action`, state.rawAction, "Policy action");
  if (!state.legacyPolicy) addStringIssue(issues, `${base}.action`, state.rawAction, "Policy action", automationFieldLimits.token, { token: true });
  if (policy.loopId !== undefined) addLoopIdIssue(issues, `${base}.loopId`, policy.loopId, "Policy loop");
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
  if (state.isTriggerPolicy) {
    const triggerId = state.normalizedPolicy?.source === "trigger"
      ? state.normalizedPolicy.trigger
      : normalizeTriggerToken(state.rawTrigger);
    if (triggerId && !context.triggerIdSet.has(triggerId)) {
      issues.push({ path: `${base}.trigger`, message: `Policy references unknown trigger: ${normalizeTriggerToken(state.rawTrigger)}.` });
    }
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

const validateSinglePolicyPerTrigger = (context: ValidationContext, issues: ProjectAutomationIssue[]) => {
  const firstPolicyIndexByTrigger = new Map<string, number>();

  context.normalizedPolicies.forEach((policy, index) => {
    if (policy.source !== "trigger" || !policy.trigger) return;
    const firstIndex = firstPolicyIndexByTrigger.get(policy.trigger);
    if (firstIndex === undefined) {
      firstPolicyIndexByTrigger.set(policy.trigger, index);
      return;
    }
    issues.push({
      path: `policies[${index}].trigger`,
      message: `Trigger ${policy.trigger} can start only one policy/action.`
    });
  });
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

const validateLoopStep = (
  step: unknown,
  stepPath: string,
  policyIdSet: Set<string>,
  issues: ProjectAutomationIssue[]
) => {
  if (typeof step !== "string") {
    issues.push({ path: stepPath, message: "Loop step must be a policy id string." });
    if (isRecord(step)) {
      for (const forbidden of ["on", "event", "agent", "runtime", "action"]) {
        if (forbidden in step) issues.push({ path: `${stepPath}.${forbidden}`, message: `Loop step must not contain ${forbidden}.` });
      }
    }
    return;
  }
  if (!step.trim()) {
    issues.push({ path: stepPath, message: "Loop step policy id is required." });
    return;
  }
  if (step.length > automationFieldLimits.policyId.max) {
    issues.push({ path: stepPath, message: `Loop step policy id must be ${automationFieldLimits.policyId.max} characters or fewer.` });
    return;
  }
  if (!policyIdSet.has(step)) issues.push({ path: stepPath, message: `Loop references unknown policy: ${step}.` });
};

const validateLoop = (loop: unknown, index: number, context: ValidationContext, issues: ProjectAutomationIssue[]) => {
  const base = `loops[${index}]`;
  if (!isRecord(loop)) {
    issues.push({ path: base, message: "Loop must be an object." });
    return;
  }
  addLoopIdIssue(issues, `${base}.id`, loop.id, "Loop id");
  if (!Array.isArray(loop.steps)) {
    issues.push({ path: `${base}.steps`, message: "Loop steps must be an array." });
    return;
  }
  loop.steps.forEach((step, stepIndex) =>
    validateLoopStep(step, `${base}.steps[${stepIndex}]`, context.policyIdSet, issues)
  );
  const rawPolicyById = new Map(context.rawPolicies.flatMap((policy) =>
    isRecord(policy) && stringValue(policy.id) ? [[stringValue(policy.id), policy] as const] : []
  ));
  const policyForStep = (step: string): Pick<ValidationContext["normalizedPolicies"][number], "source" | "trigger"> | undefined => {
    const normalizedPolicy = context.normalizedPolicies.find((candidate) => candidate.id === step);
    if (normalizedPolicy) return normalizedPolicy;
    const rawPolicy = rawPolicyById.get(step);
    if (!rawPolicy) return undefined;
    const trigger = normalizeTriggerToken(stringValue(rawPolicy.trigger));
    const source = stringValue(rawPolicy.source) === "trigger" || trigger ? "trigger" as const : "event" as const;
    return {
      source,
      trigger: trigger || undefined
    };
  };
  const firstNonTriggerIndex = loop.steps.findIndex((step) => {
    if (typeof step !== "string") return true;
    const policy = policyForStep(step);
    return policy?.source !== "trigger";
  });
  const triggerSteps = loop.steps.filter((step, stepIndex): step is string => {
    if (typeof step !== "string") return false;
    const policy = policyForStep(step);
    return policy?.source === "trigger" && (firstNonTriggerIndex === -1 || stepIndex < firstNonTriggerIndex);
  });
  if (triggerSteps.length > 1) {
    issues.push({ path: `${base}.steps`, message: "Loop can start from only one trigger policy." });
  }
  const normalizedLoop = context.normalizedLoops[index];
  if (!normalizedLoop || normalizedLoop.steps.length === 0) {
    issues.push({ path: `${base}.steps`, message: "Loop must start from a trigger policy." });
    return;
  }
  const firstPolicyId = normalizedLoop.steps[0] ?? "";
  const firstPolicy = context.normalizedPolicies.find((candidate) => candidate.id === firstPolicyId);
  if (!firstPolicy) {
    issues.push({ path: `${base}.steps[0]`, message: `Loop references unknown starting policy: ${firstPolicyId}.` });
    return;
  }
  if (firstPolicy.source !== "trigger" || !firstPolicy.trigger) {
    issues.push({ path: `${base}.steps[0]`, message: "Loop must start from a trigger policy." });
    return;
  }
  const expectedId = loopIdForPolicy(firstPolicy);
  const actualId = normalizeLoopId(stringValue(loop.id));
  if (expectedId && actualId !== expectedId) {
    issues.push({ path: `${base}.id`, message: `Loop id must be ${expectedId}.` });
  }
  loop.steps.forEach((step, stepIndex) => {
    if (typeof step !== "string") return;
    const rawPolicy = rawPolicyById.get(step);
    const rawLoopId = rawPolicy ? normalizeLoopId(stringValue(rawPolicy.loopId)) : "";
    if (rawLoopId && rawLoopId !== normalizedLoop.id) {
      issues.push({
        path: `${base}.steps[${stepIndex}]`,
        message: `Loop step policy loopId must be ${normalizedLoop.id}.`
      });
    }
  });
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
  context.rawActions.forEach((action, index) => validateAction(action, index, context, issues));
  context.rawOutputs.forEach((output, index) => validateOutput(output, index, issues));
  context.rawHumanGateResponses.forEach((response, index) => validateHumanGateResponse(response, index, context, issues));
  {
    const seenRouteKeys = new Set<string>();
    context.rawOutputRoutes.forEach((route, index) => validateOutputRoute(route, index, context, issues, seenRouteKeys));
  }
  context.rawPolicies.forEach((policy, index) => validatePolicy(policy, index, context, issues));
  validateSinglePolicyPerTrigger(context, issues);
  context.rawRuntimes.forEach((runtime, index) => validateRuntime(runtime, index, issues));
  context.rawLoops.forEach((loop, index) => validateLoop(loop, index, context, issues));
  return issues;
};
