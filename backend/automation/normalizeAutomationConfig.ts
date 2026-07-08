import type { Agent } from "../../shared/domain/agents.js";
import type {
  ProjectAction,
  ProjectAutomationConfig,
  ProjectHumanGateResponse,
  ProjectOutput,
  ProjectOutputRoute,
  ProjectPolicy,
  ProjectLoop
} from "../../shared/domain/automation.js";
import { defaultProjectAutomationConfig } from "../../shared/domain/automation.js";
import type { ProjectRuntime } from "../../shared/domain/runtime.js";
import {
  actionOutputSlotKind,
  approvalOutputCandidates,
  reworkOutputCandidates,
  defaultPolicyOutputIds,
  defaultProjectOutputs,
  generatedPolicyId,
  humanGateResponseId,
  humanGateApprovalTriggerIdForPolicy,
  normalizeActionOutputSlots,
  normalizePolicyOutputEventType,
  normalizePolicyToken,
  normalizeTriggerToken,
  normalizeLoopId,
  projectOutputRouteKey,
  projectOutputRouteCanTargetTrigger,
  policyActionTokens,
  policyOutputEventType,
  triggerEventType,
  uniquePolicyOutputIds,
  resolvePolicyAgent,
  loopIdForPolicy
} from "../../shared/policy-actions.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const stringValue = (value: unknown): string =>
  typeof value === "string" ? value : "";

const stringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const recordArray = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter(isRecord) : [];

export const migrateProjectAutomationConfigInput = (value: unknown): unknown => {
  if (!isRecord(value)) return value;
  return {
    ...value,
    outputRoutes: value.outputRoutes === undefined ? [] : value.outputRoutes,
    humanGateResponses: value.humanGateResponses === undefined ? [] : value.humanGateResponses
  };
};

const normalizeAgentPolicyToken = (value: string): string =>
  normalizePolicyToken(value).replace(/-agent$/, "");

const normalizeAgentId = (value: string, agents: Agent[]): string => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return agents.find((agent) => agent.id === trimmed)?.id ?? resolvePolicyAgent(agents, trimmed)?.id ?? trimmed;
};

const normalizeOutput = (value: Record<string, unknown>): ProjectOutput => ({
  id: normalizePolicyToken(stringValue(value.id))
});

const normalizeRawOutputIds = (value: unknown): string[] | undefined =>
  Array.isArray(value) ? uniquePolicyOutputIds(stringArray(value)) : undefined;

const canonicalOutputIdForSlot = (slot: "approval" | "rework"): string =>
  slot === "approval" ? defaultPolicyOutputIds[0] : defaultPolicyOutputIds[1];

const canonicalOutputIdForLegacyOutput = (
  legacyOutputId: string,
  outputIndex: number,
  action?: Pick<ProjectAction, "outputIds">
): string | undefined => {
  const normalizedLegacyOutputId = normalizePolicyToken(legacyOutputId);
  const semanticSlot = actionOutputSlotKind(normalizedLegacyOutputId);
  const positionalSlot = outputIndex === 0 ? "approval" : outputIndex === 1 ? "rework" : undefined;
  const slot = semanticSlot ?? positionalSlot;
  if (slot === "approval") return action?.outputIds[0] ?? canonicalOutputIdForSlot("approval");
  if (slot === "rework") return action?.outputIds[1] ?? canonicalOutputIdForSlot("rework");
  return undefined;
};

const canonicalOutputIdsForOutputs = (outputs: ProjectOutput[]): ProjectOutput[] => {
  const ids = new Set<string>();
  outputs.forEach((output, index) => {
    const canonicalOutputId = canonicalOutputIdForLegacyOutput(output.id, index);
    if (canonicalOutputId) ids.add(canonicalOutputId);
  });
  defaultPolicyOutputIds.forEach((outputId) => ids.add(outputId));
  return [...ids].map((id) => ({ id }));
};

const normalizeOutputIds = (value: unknown): string[] | undefined => {
  const rawOutputIds = normalizeRawOutputIds(value);
  return rawOutputIds ? normalizeActionOutputSlots(rawOutputIds) : undefined;
};

const fallbackActionOutputIds = (availableOutputIds: string[]) => {
  const fallbackOutputIds = defaultPolicyOutputIds.filter((id) => availableOutputIds.includes(id));
  return fallbackOutputIds.length === defaultPolicyOutputIds.length
    ? fallbackOutputIds
    : [...defaultPolicyOutputIds];
};

