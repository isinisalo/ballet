import type { Agent } from "./domain/agents.js";
import type { ProjectAction, ProjectOutput, ProjectOutputType, ProjectPolicy } from "./domain/automation.js";

export const defaultPolicyOutputIds = ["complete", "blocked", "failed"] as const;
export type PolicyOutputId = string;
export const policyOutputStatuses = defaultPolicyOutputIds;
export type PolicyOutputStatus = typeof defaultPolicyOutputIds[number];

export const defaultProjectOutputs = (): ProjectOutput[] => [
  { id: "complete", description: "Action completed.", type: "event" },
  { id: "blocked", description: "Action is blocked.", type: "event" },
  { id: "failed", description: "Action failed.", type: "event" }
];

export const normalizePolicyToken = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const triggerEventType = (triggerId: string): string => `trigger.${normalizePolicyToken(triggerId)}`;

export const policySourceKey = (input: Pick<ProjectPolicy, "source" | "event" | "trigger">): string =>
  input.source === "trigger" ? triggerEventType(input.trigger ?? "") : (input.event ?? "");

export const generatedPolicyId = (input: Pick<ProjectPolicy, "source" | "event" | "trigger" | "agent" | "action">): string =>
  `on.${input.source === "trigger" ? `trigger.${input.trigger ?? ""}` : input.event ?? ""}.then.${input.agent}.start.${input.action}`;

export const policyOutputEventType = (
  input: Pick<ProjectPolicy, "agent" | "action">,
  outputId: PolicyOutputId
): string => `${input.agent}.${input.action}.${normalizePolicyToken(outputId)}`;

export const normalizeProjectOutputType = (value: unknown): ProjectOutputType =>
  value === "gate" ? "gate" : "event";

const eventOutputIdSet = (outputs: Array<Pick<ProjectOutput, "id" | "type">>): Set<string> =>
  new Set(outputs
    .filter((output) => output.type === "event")
    .map((output) => normalizePolicyToken(output.id))
    .filter(Boolean));

export const actionOutputIds = (
  actions: Array<Pick<ProjectAction, "id" | "outputIds">>,
  actionId: string
): string[] => {
  const normalizedActionId = normalizePolicyToken(actionId);
  const action = actions.find((candidate) => normalizePolicyToken(candidate.id) === normalizedActionId);
  const outputIds = action?.outputIds ?? defaultPolicyOutputIds;
  return [...new Set(outputIds.map(normalizePolicyToken).filter(Boolean))].slice(0, 3);
};

export const policyOutputEventTypes = (
  input: Pick<ProjectPolicy, "agent" | "action">,
  actions: Array<Pick<ProjectAction, "id" | "outputIds">> = [],
  outputs: Array<Pick<ProjectOutput, "id" | "type">> = []
): string[] => {
  const outputIds = actions.length > 0 ? actionOutputIds(actions, input.action) : [...defaultPolicyOutputIds];
  const eventIds = outputs.length > 0 ? eventOutputIdSet(outputs) : undefined;
  return outputIds
    .filter((outputId) => !eventIds || eventIds.has(outputId))
    .map((outputId) => policyOutputEventType(input, outputId));
};

export const normalizePolicyOutputEventType = (value: string): string => {
  return value.replace(/^([a-z0-9_-]+)\.([a-z0-9_-]+)\.([a-z0-9_-]+)\.v1$/, "$1.$2.$3");
};

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

export const policyEventTypesForAgentsAndActions = (
  agents: Agent[],
  actions: Array<Pick<ProjectAction, "id" | "outputIds">>,
  outputs: Array<Pick<ProjectOutput, "id" | "type">> = []
): string[] => {
  const normalizedActions = [...new Map(actions
    .map((action) => ({ ...action, id: normalizePolicyToken(action.id) }))
    .filter((action) => action.id)
    .map((action) => [action.id, action])).values()];
  return uniqueAgentPolicyTokens(agents).flatMap((agent) =>
    normalizedActions.flatMap((action) => policyOutputEventTypes({ agent, action: action.id }, normalizedActions, outputs))
  );
};

export const resolvePolicyAgent = (agents: Agent[], token: string): Agent | undefined => {
  const normalized = normalizePolicyToken(token);
  return agents.find((agent) => agentTokenCandidates(agent).includes(normalized));
};
