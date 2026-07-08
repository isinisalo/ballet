import type { Agent } from "./domain/agents.js";
import type { ProjectAction, ProjectHumanGateResponse, ProjectOutput, ProjectOutputRoute, ProjectOutputTarget, ProjectPolicy } from "./domain/automation.js";

export const actionOutputSlotCount = 2;
export const actionOutputSlotMinCount = 1;
export const defaultPolicyOutputIds = ["ok", "rework"] as const;
export type PolicyOutputId = string;
export const policyOutputStatuses = defaultPolicyOutputIds;
export type PolicyOutputStatus = typeof defaultPolicyOutputIds[number];

export const defaultProjectOutputs = (): ProjectOutput[] => [
  { id: "ok" },
  { id: "rework" }
];

export const normalizePolicyToken = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const normalizeTriggerToken = (value: string): string =>
  value
    .split(".")
    .map(normalizePolicyToken)
    .filter(Boolean)
    .join(".");

export const loopSuffix = ".loop";

export const normalizeLoopId = (value: string): string =>
  normalizeTriggerToken(value);

export const loopIdFromTrigger = (triggerId: string): string => {
  const trigger = normalizeTriggerToken(triggerId);
  return trigger ? `${trigger}${loopSuffix}` : "";
};

export const loopIdForPolicy = (policy: Pick<ProjectPolicy, "source" | "trigger"> | undefined): string =>
  policy?.source === "trigger" && policy.trigger ? loopIdFromTrigger(policy.trigger) : "";

export const triggerEventType = (triggerId: string): string => `trigger.${normalizeTriggerToken(triggerId)}`;

export const policySourceKey = (input: Pick<ProjectPolicy, "source" | "event" | "trigger">): string =>
  input.source === "trigger" ? triggerEventType(input.trigger ?? "") : (input.event ?? "");

export const generatedPolicyId = (input: Pick<ProjectPolicy, "source" | "event" | "trigger" | "action">): string =>
  `on.${input.source === "trigger" ? `trigger.${input.trigger ?? ""}` : input.event ?? ""}.start.${input.action}`;

export const policyOutputEventType = (
  input: Pick<ProjectPolicy, "action">,
  outputId: PolicyOutputId
): string => `${input.action}.${normalizePolicyToken(outputId)}`;

export const projectOutputRouteKey = (sourcePolicyId: string, outputId: string): string =>
  `${sourcePolicyId}:${normalizePolicyToken(outputId)}`;

export const findProjectOutputRoute = (
  outputRoutes: readonly ProjectOutputRoute[],
  sourcePolicyId: string,
  outputId: string
): ProjectOutputRoute | undefined => {
  const key = projectOutputRouteKey(sourcePolicyId, outputId);
  return outputRoutes.find((route) => projectOutputRouteKey(route.sourcePolicyId, route.outputId) === key);
};

export type ActionOutputSlotKind = "approval" | "rework";

export const approvalOutputCandidates = [
  "ok",
  "done",
  "accepted",
  "approved",
  "ready",
  "complete",
  "completed",
  "deployed"
] as const;

export const reworkOutputCandidates = [
  "rework",
  "reject",
  "rejected",
  "failed",
  "blocked",
  "needs_input",
  "needs-input",
  "needs-clarification",
  "changes-requested",
  "changes-requested",
  "cancelled",
  "warn"
] as const;

const approvalOutputCandidateSet = new Set<string>(approvalOutputCandidates);
const reworkOutputCandidateSet = new Set<string>(reworkOutputCandidates);

export const actionOutputSlotKind = (outputId: string): ActionOutputSlotKind | undefined => {
  const normalized = normalizePolicyToken(outputId);
  if (approvalOutputCandidateSet.has(normalized)) return "approval";
  if (reworkOutputCandidateSet.has(normalized)) return "rework";
  return undefined;
};

export const uniquePolicyOutputIds = (outputIds: readonly string[], max = Number.POSITIVE_INFINITY): string[] =>
  [...new Set(outputIds.map(normalizePolicyToken).filter(Boolean))].slice(0, max);

