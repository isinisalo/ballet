import type { AgentOutcomeStatus, EventDefinition, Policy } from "../../backend/shared/domain";

export const workflowOutputOutcome = "ready" satisfies AgentOutcomeStatus;

export interface WorkflowDraft {
  inputEventType: string;
  targetAgentId: string;
  outputEventType: string;
}

export interface PolicyWorkflow {
  id: string;
  policy: Policy;
  inputEventType: string;
  targetAgentId: string;
  outputEventDefinition?: EventDefinition;
  outputEventType?: string;
}

export const eventTypesForWorkflowPolicy = (policy: Pick<Policy, "match" | "eventTypes">): string[] =>
  policy.match?.eventTypes ?? policy.eventTypes ?? [];

export const targetAgentIdForWorkflowPolicy = (policy: Pick<Policy, "action" | "targetAgentId">): string =>
  policy.action?.type === "start_agent_run" && policy.action.targetAgentId
    ? policy.action.targetAgentId
    : policy.targetAgentId;

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
  return `on_${eventName}_start_${agentName}_agent`;
};

const producerHasNoRequirements = (producer: EventDefinition["producers"][number]): boolean =>
  !producer.requires || Object.keys(producer.requires).length === 0;

export const findOutputEventDefinition = (
  targetAgentId: string,
  eventDefinitions: EventDefinition[],
  outcome: AgentOutcomeStatus = workflowOutputOutcome
): EventDefinition | undefined =>
  eventDefinitions.find((definition) =>
    definition.active &&
    definition.producers.some((producer) =>
      producer.agentRole === targetAgentId &&
      producer.outcomes.includes(outcome)
    )
  );

export const derivePolicyWorkflows = (
  policies: Policy[],
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
  policy: Partial<Policy>,
  draft: WorkflowDraft
): Partial<Policy> => {
  const match = {
    ...(policy.match ?? {}),
    eventTypes: [draft.inputEventType],
    projectId: policy.match?.projectId ?? policy.projectId ?? "*",
    source: policy.match?.source ?? policy.source ?? "*"
  };

  return {
    ...policy,
    name: buildPolicyName(draft.inputEventType, draft.targetAgentId),
    active: policy.active ?? true,
    match,
    action: {
      type: "start_agent_run",
      targetAgentId: draft.targetAgentId
    },
    targetAgentId: draft.targetAgentId,
    eventTypes: [draft.inputEventType],
    projectId: typeof match.projectId === "string" ? match.projectId : policy.projectId ?? "*",
    source: typeof match.source === "string" ? match.source : policy.source ?? "*",
    payloadMetadata: policy.payloadMetadata ?? {}
  };
};

export const mergeReadyProducer = (
  definition: EventDefinition,
  agentRole: string
): EventDefinition => {
  const producers = definition.producers.map((producer) => ({
    ...producer,
    outcomes: [...producer.outcomes]
  }));
  const existingIndex = producers.findIndex((producer) =>
    producer.agentRole === agentRole &&
    producerHasNoRequirements(producer)
  );

  if (existingIndex >= 0) {
    const existing = producers[existingIndex];
    if (!existing.outcomes.includes(workflowOutputOutcome)) {
      existing.outcomes = [...existing.outcomes, workflowOutputOutcome];
    }
    return { ...definition, producers };
  }

  return {
    ...definition,
    producers: [
      ...producers,
      {
        agentRole,
        outcomes: [workflowOutputOutcome]
      }
    ]
  };
};
