import type { Agent, ProjectPolicy } from "./domain.js";

export const policyOutputStatuses = ["complete", "cancelled", "blocked", "failed"] as const;
export type PolicyOutputStatus = typeof policyOutputStatuses[number];

export const policyEventVersion = "v1";

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
  status: PolicyOutputStatus
): string => `${input.agent}.${input.action}.${status}.${policyEventVersion}`;

export const policyOutputEventTypes = (input: Pick<ProjectPolicy, "agent" | "action">): string[] =>
  policyOutputStatuses.map((status) => policyOutputEventType(input, status));

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

export const policyEventTypesForAgentsAndActions = (agents: Agent[], actions: string[]): string[] => {
  const normalizedActions = [...new Set(actions.map(normalizePolicyToken).filter(Boolean))];
  return uniqueAgentPolicyTokens(agents).flatMap((agent) =>
    normalizedActions.flatMap((action) => policyOutputEventTypes({ agent, action }))
  );
};

export const resolvePolicyAgent = (agents: Agent[], token: string): Agent | undefined => {
  const normalized = normalizePolicyToken(token);
  return agents.find((agent) => agentTokenCandidates(agent).includes(normalized));
};
