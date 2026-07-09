import type { Agent } from "../../shared/domain/agents.js";
import type {
  ProjectAction,
  ProjectAutomationConfig,
  ProjectHumanGateResponse,
  ProjectLoop,
  ProjectOutput,
  ProjectOutputRoute
} from "../../shared/domain/automation.js";
import { defaultProjectAutomationConfig } from "../../shared/domain/automation.js";
import type { ProjectRuntime } from "../../shared/domain/runtime.js";
import {
  actionHasExecutableTarget,
  actionOutputRouteKey,
  actionOutputSlotKind,
  defaultActionOutputIds,
  defaultProjectOutputs,
  eventTypeFromLoopId,
  humanGateResponseId,
  loopIdFromEvent,
  normalizeActionOutputEventType,
  normalizeActionOutputSlots,
  normalizeActionToken,
  normalizeEventTypeToken,
  normalizeLoopId,
  resolveActionAgent,
  uniqueActionOutputIds
} from "../../shared/policy-actions.js";

type RawRecord = Record<string, unknown>;

type HandlerBinding = {
  rawId: string;
  loopId: string;
  actionId: string;
  event: string;
};

const isRecord = (value: unknown): value is RawRecord =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const stringValue = (value: unknown): string =>
  typeof value === "string" ? value : "";

const stringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const recordArray = (value: unknown): RawRecord[] =>
  Array.isArray(value) ? value.filter(isRecord) : [];

export const migrateProjectAutomationConfigInput = (value: unknown): unknown => {
  if (!isRecord(value)) return value;
  return {
    ...value,
    outputRoutes: value.outputRoutes === undefined ? [] : value.outputRoutes,
    humanGateResponses: value.humanGateResponses === undefined ? [] : value.humanGateResponses
  };
};

const normalizeActionId = (value: string): string =>
  value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");

const normalizeAgentId = (value: string, agents: Agent[]): string => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return agents.find((agent) => agent.id === trimmed)?.id ?? resolveActionAgent(agents, trimmed)?.id ?? trimmed;
};

const normalizeRawAgentId = (value: unknown, agents: Agent[]): string | undefined => {
  const agentId = typeof value === "string" ? normalizeAgentId(value, agents) : "";
  return agentId || undefined;
};

const normalizeRawOutputIds = (value: unknown): string[] | undefined =>
  Array.isArray(value) ? normalizeActionOutputSlots(uniqueActionOutputIds(stringArray(value))) : undefined;

const normalizeEvent = (value: string): string =>
  normalizeEventTypeToken(normalizeActionOutputEventType(value.startsWith("trigger.") ? value.slice("trigger.".length) : value));

const normalizeLegacyEvent = (value: string): string => {
  const event = normalizeEvent(value);
  const parts = event.split(".");
  const last = parts.at(-1);
  const slot = last ? actionOutputSlotKind(last) : undefined;
  if (!slot || parts.length < 2) return event;
  return [...parts.slice(0, -1), slot === "approval" ? defaultActionOutputIds[0] : defaultActionOutputIds[1]].join(".");
};

const normalizeRouteOutputId = (value: string): string => {
  const outputId = normalizeActionToken(value);
  const slot = actionOutputSlotKind(outputId);
  if (slot === "approval") return defaultActionOutputIds[0];
  if (slot === "rework") return defaultActionOutputIds[1];
  return outputId;
};

const normalizeOutput = (value: RawRecord): ProjectOutput => ({
  id: normalizeActionToken(stringValue(value.id))
});

const canonicalOutputs = (rawOutputs: RawRecord[]): ProjectOutput[] => {
  const outputById = new Map<string, ProjectOutput>();
  const sourceOutputs = rawOutputs.length > 0 ? rawOutputs.map(normalizeOutput) : defaultProjectOutputs();
  [...sourceOutputs, ...defaultProjectOutputs()].forEach((output) => {
    if (output.id) outputById.set(output.id, output);
  });
  return [...outputById.values()];
};

const fallbackOutputIds = (availableOutputIds: string[]) => {
  const defaults = defaultActionOutputIds.filter((id) => availableOutputIds.includes(id));
  return defaults.length === defaultActionOutputIds.length ? defaults : [...defaultActionOutputIds];
};

const executableOutputIds = (
  outputIds: string[] | undefined,
  executable: Pick<ProjectAction, "humanGate" | "agentId">,
  availableOutputIds: string[]
): string[] => {
  const source = outputIds ?? fallbackOutputIds(availableOutputIds);
  return actionHasExecutableTarget(executable) ? normalizeActionOutputSlots(source) : [];
};