export const normalizeActionOutputSlots = (outputIds: readonly string[] = defaultPolicyOutputIds): string[] => {
  const normalized = uniquePolicyOutputIds(outputIds);
  if (normalized.length > 0 && normalized.length <= actionOutputSlotCount) {
    return normalized;
  }

  const approvalOutputId = normalized.find((outputId) => actionOutputSlotKind(outputId) === "approval") ?? defaultPolicyOutputIds[0];
  const reworkOutputId = normalized.find((outputId) =>
    outputId !== approvalOutputId && actionOutputSlotKind(outputId) === "rework"
  ) ?? defaultPolicyOutputIds[1];

  if (approvalOutputId === reworkOutputId) {
    return [approvalOutputId, defaultPolicyOutputIds.find((outputId) => outputId !== approvalOutputId) ?? "rework"];
  }
  return [approvalOutputId, reworkOutputId];
};

const outputIdSet = (outputs: Array<Pick<ProjectOutput, "id">>): Set<string> =>
  new Set(outputs
    .map((output) => normalizePolicyToken(output.id))
    .filter(Boolean));

export const actionOutputIds = (
  actions: Array<Pick<ProjectAction, "id" | "outputIds" | "humanGate"> & { agentIds?: string[] }>,
  actionId: string
): string[] => {
  const normalizedActionId = normalizePolicyToken(actionId);
  const action = actions.find((candidate) => normalizePolicyToken(candidate.id) === normalizedActionId);
  if (action && Array.isArray(action.agentIds) && action.agentIds.length === 0 && !action.humanGate) return [];
  const outputIds = action?.outputIds ?? defaultPolicyOutputIds;
  return normalizeActionOutputSlots(outputIds);
};

export const projectOutputRouteSlotKind = (
  policy: Pick<ProjectPolicy, "action">,
  outputId: PolicyOutputId,
  actions: Array<Pick<ProjectAction, "id" | "outputIds" | "humanGate"> & { agentIds?: string[] }>
): ActionOutputSlotKind | undefined => {
  const normalizedOutputId = normalizePolicyToken(outputId);
  const outputIndex = actionOutputIds(actions, policy.action).indexOf(normalizedOutputId);
  if (outputIndex === 0) return "approval";
  if (outputIndex === 1) return "rework";
  return undefined;
};

export const projectOutputRouteCanTargetTrigger = (
  policy: Pick<ProjectPolicy, "action">,
  outputId: PolicyOutputId,
  actions: Array<Pick<ProjectAction, "id" | "outputIds" | "humanGate"> & { agentIds?: string[] }>
): boolean => {
  const normalizedActionId = normalizePolicyToken(policy.action);
  const action = actions.find((candidate) => normalizePolicyToken(candidate.id) === normalizedActionId);
  return Boolean(action?.humanGate && projectOutputRouteSlotKind(policy, outputId, actions) === "approval");
};

export const humanGateApprovalTriggerId = (actionId: string, approvalOutputId: string): string =>
  normalizeTriggerToken(`${normalizePolicyToken(actionId)}.${normalizePolicyToken(approvalOutputId)}`);

export const humanGateApprovalTriggerIdForPolicy = (
  policy: Pick<ProjectPolicy, "action">,
  outputId: PolicyOutputId,
  actions: Array<Pick<ProjectAction, "id" | "outputIds" | "humanGate"> & { agentIds?: string[] }>
): string | undefined => {
  if (!projectOutputRouteCanTargetTrigger(policy, outputId, actions)) return undefined;
  return humanGateApprovalTriggerId(policy.action, outputId);
};

export const projectOutputTargetEventType = (
  policy: Pick<ProjectPolicy, "action">,
  outputId: PolicyOutputId,
  target?: ProjectOutputTarget,
  actions: Array<Pick<ProjectAction, "id" | "outputIds" | "humanGate"> & { agentIds?: string[] }> = []
): string => {
  const derivedTriggerId = humanGateApprovalTriggerIdForPolicy(policy, outputId, actions);
  if (derivedTriggerId) return triggerEventType(derivedTriggerId);
  if (target?.type === "event" && target.eventType) return normalizePolicyOutputEventType(target.eventType);
  return policyOutputEventType(policy, outputId);
};