const legacyGateActions = (value: unknown, availableOutputIds: string[]): Record<string, unknown>[] =>
  recordArray(value).map((gate) => ({
    id: stringValue(gate.id),
    description: stringValue(gate.description),
    outputIds: fallbackActionOutputIds(availableOutputIds),
    agentIds: [],
    humanGate: true,
    __legacyGateId: normalizePolicyToken(stringValue(gate.id))
  }));

const normalizeActionBase = (value: Record<string, unknown>, availableOutputIds: string[]) => ({
  id: normalizePolicyToken(stringValue(value.id)),
  description: stringValue(value.description),
  outputIds: normalizeOutputIds(value.outputIds) ?? fallbackActionOutputIds(availableOutputIds),
  humanGate: value.humanGate === true
});

const normalizeRawAgentIds = (value: unknown, agents: Agent[]): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  return [...new Set(stringArray(value).map((agentId) => normalizeAgentId(agentId, agents)).filter(Boolean))];
};

const inferLegacyPolicyAction = (value: Record<string, unknown>): string => {
  const haystack = [value.action, value.id, value.title, value.name]
    .map(stringValue)
    .join(" ")
    .toLowerCase();
  if (haystack.includes("implement")) return "implementation";
  if (haystack.includes("plan")) return "planning";
  if (haystack.includes("review")) return "review";
  return "run";
};

type LegacyPolicy = {
  rawId: string;
  source: ProjectPolicy["source"];
  event?: string;
  trigger?: string;
  action: string;
  agentToken: string;
  enabled: boolean;
};

const readLegacyPolicy = (value: Record<string, unknown>): LegacyPolicy => {
  const run = isRecord(value.run) ? value.run : {};
  const event = normalizePolicyOutputEventType(stringValue(value.event) || stringValue(value.on));
  const trigger = normalizeTriggerToken(stringValue(value.trigger));
  const source: ProjectPolicy["source"] = stringValue(value.source) === "trigger" || trigger ? "trigger" : "event";
  return {
    rawId: stringValue(value.id),
    source,
    event: source === "event" ? event : undefined,
    trigger: source === "trigger" ? trigger : undefined,
    action: normalizePolicyToken(stringValue(value.action) || inferLegacyPolicyAction(value)),
    agentToken: normalizeAgentPolicyToken(stringValue(value.agent) || stringValue(run.agent)),
    enabled: typeof value.enabled === "boolean" ? value.enabled : false
  };
};

type ActionRewrite = {
  actionIdByLegacyAgent: Map<string, string>;
  eventIdByLegacyEvent: Map<string, string>;
};

const semanticOutputIds = (): string[] =>
  uniquePolicyOutputIds([
    ...defaultPolicyOutputIds,
    ...approvalOutputCandidates,
    ...reworkOutputCandidates
  ]);

const targetOutputIdForLegacyOutput = (legacyOutputId: string, outputIndex: number, action: ProjectAction): string | undefined =>
  canonicalOutputIdForLegacyOutput(legacyOutputId, outputIndex, action);

const addOutputEventRewrite = (
  rewrite: ActionRewrite,
  legacyEvent: string,
  action: ProjectAction,
  outputId: string
) => {
  rewrite.eventIdByLegacyEvent.set(
    normalizePolicyOutputEventType(legacyEvent),
    policyOutputEventType({ action: action.id }, outputId)
  );
};

