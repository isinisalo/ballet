import type { Agent } from "./domain/agents.js";
import type { ProjectAction, ProjectHumanGateResponse, ProjectOutput, ProjectOutputRoute, ProjectOutputTarget, ProjectPolicy } from "./domain/automation.js";

export const actionOutputSlotCount = 2;
export const actionOutputSlotMinCount = 1;
export const defaultPolicyOutputIds = ["approved", "rejected"] as const;
export type PolicyOutputId = string;
export const policyOutputStatuses = defaultPolicyOutputIds;
export type PolicyOutputStatus = typeof defaultPolicyOutputIds[number];

export const defaultProjectOutputs = (): ProjectOutput[] => [
  { id: defaultPolicyOutputIds[0] },
  { id: defaultPolicyOutputIds[1] }
];

export type ActionOutputConfig = Pick<ProjectAction, "humanGate"> & {
  agentIds?: readonly string[];
  outputIds?: readonly string[];
};

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

const policyLoopId = (input: { loopId?: string }): string =>
  input.loopId ? normalizeLoopId(input.loopId) : "";

const loopQualifiedActionToken = (input: Pick<ProjectPolicy, "action"> & { loopId?: string }): string => {
  const action = normalizePolicyToken(input.action);
  const loopId = policyLoopId(input);
  return loopId && action ? `${loopId}.${action}` : action;
};

const loopQualifiedEventType = (input: Pick<ProjectPolicy, "event"> & { loopId?: string }): string => {
  const event = normalizeTriggerToken(input.event ?? "");
  const loopId = policyLoopId(input);
  if (!loopId || !event || event.startsWith(`${loopId}.`)) return event;
  return `${loopId}.${event}`;
};

export const policySourceKey = (input: Pick<ProjectPolicy, "source" | "event" | "trigger"> & { loopId?: string }): string =>
  input.source === "trigger" ? triggerEventType(input.trigger ?? "") : loopQualifiedEventType(input);

export const generatedPolicyId = (input: Pick<ProjectPolicy, "source" | "event" | "trigger" | "action"> & { loopId?: string }): string =>
  `on.${input.source === "trigger" ? `trigger.${input.trigger ?? ""}` : loopQualifiedEventType(input)}.start.${loopQualifiedActionToken(input)}`;

export const policyOutputEventType = (
  input: Pick<ProjectPolicy, "action"> & { loopId?: string },
  outputId: PolicyOutputId
): string => `${loopQualifiedActionToken(input)}.${normalizePolicyToken(outputId)}`;

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

const canonicalOutputIdForSlot = (slot: ActionOutputSlotKind): PolicyOutputStatus =>
  slot === "approval" ? defaultPolicyOutputIds[0] : defaultPolicyOutputIds[1];

export const normalizeActionOutputSlots = (outputIds: readonly string[] = defaultPolicyOutputIds): string[] => {
  const normalized = uniquePolicyOutputIds(outputIds);
  if (normalized.length === 0) return [...defaultPolicyOutputIds];

  const slots = new Set<ActionOutputSlotKind>();
  normalized.forEach((outputId, index) => {
    const semanticSlot = actionOutputSlotKind(outputId);
    const positionalSlot = index === 0 ? "approval" : index === 1 ? "rework" : undefined;
    const slot = semanticSlot ?? positionalSlot;
    if (slot) slots.add(slot);
  });

  if (!slots.has("approval")) slots.add("approval");
  return slots.has("rework")
    ? [canonicalOutputIdForSlot("approval"), canonicalOutputIdForSlot("rework")]
    : [canonicalOutputIdForSlot("approval")];
};

export const actionHasExecutableTarget = (action: ActionOutputConfig | undefined): boolean =>
  Boolean(action && (action.humanGate || action.agentIds === undefined || action.agentIds.length > 0));

export const defaultActionOutputIds = (action: ActionOutputConfig | undefined): string[] =>
  actionHasExecutableTarget(action) ? [...defaultPolicyOutputIds] : [];

export const isDefaultActionOutputIds = (
  outputIds: readonly string[] | undefined,
  action?: ActionOutputConfig
): boolean => {
  if (outputIds === undefined) return true;
  const expected = defaultActionOutputIds(action);
  const normalized = outputIds.length > 0 ? normalizeActionOutputSlots(outputIds) : [];
  return normalized.length === expected.length && normalized.every((outputId, index) => outputId === expected[index]);
};

const outputIdSet = (outputs: Array<Pick<ProjectOutput, "id">>): Set<string> =>
  new Set(outputs
    .map((output) => normalizePolicyToken(output.id))
    .filter(Boolean));

