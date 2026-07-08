import type { Agent } from "./domain/agents.js";
import type { ProjectAction, ProjectHumanGateResponse, ProjectLoop, ProjectOutput, ProjectOutputRoute } from "./domain/automation.js";

export const actionOutputSlotCount = 2;
export const actionOutputSlotMinCount = 1;
export const defaultActionOutputIds = ["approved", "rejected"] as const;
export type ActionOutputId = string;
export const actionOutputStatuses = defaultActionOutputIds;
export type ActionOutputStatus = typeof defaultActionOutputIds[number];

export const defaultProjectOutputs = (): ProjectOutput[] => [
  { id: defaultActionOutputIds[0] },
  { id: defaultActionOutputIds[1] }
];

export type ActionOutputConfig = Pick<ProjectAction, "humanGate"> & {
  agentIds?: readonly string[];
  outputIds?: readonly string[];
};

type LegacyActionTokenInput = {
  id?: string;
  key?: string;
  action?: string;
  actionId?: string;
  loopId?: string;
  event?: string;
};

export const normalizeActionToken = (value: string): string =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const normalizePolicyToken = normalizeActionToken;

export const normalizeEventTypeToken = (value: string): string =>
  String(value ?? "")
    .split(".")
    .map(normalizeActionToken)
    .filter(Boolean)
    .join(".");

export const loopSuffix = ".loop";

export const normalizeLoopId = (value: string): string =>
  normalizeEventTypeToken(value);

export const loopIdFromEvent = (eventType: string): string => {
  const event = normalizeEventTypeToken(eventType);
  return event ? `${event}${loopSuffix}` : "";
};

export const eventTypeFromLoopId = (loopId: string): string => {
  const normalized = normalizeLoopId(loopId);
  return normalized.endsWith(loopSuffix) ? normalized.slice(0, -loopSuffix.length) : normalized;
};

export const loopIdForAction = (action: { event?: string } | undefined): string =>
  action?.event ? loopIdFromEvent(action.event) : "";

export const loopIdForPolicy = loopIdForAction;

const legacyLoopId = (input: { loopId?: string }): string =>
  input.loopId ? normalizeLoopId(input.loopId) : "";

const legacyActionToken = (input: LegacyActionTokenInput): string =>
  normalizeActionToken(input.actionId ?? input.key ?? input.action ?? input.id ?? "");

const legacyLoopQualifiedActionToken = (input: LegacyActionTokenInput): string => {
  const key = legacyActionToken(input);
  const loopId = legacyLoopId(input);
  return loopId && key ? `${loopId}.${key}` : key;
};

export const loopQualifiedEventType = (input: { event?: string; loopId?: string }): string => {
  const event = normalizeEventTypeToken(input.event ?? "");
  const loopId = legacyLoopId(input);
  if (!loopId || !event || event.startsWith(`${loopId}.`)) return event;
  return `${loopId}.${event}`;
};

export const actionSourceKey = (input: { event?: string; loopId?: string }): string =>
  normalizeEventTypeToken(input.event ?? eventTypeFromLoopId(input.loopId ?? ""));

export const policySourceKey = actionSourceKey;

export const generatedActionId = (input: LegacyActionTokenInput): string =>
  `on.${actionSourceKey(input)}.start.${legacyLoopQualifiedActionToken(input)}`;

export const generatedPolicyId = generatedActionId;

export const actionRouteId = (loopId: string, actionId: string): string =>
  [normalizeLoopId(loopId), normalizeActionToken(actionId)].filter(Boolean).join(":");

export const parseActionRouteId = (routeId: string): { loopId: string; actionId: string } => {
  const [loopId = "", ...actionParts] = String(routeId ?? "").split(":");
  const actionId = actionParts.join(":");
  return {
    loopId: normalizeLoopId(loopId),
    actionId: normalizeActionToken(actionId)
  };
};

export const actionOutputEventType = (
  input: LegacyActionTokenInput,
  outputId: ActionOutputId
): string => {
  const loopId = legacyLoopId(input);
  const actionId = legacyActionToken(input);
  const output = normalizeActionToken(outputId);
  return [loopId, actionId, output].filter(Boolean).join(".");
};

export const policyOutputEventType = actionOutputEventType;

