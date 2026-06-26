import type { AppData } from "backend/shared/domain";
import type { LoopDefinition } from "backend/shared/loop";
import { eventNameFor, findOperation, operationNameFor, refLabel } from "@/features/advanced/model/advanced-resource-model";

export interface SimpleFlowBoundaryViewModel {
  id: string;
  version: number;
  name: string;
  description: string;
  active: boolean;
  entryEvents: Array<{ eventType: string; name: string }>;
  routingRules: Array<{ id: string; label: string; included: boolean }>;
  emissionRules: Array<{ id: string; version: number; label: string; included: boolean }>;
  terminalEvents: Array<{ eventType: string; name: string }>;
  limitExceededEvent?: { eventType: string; name: string };
  safetyLimits: {
    maxHops: number;
    maxRuns: number;
    maxIterationsPerStep: number;
    deadlineSeconds?: number;
  };
  previewSteps: Array<{
    type: "event" | "routing" | "operation" | "emission";
    label: string;
    depth: number;
  }>;
  health: "ready" | "warning" | "invalid";
  diagnostics: unknown[];
}

export interface SimpleFlowBoundaryDraft {
  name: string;
  description: string;
  active: boolean;
  entryEventTypes: string[];
  routingPolicyIds: string[];
  emissionPolicyIds: string[];
  terminalEventTypes: string[];
  limitExceededEventType?: string;
  limits: LoopDefinition["limits"];
}

export const deriveReachableRulesFromEntryEvent = (
  data: AppData,
  entryEventType: string
): { routingPolicyIds: string[]; emissionPolicyIds: string[] } => {
  const routingPolicyIds: string[] = [];
  const emissionPolicyIds: string[] = [];
  const visitedEvents = new Set<string>();
  const visitedOperations = new Set<string>();
  const queue = [entryEventType];

  while (queue.length) {
    const eventType = queue.shift()!;
    if (visitedEvents.has(eventType)) continue;
    visitedEvents.add(eventType);
    for (const policy of data.policies.filter((candidate) => candidate.consumes.eventType === eventType)) {
      if (!routingPolicyIds.includes(policy.id)) routingPolicyIds.push(policy.id);
      const operationKey = `${policy.dispatch.operation.id}@${policy.dispatch.operation.version}`;
      if (visitedOperations.has(operationKey)) continue;
      visitedOperations.add(operationKey);
      for (const emission of data.emissionPolicies.filter((candidate) =>
        candidate.observes.operation.id === policy.dispatch.operation.id &&
        candidate.observes.operation.version === policy.dispatch.operation.version
      )) {
        if (!emissionPolicyIds.includes(emission.id)) emissionPolicyIds.push(emission.id);
        for (const emitted of emission.emissions) {
          if (!visitedEvents.has(emitted.eventType)) queue.push(emitted.eventType);
        }
      }
    }
  }

  return { routingPolicyIds, emissionPolicyIds };
};

export const suggestTerminalEvents = (data: AppData, routingPolicyIds: string[], emissionPolicyIds: string[]): string[] => {
  const outgoingEvents = new Set(data.policies.filter((policy) => routingPolicyIds.includes(policy.id)).map((policy) => policy.consumes.eventType));
  const emittedEvents = data.emissionPolicies
    .filter((policy) => emissionPolicyIds.includes(policy.id))
    .flatMap((policy) => policy.emissions.map((emission) => emission.eventType));
  return [...new Set(emittedEvents.filter((eventType) => {
    const name = eventNameFor(data, eventType).toLowerCase();
    return !outgoingEvents.has(eventType) || /completed|aborted|failed|approved/.test(`${eventType} ${name}`);
  }))];
};