const rawActionToken = (value: RawRecord): string =>
  normalizeActionId(stringValue(value.key) || stringValue(value.action) || stringValue(value.id));

const readBaseAction = (value: RawRecord, agents: Agent[], availableOutputIds: string[]): ProjectAction | undefined => {
  const id = rawActionToken(value);
  if (!id) return undefined;
  const humanGate = value.humanGate === true;
  const agentId = humanGate ? undefined : normalizeRawAgentId(value.agentId, agents);
  const executable = { humanGate, agentId };
  return {
    id,
    description: stringValue(value.description),
    outputIds: executableOutputIds(normalizeRawOutputIds(value.outputIds), executable, availableOutputIds),
    ...(agentId ? { agentId } : {}),
    ...(humanGate ? { humanGate: true } : {})
  };
};

const normalizeRuntime = (value: RawRecord): ProjectRuntime => ({
  id: normalizeActionToken(stringValue(value.id)),
  title: stringValue(value.title),
  command: stringValue(value.command),
  args: stringArray(value.args)
});

const inferLegacyPolicyAction = (value: RawRecord): string => {
  const run = isRecord(value.run) ? value.run : {};
  const haystack = [value.action, value.id, value.title, value.name, run.agent]
    .map(stringValue)
    .join(" ")
    .toLowerCase();
  if (haystack.includes("implement")) return "implementation";
  if (haystack.includes("plan")) return "planning";
  if (haystack.includes("review")) return "review";
  return "run";
};

const legacyPolicyActionId = (policy: RawRecord): string => {
  const run = isRecord(policy.run) ? policy.run : {};
  return normalizeActionId(stringValue(policy.action) || inferLegacyPolicyAction(policy) || stringValue(run.agent));
};

const legacyPolicyEvent = (policy: RawRecord): string =>
  normalizeLegacyEvent(stringValue(policy.event) || stringValue(policy.on) || stringValue(policy.trigger));

const loopIdsForRawStep = (rawStepId: string, rawLoops: RawRecord[]): string[] =>
  rawLoops
    .filter((loop) => stringArray(loop.steps).includes(rawStepId))
    .map((loop) => normalizeLoopId(stringValue(loop.id)))
    .filter(Boolean);

const explicitLoopIdForHandler = (handler: RawRecord, rawLoops: RawRecord[], event: string): string[] => {
  const explicit = normalizeLoopId(stringValue(handler.loopId));
  if (explicit) return [explicit];
  const rawId = stringValue(handler.id);
  const fromLoops = loopIdsForRawStep(rawId, rawLoops);
  if (fromLoops.length > 0) return [...new Set(fromLoops)];
  const inferred = event ? loopIdFromEvent(event) : "";
  return inferred ? [inferred] : [];
};

const compactActions = (
  input: RawRecord,
  agents: Agent[],
  availableOutputIds: string[]
): { actions: ProjectAction[]; baseActions: Map<string, ProjectAction> } => {
  const rawActions = recordArray(input.actions);
  const rawPolicies = recordArray(input.policies);
  const actionById = new Map<string, ProjectAction>();

  rawActions.forEach((rawAction) => {
    const action = readBaseAction(rawAction, agents, availableOutputIds);
    if (action) actionById.set(action.id, action);
  });

  rawPolicies.forEach((policy) => {
    const actionId = legacyPolicyActionId(policy);
    if (!actionId || actionById.has(actionId)) return;
    const run = isRecord(policy.run) ? policy.run : {};
    const inferredAgentId = normalizeAgentId(stringValue(policy.agent) || stringValue(run.agent), agents);
    const executable = { humanGate: false, agentId: inferredAgentId || undefined };
    actionById.set(actionId, {
      id: actionId,
      description: "",
      outputIds: executableOutputIds(undefined, executable, availableOutputIds),
      ...(inferredAgentId ? { agentId: inferredAgentId } : {})
    });
  });

  return { actions: [...actionById.values()], baseActions: actionById };
};

const legacyPolicyBindings = (rawPolicies: RawRecord[], rawLoops: RawRecord[]): HandlerBinding[] =>
  rawPolicies.flatMap((policy) => {
    const actionId = legacyPolicyActionId(policy);
    const event = legacyPolicyEvent(policy);
    if (!actionId || !event) return [];
    const loopIds = explicitLoopIdForHandler(policy, rawLoops, event);
    return loopIds.map((loopId) => ({
      rawId: stringValue(policy.id),
      loopId,
      actionId,
      event
    }));
  });