export function actionOutputRouteKey(sourceLoopId: string, sourceActionId: string, outputId: string): string;
export function actionOutputRouteKey(sourceActionId: string, outputId: string): string;
export function actionOutputRouteKey(first: string, second: string, third?: string): string {
  const sourceLoopId = third === undefined ? "" : normalizeLoopId(first);
  const sourceActionId = third === undefined ? first : second;
  const outputId = third === undefined ? second : third;
  return [sourceLoopId, normalizeActionToken(sourceActionId), normalizeActionToken(outputId)].join(":");
}

export const projectOutputRouteKey = actionOutputRouteKey;

export function findActionOutputRoute(
  outputRoutes: readonly ProjectOutputRoute[],
  sourceLoopId: string,
  sourceActionId: string,
  outputId: string
): ProjectOutputRoute | undefined;
export function findActionOutputRoute(
  outputRoutes: readonly ProjectOutputRoute[],
  sourceActionId: string,
  outputId: string
): ProjectOutputRoute | undefined;
export function findActionOutputRoute(
  outputRoutes: readonly ProjectOutputRoute[],
  first: string,
  second: string,
  third?: string
): ProjectOutputRoute | undefined {
  const sourceLoopId = third === undefined ? "" : normalizeLoopId(first);
  const sourceActionId = third === undefined ? first : second;
  const outputId = third === undefined ? second : third;
  const key = actionOutputRouteKey(sourceLoopId, sourceActionId, outputId);
  return outputRoutes.find((route) => {
    const legacyRoute = route as ProjectOutputRoute & { sourcePolicyId?: string };
    const routeSourceLoopId = normalizeLoopId(route.sourceLoopId ?? "");
    const routeSourceActionId = legacyRoute.sourceActionId ?? legacyRoute.sourcePolicyId ?? "";
    return actionOutputRouteKey(routeSourceLoopId, routeSourceActionId, route.outputId) === key ||
      (!sourceLoopId && actionOutputRouteKey(routeSourceActionId, route.outputId) === actionOutputRouteKey(sourceActionId, outputId));
  });
}

export const findProjectOutputRoute = findActionOutputRoute;

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
  "cancelled",
  "warn"
] as const;

const approvalOutputCandidateSet = new Set<string>(approvalOutputCandidates);
const reworkOutputCandidateSet = new Set<string>(reworkOutputCandidates);

export const actionOutputSlotKind = (outputId: string): ActionOutputSlotKind | undefined => {
  const normalized = normalizeActionToken(outputId);
  if (approvalOutputCandidateSet.has(normalized)) return "approval";
  if (reworkOutputCandidateSet.has(normalized)) return "rework";
  return undefined;
};

export const uniqueActionOutputIds = (outputIds: readonly string[], max = Number.POSITIVE_INFINITY): string[] =>
  [...new Set(outputIds.map(normalizeActionToken).filter(Boolean))].slice(0, max);

const canonicalOutputIdForSlot = (slot: ActionOutputSlotKind): ActionOutputStatus =>
  slot === "approval" ? defaultActionOutputIds[0] : defaultActionOutputIds[1];