const createActions = (
  rawActions: Record<string, unknown>[],
  legacyPolicies: LegacyPolicy[],
  availableOutputIds: string[],
  agents: Agent[]
): { actions: ProjectAction[]; rewrite: ActionRewrite; gateActionIdByLegacyGateId: Map<string, string> } => {
  const actionAgentTokens = new Map<string, Set<string>>();
  legacyPolicies.forEach((policy) => {
    if (!policy.action || !policy.agentToken) return;
    actionAgentTokens.set(policy.action, actionAgentTokens.get(policy.action) ?? new Set<string>());
    actionAgentTokens.get(policy.action)?.add(policy.agentToken);
  });

  const actionBases = rawActions.length > 0
    ? rawActions.map((action) => {
      const rawAgentIds = normalizeRawAgentIds(action.agentIds, agents);
      const rawOutputIds = normalizeRawOutputIds(action.outputIds);
      const base = normalizeActionBase(action, availableOutputIds);
      return {
        base: rawAgentIds?.length === 0 && !base.humanGate
          ? { ...base, outputIds: [] }
          : base,
        rawAgentIds,
        rawOutputIds,
        legacyGateId: typeof action.__legacyGateId === "string" ? action.__legacyGateId : undefined
      };
    })
    : policyActionTokens(legacyPolicies).map((id) => ({
      base: { id, description: "", outputIds: fallbackActionOutputIds(availableOutputIds), humanGate: false },
      rawAgentIds: undefined,
      rawOutputIds: [...defaultPolicyOutputIds],
      legacyGateId: undefined
    }));

  const rewrite: ActionRewrite = {
    actionIdByLegacyAgent: new Map(),
    eventIdByLegacyEvent: new Map()
  };
  const actions: ProjectAction[] = [];
  const usedActionIds = new Set<string>();
  const gateActionIdByLegacyGateId = new Map<string, string>();

  const uniqueActionId = (baseId: string) => {
    let candidate = baseId || "action";
    let suffix = 2;
    while (usedActionIds.has(candidate)) {
      candidate = `${baseId || "action"}-${suffix}`;
      suffix += 1;
    }
    usedActionIds.add(candidate);
    return candidate;
  };

  const actionFromBase = (
    base: { description: string; outputIds: string[]; humanGate: boolean },
    id: string,
    agentIds: string[]
  ): ProjectAction => ({
    id,
    description: base.description,
    outputIds: base.outputIds,
    agentIds: base.humanGate ? [] : agentIds,
    ...(base.humanGate ? { humanGate: true } : {})
  });

  const registerLegacyEventRewrites = (
    legacyActionId: string,
    legacyAgentToken: string,
    action: ProjectAction,
    rawOutputIds: string[]
  ) => {
    const legacyOutputIds = uniquePolicyOutputIds([...rawOutputIds, ...semanticOutputIds()]);
    legacyOutputIds.forEach((legacyOutputId, outputIndex) => {
      const outputId = targetOutputIdForLegacyOutput(legacyOutputId, outputIndex, action);
      if (!outputId) return;
      addOutputEventRewrite(rewrite, `${legacyActionId}.${legacyOutputId}`, action, outputId);
      if (legacyAgentToken) addOutputEventRewrite(rewrite, `${legacyAgentToken}.${legacyActionId}.${legacyOutputId}`, action, outputId);
    });
  };

  const registerGateAction = (legacyGateId: string | undefined, action: ProjectAction) => {
    if (legacyGateId) gateActionIdByLegacyGateId.set(legacyGateId, action.id);
  };

  actionBases.forEach(({ base, rawAgentIds, rawOutputIds, legacyGateId }) => {
    const legacyAgentTokens = [...(actionAgentTokens.get(base.id) ?? new Set<string>())];
    if (rawAgentIds) {
      const action = actionFromBase(base, uniqueActionId(base.id), rawAgentIds);
      actions.push(action);
      registerGateAction(legacyGateId, action);
      legacyAgentTokens.forEach((agentToken) => {
        rewrite.actionIdByLegacyAgent.set(`${base.id}:${agentToken}`, action.id);
        registerLegacyEventRewrites(base.id, agentToken, action, rawOutputIds ?? action.outputIds);
      });
      registerLegacyEventRewrites(base.id, "", action, rawOutputIds ?? action.outputIds);
      return;
    }

    const inferredAgentIds = legacyAgentTokens.map((agentToken) => normalizeAgentId(agentToken, agents)).filter(Boolean);
    if (legacyAgentTokens.length <= 1) {
      const action = actionFromBase(base, uniqueActionId(base.id), [...new Set(inferredAgentIds)]);
      actions.push(action);
      registerGateAction(legacyGateId, action);
      legacyAgentTokens.forEach((agentToken) => {
        rewrite.actionIdByLegacyAgent.set(`${base.id}:${agentToken}`, action.id);
        registerLegacyEventRewrites(base.id, agentToken, action, rawOutputIds ?? action.outputIds);
      });
      registerLegacyEventRewrites(base.id, "", action, rawOutputIds ?? action.outputIds);
      return;
    }

    legacyAgentTokens.forEach((agentToken) => {
      const action = actionFromBase(base, uniqueActionId(`${base.id}-${agentToken}`), [normalizeAgentId(agentToken, agents)].filter(Boolean));
      actions.push(action);
      registerGateAction(legacyGateId, action);
      rewrite.actionIdByLegacyAgent.set(`${base.id}:${agentToken}`, action.id);
      registerLegacyEventRewrites(base.id, agentToken, action, rawOutputIds ?? action.outputIds);
    });
  });

  return { actions, rewrite, gateActionIdByLegacyGateId };
};