const inflatedActionBindings = (rawActions: RawRecord[], rawLoops: RawRecord[]): HandlerBinding[] =>
  rawActions.flatMap((action) => {
    const actionId = rawActionToken(action);
    const event = normalizeLegacyEvent(stringValue(action.event));
    if (!actionId || !event) return [];
    const loopIds = explicitLoopIdForHandler(action, rawLoops, event);
    return loopIds.map((loopId) => ({
      rawId: stringValue(action.id),
      loopId,
      actionId,
      event
    }));
  });

const handlerBindings = (input: RawRecord): HandlerBinding[] => {
  const rawLoops = recordArray(input.loops);
  const bindings = [
    ...legacyPolicyBindings(recordArray(input.policies), rawLoops),
    ...inflatedActionBindings(recordArray(input.actions), rawLoops)
  ];
  const byKey = new Map<string, HandlerBinding>();
  bindings.forEach((binding) => {
    const key = [binding.rawId, binding.loopId, binding.actionId, binding.event].join("\0");
    if (binding.rawId && binding.loopId && binding.actionId && binding.event) byKey.set(key, binding);
  });
  return [...byKey.values()];
};

const normalizeLoop = (
  value: RawRecord,
  rawIdToActionIds: ReadonlyMap<string, string[]>
): ProjectLoop => {
  const seen = new Set<string>();
  const steps = stringArray(value.steps).flatMap((step) => rawIdToActionIds.get(step) ?? [normalizeActionId(step)])
    .filter((step) => {
      if (!step || seen.has(step)) return false;
      seen.add(step);
      return true;
    });
  return {
    id: normalizeLoopId(stringValue(value.id)),
    steps
  };
};

const rawIdActionMap = (bindings: HandlerBinding[], actions: ProjectAction[]): Map<string, string[]> => {
  const actionIds = new Set(actions.map((action) => action.id));
  const map = new Map<string, string[]>();
  bindings.forEach((binding) => {
    if (!binding.rawId || !actionIds.has(binding.actionId)) return;
    map.set(binding.rawId, [...(map.get(binding.rawId) ?? []), binding.actionId]);
  });
  actions.forEach((action) => {
    map.set(action.id, [action.id]);
  });
  return map;
};

const bindingByRawId = (bindings: HandlerBinding[]): Map<string, HandlerBinding[]> => {
  const map = new Map<string, HandlerBinding[]>();
  bindings.forEach((binding) => {
    if (!binding.rawId) return;
    map.set(binding.rawId, [...(map.get(binding.rawId) ?? []), binding]);
  });
  return map;
};

const routeFromEvent = (
  event: string,
  target: Pick<HandlerBinding, "loopId" | "actionId">,
  loops: ProjectLoop[]
): ProjectOutputRoute | undefined => {
  const normalizedEvent = normalizeEvent(event);
  if (!normalizedEvent || normalizedEvent === eventTypeFromLoopId(target.loopId)) return undefined;
  const parts = normalizedEvent.split(".");
  const outputId = normalizeRouteOutputId(parts.at(-1) ?? "");
  if (!outputId || parts.length < 2) return undefined;

  const scopedPrefix = `${target.loopId}.`;
  if (normalizedEvent.startsWith(scopedPrefix)) {
    const sourceActionId = normalizeActionId(parts.slice(target.loopId.split(".").length, -1).join("."));
    if (!sourceActionId) return undefined;
    return {
      sourceLoopId: target.loopId,
      sourceActionId,
      outputId,
      targetLoopId: target.loopId,
      targetActionId: target.actionId
    };
  }

  const sourceActionId = normalizeActionId(parts.slice(0, -1).join("."));
  const sourceLoop = loops.find((loop) => loop.steps.includes(sourceActionId));
  if (!sourceActionId || !sourceLoop) return undefined;
  return {
    sourceLoopId: sourceLoop.id,
    sourceActionId,
    outputId,
    targetLoopId: target.loopId,
    targetActionId: target.actionId
  };
};

const addRoute = (routesByKey: Map<string, ProjectOutputRoute>, route: ProjectOutputRoute | undefined) => {
  if (!route) return;
  if (!route.sourceLoopId || !route.sourceActionId || !route.outputId || !route.targetLoopId || !route.targetActionId) return;
  routesByKey.set(actionOutputRouteKey(route.sourceLoopId, route.sourceActionId, route.outputId), route);
};