export const actionOutputIds = (
  actions: Array<Pick<ProjectAction, "id" | "humanGate"> & { agentIds?: string[]; outputIds?: readonly string[] }>,
  actionId: string
): string[] => {
  const normalizedActionId = normalizePolicyToken(actionId);
  const action = actions.find((candidate) => normalizePolicyToken(candidate.id) === normalizedActionId);
  if (!action) return [...defaultPolicyOutputIds];
  if (!actionHasExecutableTarget(action)) return [];
  return action.outputIds === undefined ? defaultActionOutputIds(action) : normalizeActionOutputSlots(action.outputIds);
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

export const projectOutputHandlerPolicy = (
  policy: Pick<ProjectPolicy, "action"> & { loopId?: string },
  outputId: PolicyOutputId,
  policies: Array<Pick<ProjectPolicy, "id" | "source" | "event" | "trigger" | "action"> & { loopId?: string }>
): (Pick<ProjectPolicy, "id" | "source" | "event" | "trigger" | "action"> & { loopId?: string }) | undefined => {
  const eventType = policyOutputEventType(policy, outputId);
  return policies.find((candidate) =>
    candidate.source === "event" &&
    policySourceKey(candidate) === eventType
  );
};

export const projectOutputTargetPolicy = (
  target: ProjectOutputTarget | undefined,
  policies: Array<Pick<ProjectPolicy, "id" | "source" | "event" | "trigger" | "action"> & { loopId?: string }>
): (Pick<ProjectPolicy, "id" | "source" | "event" | "trigger" | "action"> & { loopId?: string }) | undefined => {
  if (!target) return undefined;
  return policies.find((policy) => policy.id === target.policyId && policy.source === "event");
};

export const projectOutputRouteTargetPolicy = (
  policy: Pick<ProjectPolicy, "id" | "action"> & { loopId?: string },
  outputId: PolicyOutputId,
  outputRoutes: readonly ProjectOutputRoute[],
  actions: Array<Pick<ProjectAction, "id" | "outputIds" | "humanGate"> & { agentIds?: string[] }> = [],
  policies: Array<Pick<ProjectPolicy, "id" | "source" | "event" | "trigger" | "action"> & { loopId?: string }> = []
): (Pick<ProjectPolicy, "id" | "source" | "event" | "trigger" | "action"> & { loopId?: string }) | undefined => {
  const derivedTriggerId = humanGateApprovalTriggerIdForPolicy(policy, outputId, actions);
  if (derivedTriggerId) return undefined;
  const route = findProjectOutputRoute(outputRoutes, policy.id, outputId);
  return route
    ? projectOutputTargetPolicy(route.target, policies)
    : projectOutputHandlerPolicy(policy, outputId, policies);
};

export const projectOutputTargetEventType = (
  policy: Pick<ProjectPolicy, "action"> & { loopId?: string },
  outputId: PolicyOutputId,
  target?: ProjectOutputTarget,
  actions: Array<Pick<ProjectAction, "id" | "outputIds" | "humanGate"> & { agentIds?: string[] }> = [],
  policies: Array<Pick<ProjectPolicy, "id" | "source" | "event" | "trigger" | "action"> & { loopId?: string }> = []
): string => {
  const derivedTriggerId = humanGateApprovalTriggerIdForPolicy(policy, outputId, actions);
  if (derivedTriggerId) return triggerEventType(derivedTriggerId);
  const targetPolicy = target
    ? projectOutputTargetPolicy(target, policies)
    : projectOutputHandlerPolicy(policy, outputId, policies);
  if (targetPolicy) return policySourceKey(targetPolicy);
  return policyOutputEventType(policy, outputId);
};

export const projectOutputRouteEventType = (
  policy: Pick<ProjectPolicy, "id" | "action"> & { loopId?: string },
  outputId: PolicyOutputId,
  outputRoutes: readonly ProjectOutputRoute[],
  actions: Array<Pick<ProjectAction, "id" | "outputIds" | "humanGate"> & { agentIds?: string[] }> = [],
  policies: Array<Pick<ProjectPolicy, "id" | "source" | "event" | "trigger" | "action"> & { loopId?: string }> = []
): string => projectOutputTargetEventType(
  policy,
  outputId,
  findProjectOutputRoute(outputRoutes, policy.id, outputId)?.target,
  actions,
  policies
);

export const policyOutputEventTypes = (
  input: Pick<ProjectPolicy, "action"> & { loopId?: string },
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
