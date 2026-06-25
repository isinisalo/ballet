import type { Agent, EventRecord } from "./shared/domain.js";
import type { AgentOperation } from "./shared/operations.js";
import type { RoutingPolicy } from "./shared/routing-policy.js";
import type { ContractRegistry } from "./shared/contracts.js";
import type { JsonValue } from "./shared/json.js";
import { hashStableJson, stableJson } from "./shared/json.js";
import { evaluateCondition, type ConditionTrace } from "./shared/conditions.js";
import { evaluateMapping } from "./shared/mapping.js";

export type RoutingDecisionStatus =
  | "matched"
  | "routed"
  | "skipped"
  | "condition_not_matched"
  | "invalid_input"
  | "configuration_error"
  | "exclusive_conflict";

export interface OperationRoutingDecision {
  policyId: string;
  policyName: string;
  policyVersion: number;
  policyHash: string;
  operationId?: string;
  operationVersion?: number;
  agentId?: string;
  input?: JsonValue;
  inputContractId?: string;
  inputContractVersion?: number;
  inputContractHash?: string;
  status: RoutingDecisionStatus;
  runId?: string;
  reason: string;
  conditionTrace?: ConditionTrace;
  validationErrors?: unknown[];
}

export interface RoutingEngineInput {
  event: EventRecord;
  policies: RoutingPolicy[];
  operations: AgentOperation[];
  agents: Agent[];
  contracts: ContractRegistry;
}

export class RoutingEngineError extends Error {
  constructor(message: string, readonly decisions: OperationRoutingDecision[]) {
    super(message);
    this.name = "RoutingEngineError";
  }
}

export const routingPolicyVersion = (policy: RoutingPolicy): number =>
  Number(BigInt(`0x${hashStableJson(policy).slice(0, 8)}`));

export const routingPolicyHash = (policy: RoutingPolicy): string => hashStableJson({
  id: policy.id,
  active: policy.active,
  consumes: policy.consumes,
  when: policy.when,
  dispatch: policy.dispatch,
  input: policy.input,
  priority: policy.priority,
  selection: policy.selection,
  onInvalidInput: policy.onInvalidInput
});

const eventContext = (event: EventRecord): Record<string, unknown> => ({
  event: {
    id: event.eventId ?? event.id,
    type: event.eventType,
    source: event.source,
    subject: event.subject,
    projectId: event.projectId,
    tags: event.tags,
    data: event.data ?? event.payload
  }
});

const comparePolicyOrder = (left: RoutingPolicy, right: RoutingPolicy): number =>
  (left.priority ?? 0) - (right.priority ?? 0) || left.id.localeCompare(right.id);

const findOperation = (operations: AgentOperation[], policy: RoutingPolicy): AgentOperation | undefined =>
  operations.find((operation) =>
    operation.active &&
    operation.id === policy.dispatch.operation.id &&
    operation.version === policy.dispatch.operation.version
  );

export const routeEventToOperations = ({
  event,
  policies,
  operations,
  agents,
  contracts
}: RoutingEngineInput): OperationRoutingDecision[] => {
  const context = eventContext(event);
  const decisions: OperationRoutingDecision[] = [];
  const relevantPolicies = policies
    .filter((policy) => policy.active && policy.consumes.eventType === event.eventType)
    .sort(comparePolicyOrder);

  for (const policy of relevantPolicies) {
    const base = {
      policyId: policy.id,
      policyName: policy.name,
      policyVersion: routingPolicyVersion(policy),
      policyHash: routingPolicyHash(policy),
      operationId: policy.dispatch.operation.id,
      operationVersion: policy.dispatch.operation.version
    };

    const condition = evaluateCondition(policy.when, context);
    if (!condition.matched) {
      decisions.push({
        ...base,
        status: "condition_not_matched",
        reason: "Routing condition did not match.",
        conditionTrace: condition.trace
      });
      continue;
    }

    const operation = findOperation(operations, policy);
    if (!operation) {
      decisions.push({
        ...base,
        status: "configuration_error",
        reason: `Active operation ${policy.dispatch.operation.id}@${policy.dispatch.operation.version} was not found.`,
        conditionTrace: condition.trace
      });
      continue;
    }

    const agent = agents.find((candidate) => candidate.id === operation.agentId);
    if (!agent?.enabled) {
      decisions.push({
        ...base,
        agentId: operation.agentId,
        status: "skipped",
        reason: `Operation ${operation.id}@${operation.version} matched, but agent ${operation.agentId} is disabled or missing.`,
        conditionTrace: condition.trace
      });
      continue;
    }

    try {
      const input = evaluateMapping(policy.input, context, { policyId: policy.id }, "routing.input");
      const validation = contracts.validate(operation.inputContract, input, "agent-input");
      if (!validation.valid) {
        decisions.push({
          ...base,
          agentId: operation.agentId,
          input,
          inputContractId: validation.contractId,
          inputContractVersion: validation.contractVersion,
          inputContractHash: validation.contractHash,
          status: "invalid_input",
          reason: "Mapped operation input failed input contract validation.",
          conditionTrace: condition.trace,
          validationErrors: validation.errors
        });
        continue;
      }

      decisions.push({
        ...base,
        agentId: operation.agentId,
        input,
        inputContractId: validation.contractId,
        inputContractVersion: validation.contractVersion,
        inputContractHash: validation.contractHash,
        status: "routed",
        reason: `Routed by "${policy.name}" to operation ${operation.id}@${operation.version}.`,
        conditionTrace: condition.trace
      });
    } catch (error) {
      decisions.push({
        ...base,
        agentId: operation.agentId,
        status: "invalid_input",
        reason: error instanceof Error ? error.message : String(error),
        conditionTrace: condition.trace
      });
    }
  }

  const routed = decisions.filter((decision) => decision.status === "routed");
  const exclusiveGroups = new Map<string, OperationRoutingDecision[]>();
  for (const decision of routed) {
    const policy = policies.find((candidate) => candidate.id === decision.policyId);
    if (policy?.selection?.mode !== "exclusive") continue;
    const group = policy.selection.group ?? policy.consumes.eventType;
    exclusiveGroups.set(group, [...(exclusiveGroups.get(group) ?? []), decision]);
  }
  for (const [group, groupDecisions] of exclusiveGroups) {
    if (groupDecisions.length <= 1) continue;
    for (const decision of groupDecisions) {
      decision.status = "exclusive_conflict";
      decision.reason = `Exclusive routing group "${group}" matched more than one policy.`;
    }
  }

  const rejectInvalid = decisions.some((decision) => {
    const policy = policies.find((candidate) => candidate.id === decision.policyId);
    return decision.status === "invalid_input" && policy?.onInvalidInput === "reject-event";
  });
  if (rejectInvalid) {
    throw new RoutingEngineError("Routing produced invalid operation input for a reject-event policy.", decisions);
  }

  const exclusiveConflict = decisions.some((decision) => decision.status === "exclusive_conflict");
  if (exclusiveConflict) {
    throw new RoutingEngineError("Exclusive routing conflict.", decisions);
  }

  return decisions;
};

export const routingDecisionSnapshot = (decision: OperationRoutingDecision): Record<string, unknown> =>
  JSON.parse(stableJson(decision)) as Record<string, unknown>;

