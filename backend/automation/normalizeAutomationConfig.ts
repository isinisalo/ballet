import type {
  ProjectAction,
  ProjectAutomationConfig,
  ProjectPolicy,
  ProjectTrigger,
  ProjectWorkflow
} from "../../shared/domain/automation.js";
import { defaultProjectAutomationConfig } from "../../shared/domain/automation.js";
import type { ProjectRuntime } from "../../shared/domain/runtime.js";
import {
  generatedPolicyId,
  normalizePolicyOutputEventType,
  normalizePolicyToken,
  policyActionTokens
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

const normalizeTrigger = (value: Record<string, unknown>): ProjectTrigger => ({
  id: normalizePolicyToken(stringValue(value.id)),
  description: stringValue(value.description)
});

const normalizeAction = (value: Record<string, unknown>): ProjectAction => ({
  id: normalizePolicyToken(stringValue(value.id)),
  description: stringValue(value.description)
});

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

const normalizePolicy = (value: Record<string, unknown>): ProjectPolicy => {
  const run = isRecord(value.run) ? value.run : {};
  const event = normalizePolicyOutputEventType(stringValue(value.event) || stringValue(value.on));
  const trigger = normalizePolicyToken(stringValue(value.trigger));
  const source: ProjectPolicy["source"] = stringValue(value.source) === "trigger" || trigger ? "trigger" : "event";
  const agent = normalizeAgentPolicyToken(stringValue(value.agent) || stringValue(run.agent));
  const action = normalizePolicyToken(stringValue(value.action) || inferLegacyPolicyAction(value));
  const normalized = {
    id: "",
    source,
    event: source === "event" ? event : undefined,
    trigger: source === "trigger" ? trigger : undefined,
    agent,
    action,
    enabled: typeof value.enabled === "boolean" ? value.enabled : false
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

export const normalizeProjectAutomationConfig = (value: unknown): ProjectAutomationConfig => {
  if (!isRecord(value)) return defaultProjectAutomationConfig();
  const rawPolicies = recordArray(value.policies);
  const policyPairs = rawPolicies.map((policy) => ({
    rawId: stringValue(policy.id),
    normalized: normalizePolicy(policy)
  }));
  const policyIdMap = new Map(policyPairs
    .filter((pair) => pair.rawId && pair.rawId !== pair.normalized.id)
    .map((pair) => [pair.rawId, pair.normalized.id]));

  const policies = policyPairs.map((pair) => pair.normalized);
  const actions = Array.isArray(value.actions)
    ? recordArray(value.actions).map(normalizeAction)
    : policyActionTokens(policies).map((id) => ({ id, description: "" }));

  return {
    version: 1,
    triggers: recordArray(value.triggers).map(normalizeTrigger),
    actions,
    policies,
    workflows: recordArray(value.workflows).map((workflow) => normalizeWorkflow(workflow, policyIdMap)),
    runtimes: recordArray(value.runtimes).map(normalizeRuntime)
  };
};
