import type { Agent } from "../../shared/domain/agents.js";
import type {
  ProjectAction,
  ProjectAutomationConfig,
  ProjectOutput,
  ProjectPolicy,
  ProjectTrigger,
  ProjectWorkflow
} from "../../shared/domain/automation.js";
import { defaultProjectAutomationConfig } from "../../shared/domain/automation.js";
import type { ProjectRuntime } from "../../shared/domain/runtime.js";
import {
  defaultPolicyOutputIds,
  defaultProjectOutputs,
  generatedPolicyId,
  normalizeProjectOutputType,
  normalizePolicyOutputEventType,
  normalizePolicyToken,
  policyActionTokens,
  policyOutputEventType,
  resolvePolicyAgent
} from "../../shared/policy-actions.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const stringValue = (value: unknown): string =>
  typeof value === "string" ? value : "";

const stringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const recordArray = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter(isRecord) : [];

const normalizeAgentPolicyToken = (value: string): string =>
  normalizePolicyToken(value).replace(/-agent$/, "");

const normalizeAgentId = (value: string, agents: Agent[]): string => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return agents.find((agent) => agent.id === trimmed)?.id ?? resolvePolicyAgent(agents, trimmed)?.id ?? trimmed;
};

const normalizeTrigger = (value: Record<string, unknown>): ProjectTrigger => ({
  id: normalizePolicyToken(stringValue(value.id)),
  description: stringValue(value.description)
});

const normalizeOutput = (value: Record<string, unknown>): ProjectOutput => ({
  id: normalizePolicyToken(stringValue(value.id)),
  description: stringValue(value.description),
  type: normalizeProjectOutputType(value.type)
});

const normalizeOutputIds = (value: unknown): string[] | undefined => {
  const rawOutputIds = Array.isArray(value) ? stringArray(value).map(normalizePolicyToken).filter(Boolean) : undefined;
  if (!rawOutputIds) return undefined;
  return [...new Set(rawOutputIds)];
};

const fallbackActionOutputIds = (availableOutputIds: string[]) => {
  const fallbackOutputIds = defaultPolicyOutputIds.filter((id) => availableOutputIds.includes(id));
  return fallbackOutputIds.length > 0 ? fallbackOutputIds : availableOutputIds.slice(0, 3);
};