const previewSteps = (loop: LoopDefinition, data: AppData): SimpleFlowBoundaryViewModel["previewSteps"] => {
  const steps: SimpleFlowBoundaryViewModel["previewSteps"] = [];
  const visited = new Set<string>();
  const walkEvent = (eventType: string, depth: number) => {
    const eventKey = `${eventType}:${depth}`;
    if (visited.has(eventKey) || depth > 8) return;
    visited.add(eventKey);
    steps.push({ type: "event", label: eventNameFor(data, eventType), depth });
    for (const route of data.policies.filter((policy) => loop.routingPolicyIds.includes(policy.id) && policy.consumes.eventType === eventType)) {
      const operation = findOperation(data, route.dispatch.operation);
      steps.push({ type: "routing", label: `${eventNameFor(data, eventType)} -> ${operation?.name ?? refLabel(route.dispatch.operation)}`, depth: depth + 1 });
      steps.push({ type: "operation", label: operation?.name ?? refLabel(route.dispatch.operation), depth: depth + 1 });
      for (const emission of data.emissionPolicies.filter((policy) =>
        loop.emissionPolicyIds.includes(policy.id) &&
        policy.observes.operation.id === route.dispatch.operation.id &&
        policy.observes.operation.version === route.dispatch.operation.version
      )) {
        for (const emitted of emission.emissions) {
          steps.push({ type: "emission", label: `${operation?.name ?? refLabel(route.dispatch.operation)} -> ${eventNameFor(data, emitted.eventType)}`, depth: depth + 2 });
          if (!loop.terminalEventTypes.includes(emitted.eventType)) walkEvent(emitted.eventType, depth + 2);
          else steps.push({ type: "event", label: eventNameFor(data, emitted.eventType), depth: depth + 2 });
        }
      }
    }
  };
  loop.entryEventTypes.forEach((eventType) => walkEvent(eventType, 0));
  return steps;
};

export const summarizeFlowBoundary = (loop: LoopDefinition, data: AppData): string =>
  `${loop.entryEventTypes.map((eventType) => eventNameFor(data, eventType)).join(", ")} to ${loop.terminalEventTypes.map((eventType) => eventNameFor(data, eventType)).join(", ")}`;

export const simpleFlowBoundaryFromLoop = (
  loop: LoopDefinition,
  data: AppData,
  diagnostics: unknown[] = []
): SimpleFlowBoundaryViewModel => ({
  id: loop.id,
  version: loop.version,
  name: loop.name,
  description: loop.description,
  active: loop.active,
  entryEvents: loop.entryEventTypes.map((eventType) => ({ eventType, name: eventNameFor(data, eventType) })),
  routingRules: data.policies.map((policy) => ({
    id: policy.id,
    label: `${eventNameFor(data, policy.consumes.eventType)} -> ${operationNameFor(data, policy.dispatch.operation)}`,
    included: loop.routingPolicyIds.includes(policy.id)
  })),
  emissionRules: data.emissionPolicies.map((policy) => ({
    id: policy.id,
    version: policy.version,
    label: `${operationNameFor(data, policy.observes.operation)} -> ${policy.emissions.map((emission) => eventNameFor(data, emission.eventType)).join(", ")}`,
    included: loop.emissionPolicyIds.includes(policy.id)
  })),
  terminalEvents: loop.terminalEventTypes.map((eventType) => ({ eventType, name: eventNameFor(data, eventType) })),
  limitExceededEvent: loop.onLimitExceeded?.eventType ? { eventType: loop.onLimitExceeded.eventType, name: eventNameFor(data, loop.onLimitExceeded.eventType) } : undefined,
  safetyLimits: loop.limits,
  previewSteps: previewSteps(loop, data),
  health: diagnostics.length ? "invalid" : "ready",
  diagnostics
});

export const loopDefinitionFromSimpleBoundaryDraft = (
  loop: LoopDefinition,
  draft: SimpleFlowBoundaryDraft
): LoopDefinition => ({
  ...loop,
  name: draft.name.trim() || loop.name,
  description: draft.description,
  active: draft.active,
  entryEventTypes: draft.entryEventTypes,
  routingPolicyIds: draft.routingPolicyIds,
  emissionPolicyIds: draft.emissionPolicyIds,
  terminalEventTypes: draft.terminalEventTypes,
  limits: draft.limits,
  onLimitExceeded: draft.limitExceededEventType ? { eventType: draft.limitExceededEventType } : undefined,
  updatedAt: new Date().toISOString()
});