const normalizeEvent = (event: string | undefined, rewrite: ActionRewrite): string | undefined => {
  if (!event) return event;
  const normalized = normalizePolicyOutputEventType(event);
  return rewrite.eventIdByLegacyEvent.get(normalized) ?? normalized;
};

const normalizePolicy = (
  value: LegacyPolicy,
  rewrite: ActionRewrite,
  legacyTriggerIdMap: ReadonlyMap<string, string> = new Map(),
  derivedTriggerIdSet: ReadonlySet<string> = new Set(),
  approvalEventTriggerIdMap: ReadonlyMap<string, string> = new Map()
): ProjectPolicy => {
  const action = rewrite.actionIdByLegacyAgent.get(`${value.action}:${value.agentToken}`) ?? value.action;
  const event = value.source === "event" ? normalizeEvent(value.event, rewrite) : undefined;
  const eventTrigger = event ? approvalEventTriggerIdMap.get(event) : undefined;
  const explicitTriggerEvent = event?.startsWith("trigger.") ? normalizeTriggerToken(event.slice("trigger.".length)) : undefined;
  const normalizedTrigger = value.trigger ? normalizeTriggerToken(normalizeEvent(value.trigger, rewrite) ?? value.trigger) : undefined;
  const mappedTrigger = normalizedTrigger ? legacyTriggerIdMap.get(normalizedTrigger) : undefined;
  const currentDerivedTrigger = normalizedTrigger && derivedTriggerIdSet.has(normalizedTrigger) ? normalizedTrigger : undefined;
  const explicitPolicyTrigger = normalizedTrigger || undefined;
  const trigger = mappedTrigger ?? currentDerivedTrigger ?? eventTrigger ?? explicitTriggerEvent ?? explicitPolicyTrigger;
  const normalized = {
    source: trigger ? "trigger" as const : value.source === "trigger" ? "event" as const : value.source,
    event: value.source === "event" && !eventTrigger && !explicitTriggerEvent
      ? event
      : !trigger && value.trigger
        ? triggerEventType(value.trigger)
        : undefined,
    trigger: trigger || undefined,
    action,
    enabled: value.enabled
  };
  return {
    ...normalized,
    id: generatedPolicyId(normalized)
  };
};

const normalizeRuntime = (value: Record<string, unknown>): ProjectRuntime => ({
  id: stringValue(value.id),
  title: stringValue(value.title),
  command: stringValue(value.command),
  args: stringArray(value.args)
});

const normalizeLoop = (value: Record<string, unknown>, policyIdMap: Map<string, string>): ProjectLoop => ({
  id: normalizeLoopId(stringValue(value.id)),
  steps: stringArray(value.steps).map((step) => policyIdMap.get(step) ?? step)
});

const normalizeLoopsFromStartingTriggers = (
  loops: ProjectLoop[],
  policies: ProjectPolicy[]
): { loops: ProjectLoop[]; loopIdMap: Map<string, string> } => {
  const policyById = new Map(policies.map((policy) => [policy.id, policy]));
  const loopIdMap = new Map<string, string>();
  const normalizedLoops = loops.map((loop) => {
    const oldId = normalizeLoopId(loop.id);
    const derivedId = loopIdForPolicy(policyById.get(loop.steps[0] ?? ""));
    const id = derivedId || oldId;
    if (oldId && derivedId && oldId !== derivedId) loopIdMap.set(oldId, derivedId);
    return { ...loop, id };
  });
  return { loops: normalizedLoops, loopIdMap };
};

const normalizeOutputRouteTarget = (value: unknown, rewrite: ActionRewrite): ProjectOutputRoute["target"] | undefined => {
  if (!isRecord(value)) return undefined;
  if (value.type === "event") {
    const eventType = normalizeEvent(stringValue(value.eventType), rewrite);
    return {
      type: "event",
      ...(eventType ? { eventType } : {})
    };
  }
  return undefined;
};

