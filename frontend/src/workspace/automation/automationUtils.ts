import type { Agent, ProjectAutomationConfig, ProjectPolicy } from "../../../../shared/domain";
import { agentTokenCandidates, generatedPolicyId, normalizePolicyToken, preferredAgentToken } from "../../../../shared/policy-actions";

export const automationConfigTemplate = (): ProjectAutomationConfig => ({
  version: 1,
  triggers: [],
  actions: [],
  policies: [],
  workflows: [],
  runtimes: []
});

const slugValue = (value: string, fallback: string) =>
  value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || fallback;

export const editablePolicyToken = (value: string): string =>
  value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+/, "");

export const uniqueAutomationId = (base: string, ids: string[]) => {
  let candidate = slugValue(base, "item");
  let suffix = 2;
  while (ids.includes(candidate)) {
    candidate = `${slugValue(base, "item")}-${suffix}`;
    suffix += 1;
  }
  return candidate;
};

export const automationAgentOptions = (agents: Agent[]) => {
  const used = new Set<string>();
  return agents.map((agent) => {
    const token = agentTokenCandidates(agent).find((candidate) => !used.has(candidate)) ?? preferredAgentToken(agent);
    used.add(token);
    return { value: token, label: agent.name };
  });
};

export const uniquePolicyAction = (event: string, agent: string, baseAction: string, policies: ProjectPolicy[]) => {
  const base = normalizePolicyToken(baseAction) || "action";
  let action = base;
  let suffix = 2;
  while (policies.some((policy) => policy.id === generatedPolicyId({ source: "event", event, agent, action }))) {
    action = `${base}-${suffix}`;
    suffix += 1;
  }
  return action;
};