const normalizeActionBase = (value: Record<string, unknown>, availableOutputIds: string[]) => ({
  id: normalizePolicyToken(stringValue(value.id)),
  description: stringValue(value.description),
  outputIds: normalizeOutputIds(value.outputIds) ?? fallbackActionOutputIds(availableOutputIds)
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
  const trigger = normalizePolicyToken(stringValue(value.trigger));
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

const createActions = (
  rawActions: Record<string, unknown>[],
  legacyPolicies: LegacyPolicy[],
  availableOutputIds: string[],
  agents: Agent[]
): { actions: ProjectAction[]; rewrite: ActionRewrite } => {
  const actionAgentTokens = new Map<string, Set<string>>();
  legacyPolicies.forEach((policy) => {
    if (!policy.action || !policy.agentToken) return;
    actionAgentTokens.set(policy.action, actionAgentTokens.get(policy.action) ?? new Set<string>());
    actionAgentTokens.get(policy.action)?.add(policy.agentToken);
  });

  const actionBases = rawActions.length > 0
    ? rawActions.map((action) => {
      const rawAgentIds = normalizeRawAgentIds(action.agentIds, agents);
      const base = normalizeActionBase(action, availableOutputIds);
      return {
        base: rawAgentIds?.length === 0 && !Array.isArray(action.outputIds)
          ? { ...base, outputIds: [] }
          : base,
        rawAgentIds
      };
    })
    : policyActionTokens(legacyPolicies).map((id) => ({
      base: { id, description: "", outputIds: fallbackActionOutputIds(availableOutputIds) },
      rawAgentIds: undefined
    }));

  const rewrite: ActionRewrite = {
    actionIdByLegacyAgent: new Map(),
    eventIdByLegacyEvent: new Map()
  };
  const actions: ProjectAction[] = [];
  const usedActionIds = new Set<string>();

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

  const registerLegacyEventRewrites = (legacyActionId: string, legacyAgentToken: string, action: ProjectAction) => {
    const legacyEventPrefix = `${legacyAgentToken}.${legacyActionId}.`;
    action.outputIds.forEach((outputId) => {
      rewrite.eventIdByLegacyEvent.set(
        normalizePolicyOutputEventType(`${legacyEventPrefix}${outputId}`),
        policyOutputEventType({ action: action.id }, outputId)
      );
    });
  };

  actionBases.forEach(({ base, rawAgentIds }) => {
    const legacyAgentTokens = [...(actionAgentTokens.get(base.id) ?? new Set<string>())];
    if (rawAgentIds) {
      const action = { ...base, id: uniqueActionId(base.id), agentIds: rawAgentIds };
      actions.push(action);
      legacyAgentTokens.forEach((agentToken) => {
        rewrite.actionIdByLegacyAgent.set(`${base.id}:${agentToken}`, action.id);
        registerLegacyEventRewrites(base.id, agentToken, action);
      });
      return;
    }

    const inferredAgentIds = legacyAgentTokens.map((agentToken) => normalizeAgentId(agentToken, agents)).filter(Boolean);
    if (legacyAgentTokens.length <= 1) {
      const action = {
        ...base,
        id: uniqueActionId(base.id),
        agentIds: [...new Set(inferredAgentIds)]
      };
      actions.push(action);
      legacyAgentTokens.forEach((agentToken) => {
        rewrite.actionIdByLegacyAgent.set(`${base.id}:${agentToken}`, action.id);
        registerLegacyEventRewrites(base.id, agentToken, action);
      });
      return;
    }

    legacyAgentTokens.forEach((agentToken) => {
      const action = {
        ...base,
        id: uniqueActionId(`${base.id}-${agentToken}`),
        agentIds: [normalizeAgentId(agentToken, agents)].filter(Boolean)
      };
      actions.push(action);
      rewrite.actionIdByLegacyAgent.set(`${base.id}:${agentToken}`, action.id);
      registerLegacyEventRewrites(base.id, agentToken, action);
    });
  });

  return { actions, rewrite };
};

const normalizeEvent = (event: string | undefined, rewrite: ActionRewrite): string | undefined => {
  if (!event) return event;
  const normalized = normalizePolicyOutputEventType(event);
  return rewrite.eventIdByLegacyEvent.get(normalized) ?? normalized;
};

const normalizePolicy = (value: LegacyPolicy, rewrite: ActionRewrite): ProjectPolicy => {
  const action = rewrite.actionIdByLegacyAgent.get(`${value.action}:${value.agentToken}`) ?? value.action;
  const normalized = {
    source: value.source,
    event: value.source === "event" ? normalizeEvent(value.event, rewrite) : undefined,
    trigger: value.source === "trigger" ? value.trigger : undefined,
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

const normalizeWorkflow = (value: Record<string, unknown>, policyIdMap: Map<string, string>): ProjectWorkflow => ({
  id: stringValue(value.id),
  title: stringValue(value.title),
  steps: stringArray(value.steps).map((step) => policyIdMap.get(step) ?? step)
});

export const normalizeProjectAutomationConfig = (value: unknown, agents: Agent[] = []): ProjectAutomationConfig => {
  if (!isRecord(value)) return defaultProjectAutomationConfig();
  const rawPolicies = recordArray(value.policies);
  const legacyPolicies = rawPolicies.map(readLegacyPolicy);

  const outputs = Array.isArray(value.outputs) && recordArray(value.outputs).length > 0
    ? recordArray(value.outputs).map(normalizeOutput)
    : defaultProjectOutputs();
  const availableOutputIds = outputs.map((output) => output.id).filter(Boolean);
  const { actions, rewrite } = createActions(
    Array.isArray(value.actions) ? recordArray(value.actions) : [],
    legacyPolicies,
    availableOutputIds,
    agents
  );

  const policyPairs = legacyPolicies.map((policy) => ({
    rawId: policy.rawId,
    normalized: normalizePolicy(policy, rewrite)
  }));
  const policyIdMap = new Map(policyPairs
    .filter((pair) => pair.rawId && pair.rawId !== pair.normalized.id)
    .map((pair) => [pair.rawId, pair.normalized.id]));

  return {
    version: 1,
    triggers: recordArray(value.triggers).map(normalizeTrigger),
    actions,
    outputs,
    policies: policyPairs.map((pair) => pair.normalized),
    workflows: recordArray(value.workflows).map((workflow) => normalizeWorkflow(workflow, policyIdMap)),
    runtimes: recordArray(value.runtimes).map(normalizeRuntime)
  };
};