const normalizeOutputRoutes = (
  value: unknown,
  policyIdMap: Map<string, string>,
  policies: ProjectPolicy[],
  actions: ProjectAction[],
  rewrite: ActionRewrite
): ProjectOutputRoute[] => {
  const routesByKey = new Map<string, ProjectOutputRoute>();
  const policyById = new Map(policies.map((policy) => [policy.id, policy]));
  const actionById = new Map(actions.map((action) => [action.id, action]));

  recordArray(value).forEach((route) => {
    const sourcePolicyId = policyIdMap.get(stringValue(route.sourcePolicyId)) ?? stringValue(route.sourcePolicyId);
    const rawOutputId = normalizePolicyToken(stringValue(route.outputId));
    const policy = policyById.get(sourcePolicyId);
    const action = policy ? actionById.get(policy.action) : undefined;
    const outputId = action
      ? canonicalOutputIdForLegacyOutput(rawOutputId, action.outputIds.indexOf(rawOutputId), action)
      : canonicalOutputIdForLegacyOutput(rawOutputId, 0);
    const target = normalizeOutputRouteTarget(route.target, rewrite);
    if (!sourcePolicyId || !outputId || !target) return;
    if (policy && projectOutputRouteCanTargetTrigger(policy, outputId, actions)) return;
    routesByKey.set(projectOutputRouteKey(sourcePolicyId, outputId), {
      sourcePolicyId,
      outputId,
      target
    });
  });

  return [...routesByKey.values()];
};

const legacyTriggerTarget = (target: unknown): string | undefined => {
  if (!isRecord(target) || target.type !== "trigger") return undefined;
  const trigger = normalizeTriggerToken(stringValue(target.trigger));
  return trigger || undefined;
};

const legacyTriggerIdMapFromOutputRoutes = (
  value: unknown,
  policyIdMap: Map<string, string>,
  policies: ProjectPolicy[],
  actions: ProjectAction[]
): Map<string, string> => {
  const policyById = new Map(policies.map((policy) => [policy.id, policy]));
  const triggerIdMap = new Map<string, string>();

  recordArray(value).forEach((route) => {
    const legacyTrigger = legacyTriggerTarget(route.target);
    if (!legacyTrigger) return;
    const sourcePolicyId = policyIdMap.get(stringValue(route.sourcePolicyId)) ?? stringValue(route.sourcePolicyId);
    const sourcePolicy = policyById.get(sourcePolicyId);
    const sourceAction = sourcePolicy ? actions.find((action) => action.id === sourcePolicy.action) : undefined;
    const rawOutputId = normalizePolicyToken(stringValue(route.outputId));
    const outputId = sourceAction
      ? canonicalOutputIdForLegacyOutput(rawOutputId, sourceAction.outputIds.indexOf(rawOutputId), sourceAction)
      : canonicalOutputIdForLegacyOutput(rawOutputId, 0);
    if (!sourcePolicy || !outputId) return;
    const derivedTrigger = humanGateApprovalTriggerIdForPolicy(sourcePolicy, outputId, actions);
    if (derivedTrigger) triggerIdMap.set(legacyTrigger, derivedTrigger);
  });

  return triggerIdMap;
};

type LegacyGateRouteMigration = {
  policies: ProjectPolicy[];
  loops: ProjectLoop[];
  routePolicyIdByGateRouteKey: Map<string, string>;
};

const legacyGateRouteKey = (sourcePolicyId: string, outputId: string, gateId: string): string =>
  `${sourcePolicyId}:${outputId}:${gateId}`;

