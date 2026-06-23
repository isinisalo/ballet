import type { Agent, EventRecord, Policy, RouteResult } from "./domain.js";

const textMatches = (ruleValue: string, actualValue: string): boolean => {
  if (!ruleValue || ruleValue === "*") return true;
  return ruleValue.trim().toLowerCase() === actualValue.trim().toLowerCase();
};

const listMatches = (ruleValues: string[], actualValue: string): boolean => {
  if (ruleValues.length === 0) return true;
  return ruleValues.some((value) => textMatches(value, actualValue));
};

const tagsMatch = (requiredTags: string[], eventTags: string[]): boolean => {
  if (requiredTags.length === 0) return true;
  const normalized = new Set(eventTags.map((tag) => tag.toLowerCase()));
  return requiredTags.every((tag) => normalized.has(tag.toLowerCase()));
};

const payloadValue = (payload: Record<string, unknown>, key: string): unknown => {
  if (Object.prototype.hasOwnProperty.call(payload, key)) return payload[key];
  const metadata = payload.metadata;
  if (metadata && typeof metadata === "object" && Object.prototype.hasOwnProperty.call(metadata, key)) {
    return (metadata as Record<string, unknown>)[key];
  }
  return undefined;
};

const metadataMatches = (metadataRule: Record<string, string>, payload: Record<string, unknown>): boolean => {
  return Object.entries(metadataRule).every(([key, expected]) => {
    const actual = payloadValue(payload, key);
    return actual !== undefined && textMatches(expected, String(actual));
  });
};

export const policyMatchesEvent = (policy: Policy, event: EventRecord): boolean => {
  if (!policy.active) return false;
  if (!textMatches(policy.projectId, event.projectId)) return false;
  if (!listMatches(policy.eventTypes, event.eventType)) return false;
  if (!tagsMatch(policy.tags, event.tags)) return false;
  if (!textMatches(policy.source, event.source)) return false;
  return metadataMatches(policy.payloadMetadata, event.payload);
};

export const routeEvent = (event: EventRecord, policies: Policy[], agents: Agent[]): RouteResult => {
  const matches = policies
    .filter((policy) => policyMatchesEvent(policy, event))
    .sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name));

  const match = matches.find((policy) => agents.some((agent) => agent.id === policy.targetAgentId && agent.enabled));

  if (!match) {
    const inactiveMatch = matches[0];
    return {
      status: "unassigned",
      handlingResult: inactiveMatch
        ? `Policy "${inactiveMatch.name}" matched, but its target agent is disabled or missing.`
        : "No active policy matched project, event type, tags, source, and payload metadata."
    };
  }

  const agent = agents.find((candidate) => candidate.id === match.targetAgentId);
  return {
    status: "routed",
    matchedPolicyId: match.id,
    assignedAgentId: match.targetAgentId,
    handlingResult: `Routed by "${match.name}" to ${agent?.name ?? "selected agent"}.`
  };
};
