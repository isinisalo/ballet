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

export const generatedPolicyId = (input: Pick<ProjectPolicy, "event" | "agent" | "action">): string =>
  `on.${input.event}.then.${input.agent}.start.${input.action}`;

export const policyOutputEventType = (
  input: Pick<ProjectPolicy, "agent" | "action">,
  status: PolicyOutputStatus
): string => `${input.agent}.${input.action}.${status}.${policyEventVersion}`;

export const policyOutputEventTypes = (input: Pick<ProjectPolicy, "agent" | "action">): string[] =>
  policyOutputStatuses.map((status) => policyOutputEventType(input, status));

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

export const resolvePolicyAgent = (agents: Agent[], token: string): Agent | undefined => {
  const normalized = normalizePolicyToken(token);
  return agents.find((agent) => agentTokenCandidates(agent).includes(normalized));
};