const migrateLegacyGateRoutes = ({
  rawOutputRoutes,
  sourcePolicies,
  loops,
  policyIdMap,
  gateActionIdByLegacyGateId,
  actions
}: {
  rawOutputRoutes: unknown;
  sourcePolicies: ProjectPolicy[];
  loops: ProjectLoop[];
  policyIdMap: Map<string, string>;
  gateActionIdByLegacyGateId: Map<string, string>;
  actions: ProjectAction[];
}): LegacyGateRouteMigration => {
  const policyById = new Map(sourcePolicies.map((policy) => [policy.id, policy]));
  const actionById = new Map(actions.map((action) => [action.id, action]));
  const nextPoliciesById = new Map(sourcePolicies.map((policy) => [policy.id, policy]));
  const routePolicyIdByGateRouteKey = new Map<string, string>();

  recordArray(rawOutputRoutes).forEach((route) => {
    const target = isRecord(route.target) ? route.target : undefined;
    if (target?.type !== "gate") return;
    const sourcePolicyId = policyIdMap.get(stringValue(route.sourcePolicyId)) ?? stringValue(route.sourcePolicyId);
    const gateId = normalizePolicyToken(stringValue(target.gate));
    const actionId = gateActionIdByLegacyGateId.get(gateId) ?? gateId;
    const sourcePolicy = policyById.get(sourcePolicyId);
    const sourceAction = sourcePolicy ? actionById.get(sourcePolicy.action) : undefined;
    const rawOutputId = normalizePolicyToken(stringValue(route.outputId));
    const outputId = sourceAction
      ? canonicalOutputIdForLegacyOutput(rawOutputId, sourceAction.outputIds.indexOf(rawOutputId), sourceAction)
      : canonicalOutputIdForLegacyOutput(rawOutputId, 0);
    if (!sourcePolicy || !outputId || !actionId) return;

    const event = policyOutputEventType({ action: sourcePolicy.action }, outputId);
    const policyShape = {
      source: "event" as const,
      event,
      action: actionId,
      enabled: true
    };
    const gatePolicy: ProjectPolicy = {
      ...policyShape,
      id: generatedPolicyId(policyShape)
    };
    nextPoliciesById.set(gatePolicy.id, nextPoliciesById.get(gatePolicy.id) ?? gatePolicy);
    routePolicyIdByGateRouteKey.set(legacyGateRouteKey(sourcePolicyId, outputId, gateId), gatePolicy.id);
    if (rawOutputId && rawOutputId !== outputId) {
      routePolicyIdByGateRouteKey.set(legacyGateRouteKey(sourcePolicyId, rawOutputId, gateId), gatePolicy.id);
    }
  });

  const loopsWithLegacyGateSteps = loops.map((loop) => {
    let nextSteps = [...loop.steps];
    [...routePolicyIdByGateRouteKey].forEach(([key, gatePolicyId]) => {
      const [sourcePolicyId] = key.split(":");
      const sourceIndex = nextSteps.indexOf(sourcePolicyId ?? "");
      if (sourceIndex < 0 || nextSteps.includes(gatePolicyId)) return;
      nextSteps = [
        ...nextSteps.slice(0, sourceIndex + 1),
        gatePolicyId,
        ...nextSteps.slice(sourceIndex + 1)
      ];
    });
    return { ...loop, steps: nextSteps };
  });

  return {
    policies: [...nextPoliciesById.values()],
    loops: loopsWithLegacyGateSteps,
    routePolicyIdByGateRouteKey
  };
};

const normalizeHumanGateResponse = (
  value: Record<string, unknown>,
  loopIdMap: ReadonlyMap<string, string>,
  policyIdMap: ReadonlyMap<string, string>,
  actionById: ReadonlyMap<string, ProjectAction>
): ProjectHumanGateResponse | undefined => {
  const policyId = policyIdMap.get(stringValue(value.policyId)) ?? stringValue(value.policyId);
  const actionId = normalizePolicyToken(stringValue(value.actionId));
  const rawOutputId = normalizePolicyToken(stringValue(value.outputId));
  const action = actionById.get(actionId);
  const outputId = action
    ? canonicalOutputIdForLegacyOutput(rawOutputId, action.outputIds.indexOf(rawOutputId), action)
    : canonicalOutputIdForLegacyOutput(rawOutputId, 0);
  const rawLoopId = normalizeLoopId(stringValue(value.loopId));
  const loopId = loopIdMap.get(rawLoopId) ?? rawLoopId;
  if (!policyId || !actionId || !outputId) return undefined;
  const responseBase = {
    ...(loopId ? { loopId } : {}),
    policyId,
    actionId,
    outputId,
    prompt: stringValue(value.prompt).trim(),
    submittedAt: stringValue(value.submittedAt)
  };
  return { ...responseBase, id: humanGateResponseId(responseBase) };
};

