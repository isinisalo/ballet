import type {
  Agent,
  EventRecord,
  Policy,
  PolicyPredicate,
  PolicyPredicateScalar,
  RouteDecision
} from "./domain.js";

const textMatches = (ruleValue: string, actualValue: string): boolean => {
  if (!ruleValue || ruleValue === "*") return true;
  return ruleValue.trim().toLowerCase() === actualValue.trim().toLowerCase();
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isPolicyPredicate = (value: unknown): value is PolicyPredicate =>
  isRecord(value) &&
  typeof value.operator === "string" &&
  ["equals", "in", "exists"].includes(value.operator);

const stableJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
};

const hashStringToVersion = (value: string): number => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

export const policyVersion = (policy: Policy): number =>
  hashStringToVersion(stableJson({
    active: policy.active,
    match: policy.match,
    action: policy.action,
    projectId: policy.projectId,
    eventTypes: policy.eventTypes,
    source: policy.source,
    payloadMetadata: policy.payloadMetadata,
    targetAgentId: policy.targetAgentId
  }));

export const policyTargetAgentId = (policy: Policy): string =>
  policy.action?.type === "start_agent_run" && policy.action.targetAgentId
    ? policy.action.targetAgentId
    : policy.targetAgentId;

const scalarEquals = (expected: PolicyPredicateScalar, actual: unknown): boolean => {
  if (actual === undefined) return false;
  if (typeof expected === "string") return textMatches(expected, String(actual));
  return actual === expected;
};

const scalarArray = (value: PolicyPredicate["value"]): PolicyPredicateScalar[] =>
  Array.isArray(value) ? value : value === undefined ? [] : [value];

const predicateMatches = (predicate: PolicyPredicate, actual: unknown): boolean => {
  if (predicate.operator === "exists") {
    const expected = typeof predicate.value === "boolean" ? predicate.value : true;
    return expected ? actual !== undefined : actual === undefined;
  }

  if (Array.isArray(actual)) {
    if (predicate.operator === "equals") {
      return scalarArray(predicate.value).some((expected) => actual.some((item) => scalarEquals(expected, item)));
    }
    return scalarArray(predicate.value).some((expected) => actual.some((item) => scalarEquals(expected, item)));
  }

  if (predicate.operator === "equals") {
    return scalarArray(predicate.value).some((expected) => scalarEquals(expected, actual));
  }

  return scalarArray(predicate.value).some((expected) => scalarEquals(expected, actual));
};

const fieldMatches = (rule: string | PolicyPredicate | undefined, actualValue: string | undefined): boolean => {
  if (rule === undefined) return true;
  if (typeof rule === "string") return textMatches(rule, actualValue ?? "");
  return predicateMatches(rule, actualValue);
};

const eventTypeMatches = (policy: Policy, event: EventRecord): boolean => {
  const eventTypes = policy.match?.eventTypes ?? policy.eventTypes;
  if (eventTypes.length === 0) return true;
  return eventTypes.some((value) => textMatches(value, event.eventType));
};

const tagsMatch = (rule: string[] | PolicyPredicate | undefined, tags: string[]): boolean => {
  if (rule === undefined) return true;
  if (isPolicyPredicate(rule)) return predicateMatches(rule, tags);
  return rule.every((expected) => tags.some((tag) => textMatches(expected, tag)));
};

const pathValue = (record: Record<string, unknown>, path: string): unknown => {
  if (Object.prototype.hasOwnProperty.call(record, path)) return record[path];
  return path.split(".").reduce<unknown>((current, segment) => {
    if (!isRecord(current) || !Object.prototype.hasOwnProperty.call(current, segment)) return undefined;
    return current[segment];
  }, record);
};

const payloadValue = (payload: Record<string, unknown>, key: string): unknown => {
  const direct = pathValue(payload, key);
  if (direct !== undefined) return direct;
  const metadata = payload.metadata;
  if (isRecord(metadata) && Object.prototype.hasOwnProperty.call(metadata, key)) return metadata[key];
  return undefined;
};

const normalizePayloadPredicate = (
  value: PolicyPredicate | PolicyPredicateScalar | PolicyPredicateScalar[]
): PolicyPredicate => {
  if (isPolicyPredicate(value)) return value;
  if (Array.isArray(value)) return { operator: "in", value };
  return { operator: "equals", value };
};

const payloadMatches = (policy: Policy, payload: Record<string, unknown>): boolean => {
  const legacyMetadataMatches = Object.entries(policy.payloadMetadata).every(([key, expected]) => {
    const actual = payloadValue(payload, key);
    return actual !== undefined && textMatches(expected, String(actual));
  });
  if (!legacyMetadataMatches) return false;

  return Object.entries(policy.match?.payload ?? {}).every(([key, rule]) =>
    predicateMatches(normalizePayloadPredicate(rule), payloadValue(payload, key))
  );
};

export const policyMatchesEvent = (policy: Policy, event: EventRecord): boolean => {
  if (!policy.active) return false;
  if (!eventTypeMatches(policy, event)) return false;
  if (!fieldMatches(policy.match?.projectId ?? policy.projectId, event.projectId)) return false;
  if (!fieldMatches(policy.match?.source ?? policy.source, event.source)) return false;
  if (!fieldMatches(policy.match?.subject, event.subject)) return false;
  if (!tagsMatch(policy.match?.tags, event.tags)) return false;
  return payloadMatches(policy, event.payload);
};

export const routeEvent = (event: EventRecord, policies: Policy[], agents: Agent[]): RouteDecision[] =>
  policies
    .filter((policy) => policyMatchesEvent(policy, event))
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
    .map((policy) => {
      const targetAgentId = policyTargetAgentId(policy);
      const agent = agents.find((candidate) => candidate.id === targetAgentId);
      if (!agent?.enabled) {
        return {
          policyId: policy.id,
          policyName: policy.name,
          policyVersion: policyVersion(policy),
          targetAgentId,
          status: "skipped",
          reason: `Policy "${policy.name}" matched, but its target agent is disabled or missing.`
        };
      }

      return {
        policyId: policy.id,
        policyName: policy.name,
        policyVersion: policyVersion(policy),
        targetAgentId,
        status: "routed",
        reason: `Routed by "${policy.name}" to ${agent.name}.`
      };
    });