export const normalizeActionOutputSlots = (outputIds: readonly string[] = defaultActionOutputIds): string[] => {
  const normalized = uniqueActionOutputIds(outputIds);
  if (normalized.length === 0) return [...defaultActionOutputIds];

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

export const defaultOutputIdsForAction = (action: ActionOutputConfig | undefined): string[] =>
  actionHasExecutableTarget(action) ? [...defaultActionOutputIds] : [];

export const isDefaultActionOutputIds = (
  outputIds: readonly string[] | undefined,
  action?: ActionOutputConfig
): boolean => {
  if (outputIds === undefined) return true;
  const expected = defaultOutputIdsForAction(action);
  const normalized = outputIds.length > 0 ? normalizeActionOutputSlots(outputIds) : [];
  return normalized.length === expected.length && normalized.every((outputId, index) => outputId === expected[index]);
};

const outputIdSet = (outputs: Array<Pick<ProjectOutput, "id">>): Set<string> =>
  new Set(outputs
    .map((output) => normalizeActionToken(output.id))
    .filter(Boolean));

export const actionOutputIds = (
  actions: Array<Pick<ProjectAction, "id" | "humanGate"> & { agentIds?: string[]; outputIds?: readonly string[] }>,
  actionId: string
): string[] => {
  const normalizedActionId = normalizeActionToken(actionId);
  const action = actions.find((candidate) => normalizeActionToken(candidate.id) === normalizedActionId);
  if (!action) return [...defaultActionOutputIds];
  if (!actionHasExecutableTarget(action)) return [];
  return action.outputIds === undefined ? defaultOutputIdsForAction(action) : normalizeActionOutputSlots(action.outputIds);
};

export const actionOutputRouteSlotKind = (
  action: Pick<ProjectAction, "id">,
  outputId: ActionOutputId,
  actions: Array<Pick<ProjectAction, "id" | "outputIds" | "humanGate"> & { agentIds?: string[] }>
): ActionOutputSlotKind | undefined => {
  const normalizedOutputId = normalizeActionToken(outputId);
  const outputIndex = actionOutputIds(actions, action.id).indexOf(normalizedOutputId);
  if (outputIndex === 0) return "approval";
  if (outputIndex === 1) return "rework";
  return undefined;
};

export const projectOutputRouteSlotKind = actionOutputRouteSlotKind;

export const actionOutputTargetAction = (
  targetActionId: string | undefined,
  actions: Array<Pick<ProjectAction, "id">>
): Pick<ProjectAction, "id"> | undefined => {
  if (!targetActionId) return undefined;
  const normalized = normalizeActionToken(targetActionId);
  return actions.find((action) => normalizeActionToken(action.id) === normalized);
};

export const projectOutputTargetPolicy = actionOutputTargetAction;

export const actionOutputRouteTargetAction = (
  action: Pick<ProjectAction, "id"> & { loopId?: string },
  outputId: ActionOutputId,
  outputRoutes: readonly ProjectOutputRoute[],
  actions: Array<Pick<ProjectAction, "id" | "outputIds" | "humanGate"> & { agentIds?: string[] }> = []
): Pick<ProjectAction, "id"> | undefined => {
  const route = findActionOutputRoute(outputRoutes, action.loopId ?? "", action.id, outputId);
  const legacyRoute = route as (ProjectOutputRoute & { target?: { policyId?: string; actionId?: string } }) | undefined;
  const targetActionId = route?.targetActionId ?? legacyRoute?.target?.policyId ?? legacyRoute?.target?.actionId;
  return actionOutputTargetAction(targetActionId, actions);
};

export const projectOutputRouteTargetPolicy = actionOutputRouteTargetAction;

export const actionOutputTargetEventType = (
  action: LegacyActionTokenInput,
  outputId: PolicyOutputId,
  _targetActionId?: string,
  _actions: Array<Pick<ProjectAction, "id" | "outputIds" | "humanGate"> & { agentIds?: string[] }> = []
): string => {
  void _targetActionId;
  void _actions;
  return actionOutputEventType(action, outputId);
};

export const projectOutputTargetEventType = actionOutputTargetEventType;

export const actionOutputRouteEventType = (
  action: Pick<ProjectAction, "id"> & { loopId?: string },
  outputId: PolicyOutputId,
  _outputRoutes: readonly ProjectOutputRoute[] = [],
  _actions: Array<Pick<ProjectAction, "id" | "outputIds" | "humanGate"> & { agentIds?: string[] }> = []
): string => {
  void _outputRoutes;
  void _actions;
  return actionOutputEventType({ loopId: action.loopId, actionId: action.id }, outputId);
};

export const projectOutputRouteEventType = actionOutputRouteEventType;

export const actionOutputEventTypes = (
  input: LegacyActionTokenInput,
  actions: Array<Pick<ProjectAction, "id" | "outputIds" | "humanGate"> & { agentIds?: string[] }> = [],
  outputs: Array<Pick<ProjectOutput, "id">> = []
): string[] => {
  const actionId = legacyActionToken(input);
  const outputIds = actionId && actions.length > 0 ? actionOutputIds(actions, actionId) : [...defaultActionOutputIds];
  const availableOutputIds = outputs.length > 0 ? outputIdSet(outputs) : undefined;
  return outputIds
    .filter((outputId) => !availableOutputIds || availableOutputIds.has(outputId))
    .map((outputId) => actionOutputEventType(input, outputId));
};

export const policyOutputEventTypes = actionOutputEventTypes;

export const normalizeActionOutputEventType = (value: string): string => {
  return value.replace(/^([a-z0-9_-]+)\.([a-z0-9_-]+)\.([a-z0-9_-]+)\.v1$/, "$1.$2.$3");
};

export const humanGateResponseId = (
  input: Pick<ProjectHumanGateResponse, "actionId"> & { loopId?: string }
): string => [
  input.loopId ? normalizeLoopId(input.loopId) : "loop",
  normalizeActionToken(input.actionId)
].filter(Boolean).join(":");

export const actionKeyTokens = (actions: Array<Pick<ProjectAction, "id">>): string[] =>
  [...new Set(actions.map((action) => normalizeActionToken(action.id)).filter(Boolean))];

export const policyActionTokens = actionKeyTokens;

const firstToken = (value: string): string => normalizeActionToken(value.split(/[\s/]+/)[0] ?? "");

export const agentTokenCandidates = (agent: Agent): string[] => {
  const candidates = [
    ...(agent.nicknameCandidates ?? []).map(normalizeActionToken),
    firstToken(agent.name),
    normalizeActionToken(agent.name),
    normalizeActionToken(agent.id).replace(/-agent$/, ""),
    normalizeActionToken(agent.id)
  ].filter(Boolean);
  return [...new Set(candidates)];
};

export const preferredAgentToken = (agent: Agent): string =>
  agentTokenCandidates(agent)[0] ?? normalizeActionToken(agent.id);

export const uniqueAgentActionTokens = (agents: Agent[]): string[] => {
  const used = new Set<string>();
  return agents.map((agent) => {
    const token = agentTokenCandidates(agent).find((candidate) => !used.has(candidate)) ?? preferredAgentToken(agent);
    used.add(token);
    return token;
  });
};

export const actionEventTypes = (
  actions: Array<Pick<ProjectAction, "id" | "outputIds" | "humanGate"> & { agentIds?: string[] }>,
  outputs: Array<Pick<ProjectOutput, "id">> = [],
  loops: Array<Pick<ProjectLoop, "id" | "steps">> = [],
  outputRoutes: readonly ProjectOutputRoute[] = []
): string[] => {
  const events = new Set<string>();
  loops.forEach((loop) => {
    const startEvent = eventTypeFromLoopId(loop.id);
    if (startEvent) events.add(startEvent);
    loop.steps.forEach((actionId) => {
      actionOutputEventTypes({ loopId: loop.id, actionId }, actions, outputs).forEach((eventType) => events.add(eventType));
    });
  });
  outputRoutes.forEach((route) => {
    const eventType = actionOutputEventType({ loopId: route.sourceLoopId, actionId: route.sourceActionId }, route.outputId);
    if (eventType) events.add(eventType);
  });
  return [...events];
};

export const policyEventTypesForActions = actionEventTypes;

export const policyEventTypesForAgentsAndActions = (
  _agents: Agent[],
  actions: Array<Pick<ProjectAction, "id" | "outputIds" | "humanGate"> & { agentIds?: string[] }>,
  outputs: Array<Pick<ProjectOutput, "id">> = [],
  loops: Array<Pick<ProjectLoop, "id" | "steps">> = [],
  outputRoutes: readonly ProjectOutputRoute[] = []
): string[] => actionEventTypes(actions, outputs, loops, outputRoutes);

export const resolveActionAgent = (agents: Agent[], token: string): Agent | undefined => {
  const normalized = normalizeActionToken(token);
  return agents.find((agent) => agentTokenCandidates(agent).includes(normalized));
};

export const defaultPolicyOutputIds = defaultActionOutputIds;
export type PolicyOutputId = ActionOutputId;
export const policyOutputStatuses = actionOutputStatuses;
export type PolicyOutputStatus = ActionOutputStatus;
export const uniquePolicyOutputIds = uniqueActionOutputIds;
export const normalizePolicyOutputEventType = normalizeActionOutputEventType;
export const uniqueAgentPolicyTokens = uniqueAgentActionTokens;
export const resolvePolicyAgent = resolveActionAgent;
