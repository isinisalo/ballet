import type { Agent } from "../../shared/domain/agents.js";
import type { ProjectAction, ProjectAutomationIssue } from "../../shared/domain/automation.js";
import {
  automationFieldLimits,
  automationLoopIdValidationMessage,
  automationOutputIdValidationMessage,
  automationStringValidationMessage,
  type AutomationFieldLimit
} from "../../shared/api/automationValidation.js";
import {
  actionOutputIds,
  actionOutputRouteKey,
  defaultActionOutputIds,
  humanGateResponseId,
  normalizeLoopId,
  normalizeActionToken
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const stringValue = (value: unknown): string =>
  typeof value === "string" ? value : "";

const addStringIssue = (
  issues: ProjectAutomationIssue[],
  pathName: string,
  value: unknown,
  label: string,
  limit: AutomationFieldLimit,
  options?: { required?: boolean }
) => {
  if (typeof value !== "string") {
    if (options?.required !== false) issues.push({ path: pathName, message: `${label} is required.` });
    return;
  }
  const message = automationStringValidationMessage(label, value, limit, { required: options?.required });
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

const isCanonicalOutputId = (value: string): boolean =>
  defaultActionOutputIds.some((outputId) => outputId === value);

const addUniqueIssues = (issues: ProjectAutomationIssue[], ids: Array<{ id: string; path: string }>, label: string) => {
  const seen = new Map<string, string>();
  ids.forEach((item) => {
    if (!item.id) return;
    const previousPath = seen.get(item.id);
    if (previousPath) issues.push({ path: item.path, message: `Duplicate ${label} id: ${item.id}.` });
    else seen.set(item.id, item.path);
  });
};

const requireAutomationArrays = (input: Record<string, unknown>, issues: ProjectAutomationIssue[]) => {
  if (input.policies !== undefined) {
    issues.push({ path: "policies", message: "Automation policies are no longer supported. Use action event handlers." });
  }
  if (input.triggers !== undefined) {
    issues.push({ path: "triggers", message: "Automation triggers are no longer supported. Use action events." });
  }
  if (input.outputs !== undefined) {
    issues.push({ path: "outputs", message: "Automation outputs are fixed to approved/rejected and are no longer configurable." });
  }
  for (const key of ["actions", "outputs", "outputRoutes", "humanGateResponses", "loops", "runtimes"] as const) {
    if ((key === "actions" || key === "outputs" || key === "humanGateResponses") && input[key] === undefined) continue;
    if (!Array.isArray(input[key])) issues.push({ path: key, message: `${key} must be an array.` });
  }
};

const validateAction = (
  action: unknown,
  index: number,
  normalized: ReturnType<typeof normalizeProjectAutomationConfig>,
  agentIdSet: Set<string>,
  issues: ProjectAutomationIssue[]
) => {
  const base = `actions[${index}]`;
  if (!isRecord(action)) {
    issues.push({ path: base, message: "Action must be an object." });
    return;
  }
  addStringIssue(issues, `${base}.id`, action.id, "Action id", automationFieldLimits.policyId);
  addStringIssue(issues, `${base}.description`, action.description, "Action description", automationFieldLimits.description, { required: false });
  if (action.humanGate !== undefined && typeof action.humanGate !== "boolean") {
    issues.push({ path: `${base}.humanGate`, message: "Action humanGate must be boolean." });
  }

  const normalizedAction = normalized.actions[index];
  const normalizedAgentId = normalizedAction?.agentId;
  if (action.outputIds !== undefined) {
    issues.push({ path: `${base}.outputIds`, message: "Action outputIds is no longer supported. Outputs are fixed to approved/rejected." });
  }
  if (action.agentIds !== undefined) {
    issues.push({ path: `${base}.agentIds`, message: "Action agentIds is no longer supported. Use agentId." });
  }
  if (action.agentId !== undefined && typeof action.agentId !== "string") {
    issues.push({ path: `${base}.agentId`, message: "Action agentId must be a string." });
  }
  if (typeof action.agentId === "string" && !action.agentId.trim()) {
    issues.push({ path: `${base}.agentId`, message: "Action agentId cannot be empty." });
  }
  if (action.humanGate === true && (normalizedAgentId || typeof action.agentId === "string")) {
    issues.push({ path: `${base}.agentId`, message: "Human gate action cannot select an agent." });
  }
  if (normalizedAgentId && agentIdSet.size > 0 && !agentIdSet.has(normalizedAgentId)) {
    issues.push({ path: `${base}.agentId`, message: `Action references unknown agent: ${normalizedAgentId}.` });
  }
};

const validateOutputRoute = (
  route: unknown,
  index: number,
  actionsById: Map<string, ProjectAction>,
  loopIdSet: Set<string>,
  routeKeys: Set<string>,
  issues: ProjectAutomationIssue[]
) => {
  const base = `outputRoutes[${index}]`;
  if (!isRecord(route)) {
    issues.push({ path: base, message: "Output route must be an object." });
    return;
  }
  addLoopIdIssue(issues, `${base}.sourceLoopId`, route.sourceLoopId, "Output route source loop");
  addStringIssue(issues, `${base}.sourceActionId`, route.sourceActionId, "Output route source action", automationFieldLimits.policyId);
  addOutputIdIssue(issues, `${base}.outputId`, route.outputId);
  addLoopIdIssue(issues, `${base}.targetLoopId`, route.targetLoopId, "Output route target loop");
  addStringIssue(issues, `${base}.targetActionId`, route.targetActionId, "Output route target action", automationFieldLimits.policyId);
  const sourceLoopId = normalizeLoopId(stringValue(route.sourceLoopId));
  const targetLoopId = normalizeLoopId(stringValue(route.targetLoopId));
  const sourceAction = actionsById.get(stringValue(route.sourceActionId));
  const targetAction = actionsById.get(stringValue(route.targetActionId));
  if (sourceLoopId && !loopIdSet.has(sourceLoopId)) issues.push({ path: `${base}.sourceLoopId`, message: `Output route references unknown source loop: ${sourceLoopId}.` });
  if (targetLoopId && !loopIdSet.has(targetLoopId)) issues.push({ path: `${base}.targetLoopId`, message: `Output route references unknown target loop: ${targetLoopId}.` });
  if (!sourceAction) issues.push({ path: `${base}.sourceActionId`, message: `Output route references unknown source action: ${stringValue(route.sourceActionId)}.` });
  if (!targetAction) issues.push({ path: `${base}.targetActionId`, message: `Output route references unknown target action: ${stringValue(route.targetActionId)}.` });
  if (!sourceAction) return;
  const outputId = normalizeActionToken(stringValue(route.outputId));
  const routeKey = actionOutputRouteKey(sourceLoopId, sourceAction.id, outputId);
  if (routeKeys.has(routeKey)) issues.push({ path: base, message: `Duplicate output route: ${routeKey}.` });
  routeKeys.add(routeKey);
  if (!isCanonicalOutputId(outputId)) {
    issues.push({ path: `${base}.outputId`, message: "Output route outputId must be approved or rejected." });
    return;
  }
  if (!actionOutputIds([...actionsById.values()], sourceAction.id).includes(outputId)) {
    issues.push({ path: `${base}.outputId`, message: `Output route references unavailable output ${outputId} for action ${sourceAction.id}.` });
  }
};

const validateHumanGateResponse = (
  response: unknown,
  index: number,
  actionsById: Map<string, ProjectAction>,
  loopIdSet: Set<string>,
  issues: ProjectAutomationIssue[]
) => {
  const base = `humanGateResponses[${index}]`;
  if (!isRecord(response)) {
    issues.push({ path: base, message: "Human gate response must be an object." });
    return;
  }
  addStringIssue(issues, `${base}.id`, response.id, "Human gate response id", { min: 1, max: 260 });
  addStringIssue(issues, `${base}.actionId`, response.actionId, "Human gate response action", automationFieldLimits.policyId);
  addOutputIdIssue(issues, `${base}.outputId`, response.outputId);
  addStringIssue(issues, `${base}.prompt`, response.prompt, "Human gate response prompt", { min: 1, max: 2000 });
  addStringIssue(issues, `${base}.submittedAt`, response.submittedAt, "Human gate response submittedAt", { min: 1, max: 80 });
  const loopId = normalizeLoopId(stringValue(response.loopId));
  if (response.loopId !== undefined) {
    addLoopIdIssue(issues, `${base}.loopId`, response.loopId, "Human gate response loop");
    if (loopId && !loopIdSet.has(loopId)) issues.push({ path: `${base}.loopId`, message: `Human gate response references unknown loop: ${loopId}.` });
  }
  const action = actionsById.get(stringValue(response.actionId));
  if (!action) {
    issues.push({ path: `${base}.actionId`, message: `Human gate response references unknown action: ${stringValue(response.actionId)}.` });
    return;
  }
  if (!action.humanGate) issues.push({ path: `${base}.actionId`, message: `Human gate response action is not a human gate: ${action.id}.` });
  const outputId = normalizeActionToken(stringValue(response.outputId));
  if (!isCanonicalOutputId(outputId)) {
    issues.push({ path: `${base}.outputId`, message: "Human gate response outputId must be approved or rejected." });
    return;
  }
  if (!actionOutputIds([...actionsById.values()], action.id).includes(outputId)) {
    issues.push({ path: `${base}.outputId`, message: `Human gate response references unavailable output ${outputId} for action ${action.id}.` });
  }
  const expectedId = humanGateResponseId({ loopId, actionId: action.id });
  if (expectedId && stringValue(response.id) !== expectedId) {
    issues.push({ path: `${base}.id`, message: `Human gate response id must be ${expectedId}.` });
  }
};

export const validateProjectAutomationConfig = (input: unknown, agents: Agent[] = []): ProjectAutomationIssue[] => {
  const issues: ProjectAutomationIssue[] = [];
  if (!isRecord(input)) return [{ path: "automation", message: "Automation config must be an object." }];
  requireAutomationArrays(input, issues);
  const normalized = normalizeProjectAutomationConfig(input, agents);
  const actionsById = new Map(normalized.actions.map((action) => [action.id, action]));
  const loopIdSet = new Set(normalized.loops.map((loop) => loop.id));
  const agentIdSet = new Set(agents.map((agent) => agent.id));
  addUniqueIssues(issues, normalized.actions.map((action, index) => ({ id: action.id, path: `actions[${index}].id` })), "action");
  addUniqueIssues(issues, normalized.loops.map((loop, index) => ({ id: loop.id, path: `loops[${index}].id` })), "loop");
  addUniqueIssues(issues, normalized.humanGateResponses.map((response, index) => ({ id: response.id, path: `humanGateResponses[${index}].id` })), "human gate response");

  const rawActions = Array.isArray(input.actions) ? input.actions : [];
  rawActions.forEach((action, index) => validateAction(action, index, normalized, agentIdSet, issues));
  const routeKeys = new Set<string>();
  (Array.isArray(input.outputRoutes) ? input.outputRoutes : []).forEach((route, index) =>
    validateOutputRoute(route, index, actionsById, loopIdSet, routeKeys, issues)
  );
  (Array.isArray(input.humanGateResponses) ? input.humanGateResponses : []).forEach((response, index) =>
    validateHumanGateResponse(response, index, actionsById, loopIdSet, issues)
  );
  (Array.isArray(input.loops) ? input.loops : []).forEach((loop, loopIndex) => {
    if (!isRecord(loop)) {
      issues.push({ path: `loops[${loopIndex}]`, message: "Loop must be an object." });
      return;
    }
    addLoopIdIssue(issues, `loops[${loopIndex}].id`, loop.id, "Loop");
    stringArray(loop.steps).forEach((step, stepIndex) => {
      if (!actionsById.has(step)) issues.push({ path: `loops[${loopIndex}].steps[${stepIndex}]`, message: `Loop references unknown action: ${step}.` });
    });
  });
  return issues;
};

const stringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