export const projectOutputRouteEventType = (
  policy: Pick<ProjectPolicy, "id" | "action">,
  outputId: PolicyOutputId,
  outputRoutes: readonly ProjectOutputRoute[],
  actions: Array<Pick<ProjectAction, "id" | "outputIds" | "humanGate"> & { agentIds?: string[] }> = []
): string => projectOutputTargetEventType(
  policy,
  outputId,
  findProjectOutputRoute(outputRoutes, policy.id, outputId)?.target,
  actions
);

export const policyOutputEventTypes = (
  input: Pick<ProjectPolicy, "action">,
  actions: Array<Pick<ProjectAction, "id" | "outputIds" | "humanGate"> & { agentIds?: string[] }> = [],
  outputs: Array<Pick<ProjectOutput, "id">> = []
): string[] => {
  const outputIds = actions.length > 0 ? actionOutputIds(actions, input.action) : [...defaultPolicyOutputIds];
  const availableOutputIds = outputs.length > 0 ? outputIdSet(outputs) : undefined;
  return outputIds
    .filter((outputId) => !availableOutputIds || availableOutputIds.has(outputId))
    .map((outputId) => projectOutputTargetEventType(input, outputId, undefined, actions));
};

export const normalizePolicyOutputEventType = (value: string): string => {
  return value.replace(/^([a-z0-9_-]+)\.([a-z0-9_-]+)\.([a-z0-9_-]+)\.v1$/, "$1.$2.$3");
};

export const humanGateResponseId = (
  input: Pick<ProjectHumanGateResponse, "policyId" | "actionId"> & { loopId?: string }
): string => [
  input.loopId ? normalizeLoopId(input.loopId) : "loop",
  normalizePolicyToken(input.policyId),
  normalizePolicyToken(input.actionId)
].filter(Boolean).join(":");

export const policyActionTokens = (policies: Array<Pick<ProjectPolicy, "action">>): string[] =>
  [...new Set(policies.map((policy) => normalizePolicyToken(policy.action)).filter(Boolean))];

const firstToken = (value: string): string => normalizePolicyToken(value.split(/[\s/]+/)[0] ?? "");

export const agentTokenCandidates = (agent: Agent): string[] => {
  const candidates = [
    ...(agent.nicknameCandidates ?? []).map(normalizePolicyToken),
    firstToken(agent.name),
    normalizePolicyToken(agent.name),
    normalizePolicyToken(agent.id).replace(/-agent$/, ""),
    normalizePolicyToken(agent.id)
  ].filter(Boolean);
  return [...new Set(candidates)];
};

export const preferredAgentToken = (agent: Agent): string =>
  agentTokenCandidates(agent)[0] ?? normalizePolicyToken(agent.id);

export const uniqueAgentPolicyTokens = (agents: Agent[]): string[] => {
  const used = new Set<string>();
  return agents.map((agent) => {
    const token = agentTokenCandidates(agent).find((candidate) => !used.has(candidate)) ?? preferredAgentToken(agent);
    used.add(token);
    return token;
  });
};

export const policyEventTypesForActions = (
  actions: Array<Pick<ProjectAction, "id" | "outputIds" | "humanGate"> & { agentIds?: string[] }>,
  outputs: Array<Pick<ProjectOutput, "id">> = []
): string[] => {
  const normalizedActions = [...new Map(actions
    .map((action) => ({ ...action, id: normalizePolicyToken(action.id) }))
    .filter((action) => action.id)
    .map((action) => [action.id, action])).values()];
  return normalizedActions.flatMap((action) => policyOutputEventTypes({ action: action.id }, normalizedActions, outputs));
};

export const policyEventTypesForAgentsAndActions = (
  _agents: Agent[],
  actions: Array<Pick<ProjectAction, "id" | "outputIds" | "humanGate"> & { agentIds?: string[] }>,
  outputs: Array<Pick<ProjectOutput, "id">> = []
): string[] => policyEventTypesForActions(actions, outputs);

export const resolvePolicyAgent = (agents: Agent[], token: string): Agent | undefined => {
  const normalized = normalizePolicyToken(token);
  return agents.find((agent) => agentTokenCandidates(agent).includes(normalized));
};