const migrateLegacyGateDecisions = ({
  rawGateDecisions,
  policyIdMap,
  gateActionIdByLegacyGateId,
  routePolicyIdByGateRouteKey,
  actionById,
  loopIdMap
}: {
  rawGateDecisions: unknown;
  policyIdMap: Map<string, string>;
  gateActionIdByLegacyGateId: Map<string, string>;
  routePolicyIdByGateRouteKey: Map<string, string>;
  actionById: Map<string, ProjectAction>;
  loopIdMap: ReadonlyMap<string, string>;
}): ProjectHumanGateResponse[] =>
  recordArray(rawGateDecisions).flatMap((decision) => {
    const status = stringValue(decision.status);
    if (status !== "approved" && status !== "rejected") return [];
    const sourcePolicyId = policyIdMap.get(stringValue(decision.sourcePolicyId)) ?? stringValue(decision.sourcePolicyId);
    const sourceOutputId = normalizePolicyToken(stringValue(decision.outputId));
    const gateId = normalizePolicyToken(stringValue(decision.gateId));
    const policyId = routePolicyIdByGateRouteKey.get(legacyGateRouteKey(sourcePolicyId, sourceOutputId, gateId));
    const actionId = gateActionIdByLegacyGateId.get(gateId) ?? gateId;
    const action = actionById.get(actionId);
    if (!policyId || !action) return [];
    const outputId = status === "approved"
      ? action.outputIds[0]
      : action.outputIds[1] ?? action.outputIds[0];
    if (!outputId) return [];
    const rawLoopId = normalizeLoopId(stringValue(decision.loopId));
    const loopId = loopIdMap.get(rawLoopId) ?? rawLoopId;
    const prompt = stringValue(decision.comment).trim() || (status === "approved" ? "Approved." : "Rework requested.");
    const response = {
      ...(loopId ? { loopId } : {}),
      policyId,
      actionId,
      outputId,
      prompt,
      submittedAt: stringValue(decision.decidedAt) || "1970-01-01T00:00:00.000Z"
    };
    return [{ ...response, id: humanGateResponseId(response) }];
  });

const normalizeHumanGateResponses = ({
  rawResponses,
  rawGateDecisions,
  policyIdMap,
  gateActionIdByLegacyGateId,
  routePolicyIdByGateRouteKey,
  actionById,
  loopIdMap
}: {
  rawResponses: unknown;
  rawGateDecisions: unknown;
  policyIdMap: Map<string, string>;
  gateActionIdByLegacyGateId: Map<string, string>;
  routePolicyIdByGateRouteKey: Map<string, string>;
  actionById: Map<string, ProjectAction>;
  loopIdMap: ReadonlyMap<string, string>;
}): ProjectHumanGateResponse[] => {
  const responseById = new Map<string, ProjectHumanGateResponse>();
  [
    ...recordArray(rawResponses).flatMap((response) => normalizeHumanGateResponse(response, loopIdMap, policyIdMap, actionById) ?? []),
    ...migrateLegacyGateDecisions({
      rawGateDecisions,
      policyIdMap,
      gateActionIdByLegacyGateId,
      routePolicyIdByGateRouteKey,
      actionById,
      loopIdMap
    })
  ].forEach((response) => responseById.set(response.id, response));
  return [...responseById.values()];
};

const outputsWithActionOutputIds = (outputs: ProjectOutput[], actions: ProjectAction[]): ProjectOutput[] => {
  const outputById = new Map(canonicalOutputIdsForOutputs(outputs).map((output) => [output.id, output]));
  actions.flatMap((action) => action.outputIds).forEach((outputId) => {
    if (!outputById.has(outputId)) outputById.set(outputId, { id: outputId });
  });
  return [...outputById.values()];
};

const derivedHumanGateTriggerIds = (actions: ProjectAction[]): Set<string> =>
  new Set(actions.flatMap((action) => {
    if (!action.humanGate) return [];
    const approvalOutputId = action.outputIds[0];
    const trigger = approvalOutputId ? humanGateApprovalTriggerIdForPolicy({ action: action.id }, approvalOutputId, actions) : undefined;
    return trigger ? [trigger] : [];
  }));

const humanGateApprovalEventTriggerIdMap = (actions: ProjectAction[]): Map<string, string> =>
  new Map(actions.flatMap((action) => {
    if (!action.humanGate) return [];
    const approvalOutputId = action.outputIds[0];
    const trigger = approvalOutputId ? humanGateApprovalTriggerIdForPolicy({ action: action.id }, approvalOutputId, actions) : undefined;
    return trigger ? [[policyOutputEventType({ action: action.id }, approvalOutputId), trigger] as const] : [];
  }));

