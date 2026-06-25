import type { EventDefinition } from "../../backend/shared/domain";
import type { RoutingPolicy } from "../../backend/shared/routing-policy";

export interface WorkflowDraft {
  inputEventType: string;
  targetAgentId: string;
  outputEventType: string;
}

export interface PolicyWorkflow {
  id: string;
  policy: RoutingPolicy;
  inputEventType: string;
  targetAgentId: string;
  outputEventDefinition?: EventDefinition;
  outputEventType?: string;
}

export const eventTypesForWorkflowPolicy = (policy: Partial<RoutingPolicy>): string[] =>
  policy.consumes?.eventType ? [policy.consumes.eventType] : [];

export const targetAgentIdForWorkflowPolicy = (policy: Partial<RoutingPolicy>): string =>
  policy.dispatch?.operation?.id ?? "";

const normalizePolicyNamePart = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");

export const buildPolicyName = (eventType: string, targetAgentId: string): string => {
  const eventName = normalizePolicyNamePart(eventType.replace(/\.v\d+$/i, ""));
  const agentName = normalizePolicyNamePart(targetAgentId).replace(/_agent$/, "");
  return `on_${eventName}_start_${agentName}_operation`;
};

export const findOutputEventDefinition = (
  targetAgentId: string,
  eventDefinitions: EventDefinition[]
): EventDefinition | undefined => {
  void targetAgentId;
  void eventDefinitions;
  return undefined;
};

export const derivePolicyWorkflows = (
  policies: RoutingPolicy[],
  eventDefinitions: EventDefinition[]
): PolicyWorkflow[] =>
  policies.map((policy) => {
    const targetAgentId = targetAgentIdForWorkflowPolicy(policy);
    const outputEventDefinition = findOutputEventDefinition(targetAgentId, eventDefinitions);

    return {
      id: policy.id,
      policy,
      inputEventType: eventTypesForWorkflowPolicy(policy)[0] ?? "",
      targetAgentId,
      outputEventDefinition,
      outputEventType: outputEventDefinition?.eventType
    };
  });

export const applyWorkflowToPolicy = (
  policy: Partial<RoutingPolicy>,
  draft: WorkflowDraft
): Partial<RoutingPolicy> => ({
  ...policy,
  name: buildPolicyName(draft.inputEventType, draft.targetAgentId),
  active: policy.active ?? true,
  consumes: { eventType: draft.inputEventType },
  dispatch: {
    operation: {
      id: draft.targetAgentId,
      version: policy.dispatch?.operation?.version ?? 1
    }
  },
  input: policy.input ?? { object: {} },
  selection: policy.selection ?? { mode: "fanout" },
  onInvalidInput: policy.onInvalidInput ?? "skip"
});

export const mergeReadyProducer = (definition: EventDefinition): EventDefinition => definition;