const normalizeOutputRoutes = (
  input: RawRecord,
  actions: ProjectAction[],
  loops: ProjectLoop[],
  bindings: HandlerBinding[]
): ProjectOutputRoute[] => {
  const actionsById = new Map(actions.map((action) => [action.id, action]));
  const bindingLookup = bindingByRawId(bindings);
  const routesByKey = new Map<string, ProjectOutputRoute>();

  bindings.forEach((binding) => addRoute(routesByKey, routeFromEvent(binding.event, binding, loops)));

  recordArray(input.outputRoutes).forEach((route) => {
    const target = isRecord(route.target) ? route.target : {};
    const rawSourceId = stringValue(route.sourceActionId) || stringValue(route.sourcePolicyId);
    const rawTargetId = stringValue(route.targetActionId) || stringValue(target.policyId) || stringValue(target.actionId);
    const explicitSourceLoopId = normalizeLoopId(stringValue(route.sourceLoopId));
    const explicitTargetLoopId = normalizeLoopId(stringValue(route.targetLoopId));
    const outputId = normalizeRouteOutputId(stringValue(route.outputId));
    const sourceBindings = bindingLookup.get(rawSourceId) ?? [];
    const targetBindings = bindingLookup.get(rawTargetId) ?? [];
    const sourceActionIds = sourceBindings.length > 0 ? sourceBindings.map((binding) => binding.actionId) : [normalizeActionId(rawSourceId)];
    const targetActionIds = targetBindings.length > 0 ? targetBindings.map((binding) => binding.actionId) : [normalizeActionId(rawTargetId)];

    sourceActionIds.forEach((sourceActionId, index) => {
      const sourceBinding = sourceBindings[index] ?? sourceBindings[0];
      const targetBinding = targetBindings[index] ?? targetBindings[0];
      const sourceLoopId = explicitSourceLoopId || sourceBinding?.loopId || loops.find((loop) => loop.steps.includes(sourceActionId))?.id || "";
      const targetActionId = targetBinding?.actionId ?? targetActionIds[index] ?? targetActionIds[0] ?? "";
      const targetLoopId = explicitTargetLoopId || targetBinding?.loopId || loops.find((loop) => loop.steps.includes(targetActionId))?.id || "";
      if (!actionsById.has(sourceActionId) || !actionsById.has(targetActionId)) return;
      addRoute(routesByKey, {
        sourceLoopId,
        sourceActionId,
        outputId,
        targetLoopId,
        targetActionId
      });
    });
  });

  return [...routesByKey.values()];
};

const normalizeHumanGateResponses = (
  input: RawRecord,
  rawIdToActionIds: ReadonlyMap<string, string[]>,
  bindings: HandlerBinding[]
): ProjectHumanGateResponse[] => {
  const bindingLookup = bindingByRawId(bindings);
  return recordArray(input.humanGateResponses).flatMap((response) => {
    const rawActionId = stringValue(response.actionId) || stringValue(response.policyId);
    const mappedActionId = rawIdToActionIds.get(rawActionId)?.[0] ?? normalizeActionId(rawActionId);
    const responseBinding = bindingLookup.get(rawActionId)?.[0];
    const base = {
      loopId: normalizeLoopId(stringValue(response.loopId)) || responseBinding?.loopId || undefined,
      actionId: mappedActionId,
      outputId: normalizeRouteOutputId(stringValue(response.outputId)),
      prompt: stringValue(response.prompt),
      submittedAt: stringValue(response.submittedAt)
    };
    return base.actionId && base.outputId ? [{ ...base, id: humanGateResponseId(base) }] : [];
  });
};

export const normalizeProjectAutomationConfig = (
  value: unknown,
  agents: Agent[] = []
): ProjectAutomationConfig => {
  if (!isRecord(value)) return defaultProjectAutomationConfig();
  const rawOutputs = recordArray(value.outputs);
  const outputs = canonicalOutputs(rawOutputs);
  const availableOutputIds = outputs.map((output) => output.id);
  const { actions } = compactActions(value, agents, availableOutputIds);
  const bindings = handlerBindings(value);
  const rawIdToActionIds = rawIdActionMap(bindings, actions);
  const loops = recordArray(value.loops).map((loop) => normalizeLoop(loop, rawIdToActionIds));
  return {
    version: 1,
    actions,
    outputs,
    outputRoutes: normalizeOutputRoutes(value, actions, loops, bindings),
    humanGateResponses: normalizeHumanGateResponses(value, rawIdToActionIds, bindings),
    loops,
    runtimes: recordArray(value.runtimes).map(normalizeRuntime)
  };
};