export const normalizeProjectAutomationConfig = (value: unknown, agents: Agent[] = []): ProjectAutomationConfig => {
  const input = migrateProjectAutomationConfigInput(value);
  if (!isRecord(input)) return defaultProjectAutomationConfig();
  const rawPolicies = recordArray(input.policies);
  const legacyPolicies = rawPolicies.map(readLegacyPolicy);

  const rawOutputs = Array.isArray(input.outputs) && recordArray(input.outputs).length > 0
    ? recordArray(input.outputs).map(normalizeOutput)
    : defaultProjectOutputs();
  const availableOutputIds = rawOutputs.map((output) => output.id).filter(Boolean);
  const rawActionRecords = [
    ...(Array.isArray(input.actions) ? recordArray(input.actions) : []),
    ...legacyGateActions(input.gates, availableOutputIds)
  ];
  const { actions, rewrite, gateActionIdByLegacyGateId } = createActions(
    rawActionRecords,
    legacyPolicies,
    availableOutputIds,
    agents
  );
  const outputs = outputsWithActionOutputIds(rawOutputs, actions);
  const derivedTriggerIdSet = derivedHumanGateTriggerIds(actions);
  const approvalEventTriggerIdMap = humanGateApprovalEventTriggerIdMap(actions);

  const initialPolicyPairs = legacyPolicies.map((policy) => ({
    rawId: policy.rawId,
    normalized: normalizePolicy(policy, rewrite, new Map(), derivedTriggerIdSet, approvalEventTriggerIdMap)
  }));
  const initialPolicyIdMap = new Map(initialPolicyPairs
    .filter((pair) => pair.rawId && pair.rawId !== pair.normalized.id)
    .map((pair) => [pair.rawId, pair.normalized.id]));
  const legacyTriggerIdMap = legacyTriggerIdMapFromOutputRoutes(
    input.outputRoutes,
    initialPolicyIdMap,
    initialPolicyPairs.map((pair) => pair.normalized),
    actions
  );
  const policyPairs = legacyPolicies.map((policy, index) => ({
    rawId: policy.rawId,
    initialId: initialPolicyPairs[index]?.normalized.id,
    normalized: normalizePolicy(policy, rewrite, legacyTriggerIdMap, derivedTriggerIdSet, approvalEventTriggerIdMap)
  }));
  const policyIdMap = new Map<string, string>();
  policyPairs.forEach((pair) => {
    if (pair.rawId && pair.rawId !== pair.normalized.id) policyIdMap.set(pair.rawId, pair.normalized.id);
    if (pair.initialId && pair.initialId !== pair.normalized.id) policyIdMap.set(pair.initialId, pair.normalized.id);
  });
  const loops = recordArray(input.loops).map((loop) => normalizeLoop(loop, policyIdMap));
  const migratedGateRoutes = migrateLegacyGateRoutes({
    rawOutputRoutes: input.outputRoutes,
    sourcePolicies: policyPairs.map((pair) => pair.normalized),
    loops,
    policyIdMap,
    gateActionIdByLegacyGateId,
    actions
  });
  const normalizedLoops = normalizeLoopsFromStartingTriggers(
    migratedGateRoutes.loops,
    migratedGateRoutes.policies
  );
  const actionById = new Map(actions.map((action) => [action.id, action]));

  return {
    version: 1,
    actions,
    outputs,
    outputRoutes: normalizeOutputRoutes(input.outputRoutes, policyIdMap, migratedGateRoutes.policies, actions, rewrite),
    humanGateResponses: normalizeHumanGateResponses({
      rawResponses: input.humanGateResponses,
      rawGateDecisions: input.gateDecisions,
      policyIdMap,
      gateActionIdByLegacyGateId,
      routePolicyIdByGateRouteKey: migratedGateRoutes.routePolicyIdByGateRouteKey,
      actionById,
      loopIdMap: normalizedLoops.loopIdMap
    }),
    policies: migratedGateRoutes.policies,
    loops: normalizedLoops.loops,
    runtimes: recordArray(input.runtimes).map(normalizeRuntime)
  };
};
