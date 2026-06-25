import { execFileSync } from "node:child_process";
import type { EventDefinition, RuntimeEvent, AgentRun } from "./shared/domain.js";
import type { ContractRegistry } from "./shared/contracts.js";
import type { EmissionGate, EmissionPolicy } from "./shared/emission-policy.js";
import type { AgentOperation } from "./shared/operations.js";
import type { JsonValue } from "./shared/json.js";
import { evaluateCondition, type ConditionTrace } from "./shared/conditions.js";
import { evaluateMapping } from "./shared/mapping.js";
import { getByJsonPointer } from "./shared/json-pointer.js";

export interface EmittedDomainEvent {
  type: string;
  subject?: string;
  tags?: string[];
  payload: Record<string, unknown>;
  dedupeKey: string;
  body?: string;
}

export interface EmissionGateDecision {
  type: string;
  path: string;
  passed: boolean;
  reason: string;
}

export interface EmissionDecision {
  emissionPolicyId: string;
  emissionPolicyVersion: number;
  operationId: string;
  operationVersion: number;
  status: "emitted" | "skipped" | "failed";
  reason: string;
  conditionTrace?: ConditionTrace;
  gateDecisions: EmissionGateDecision[];
  emittedEvents: Array<{
    slot: string;
    eventType: string;
    dedupeKey: string;
  }>;
  validationErrors?: unknown[];
}

export interface EmissionEngineInput {
  projectRoot: string;
  operation: AgentOperation;
  run: AgentRun;
  trigger: RuntimeEvent;
  input: JsonValue;
  output: JsonValue;
  policies: EmissionPolicy[];
  eventDefinitions: EventDefinition[];
  contracts: ContractRegistry;
}

export interface EmissionEngineResult {
  decisions: EmissionDecision[];
  events: EmittedDomainEvent[];
}

export class EmissionEngineError extends Error {
  constructor(message: string, readonly decisions: EmissionDecision[]) {
    super(message);
    this.name = "EmissionEngineError";
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const comparePolicyOrder = (left: EmissionPolicy, right: EmissionPolicy): number =>
  (left.priority ?? 0) - (right.priority ?? 0) || left.id.localeCompare(right.id) || left.version - right.version;

const contextFor = (input: EmissionEngineInput): Record<string, unknown> => ({
  input: input.input,
  output: input.output,
  run: {
    id: input.run.runId,
    attempt: input.run.attempt,
    operationId: input.operation.id,
    operationVersion: input.operation.version
  },
  trigger: {
    eventId: input.trigger.eventId,
    projectId: input.trigger.projectId,
    subject: input.trigger.subject,
    correlationId: input.trigger.correlationId
  },
  loop: {
    instanceId: input.run.loopInstanceId,
    definitionId: input.run.loopDefinitionId,
    stepId: input.run.stepId,
    iteration: input.run.iteration
  }
});

const valueAt = (context: unknown, path: string): unknown => getByJsonPointer(context, path).value;

const gitCommitExists = (cwd: string, sha: unknown): boolean => {
  if (typeof sha !== "string" || !sha.trim()) return false;
  try {
    execFileSync("git", ["cat-file", "-e", `${sha}^{commit}`], { cwd, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};

const evaluateGate = (gate: EmissionGate, context: unknown, projectRoot: string): EmissionGateDecision => {
  const actual = valueAt(context, gate.path);
  if (gate.type === "git_commit_exists") {
    const passed = gitCommitExists(projectRoot, actual);
    return { type: gate.type, path: gate.path, passed, reason: passed ? "commit_exists" : "commit_missing" };
  }

  if (gate.type === "no_failed_checks") {
    if (!Array.isArray(actual)) {
      return { type: gate.type, path: gate.path, passed: false, reason: "checks_not_array" };
    }
    if ((gate.required ?? true) && actual.length === 0) {
      return { type: gate.type, path: gate.path, passed: false, reason: "checks_empty" };
    }
    const failed = actual.some((item) => isRecord(item) && item.status === "failed");
    return { type: gate.type, path: gate.path, passed: !failed, reason: failed ? "failed_check_present" : "no_failed_checks" };
  }

  const passed = actual !== undefined && actual !== null && actual !== "";
  return { type: gate.type, path: gate.path, passed, reason: passed ? "value_present" : "value_missing" };
};

const eventDefinitionFor = (definitions: EventDefinition[], eventType: string): EventDefinition | undefined =>
  definitions.find((definition) => definition.active && definition.eventType === eventType);

export const evaluateEmissionPolicies = (input: EmissionEngineInput): EmissionEngineResult => {
  const context = contextFor(input);
  const decisions: EmissionDecision[] = [];
  const events: EmittedDomainEvent[] = [];
  const policies = input.policies
    .filter((policy) =>
      policy.active &&
      policy.observes.operation.id === input.operation.id &&
      policy.observes.operation.version === input.operation.version
    )
    .sort(comparePolicyOrder);

  for (const policy of policies) {
    const condition = evaluateCondition(policy.when, context);
    const base: EmissionDecision = {
      emissionPolicyId: policy.id,
      emissionPolicyVersion: policy.version,
      operationId: input.operation.id,
      operationVersion: input.operation.version,
      status: "skipped",
      reason: "Emission condition did not match.",
      conditionTrace: condition.trace,
      gateDecisions: [],
      emittedEvents: []
    };

    if (!condition.matched) {
      decisions.push(base);
      continue;
    }

    const gates = (policy.gates ?? []).map((gate) => evaluateGate(gate, context, input.projectRoot));
    const failedGate = gates.find((gate) => !gate.passed);
    if (failedGate) {
      const failedDecision = {
        ...base,
        gateDecisions: gates,
        status: policy.onGateFailure === "fail_run" ? "failed" as const : "skipped" as const,
        reason: `Emission gate failed: ${failedGate.type} ${failedGate.reason}.`
      };
      decisions.push(failedDecision);
      if (policy.onGateFailure === "fail_run") {
        throw new EmissionEngineError(failedDecision.reason, decisions);
      }
      continue;
    }

    try {
      const emittedEvents: EmissionDecision["emittedEvents"] = [];
      for (const emission of policy.emissions) {
        const definition = eventDefinitionFor(input.eventDefinitions, emission.eventType);
        if (!definition?.dataContract) {
          throw new Error(`Active event definition with data contract was not found for ${emission.eventType}.`);
        }
        const mappedData = evaluateMapping(emission.data, context, { policyId: policy.id }, `emissions.${emission.slot}.data`);
        if (!isRecord(mappedData)) {
          throw new Error(`Emission ${policy.id}/${emission.slot} data mapping must produce an object.`);
        }
        const validation = input.contracts.validate(definition.dataContract, mappedData, "event-data");
        if (!validation.valid) {
          decisions.push({
            ...base,
            status: "failed",
            reason: `Emission ${policy.id}/${emission.slot} failed event data contract validation.`,
            gateDecisions: gates,
            validationErrors: validation.errors
          });
          throw new EmissionEngineError(`Emission ${policy.id}/${emission.slot} failed event data contract validation.`, decisions);
        }

        const subject = emission.subject
          ? String(evaluateMapping(emission.subject, context, { policyId: policy.id }, `emissions.${emission.slot}.subject`))
          : undefined;
        const rawTags = emission.tags
          ? evaluateMapping(emission.tags, context, { policyId: policy.id }, `emissions.${emission.slot}.tags`)
          : [];
        const tags = Array.isArray(rawTags) ? rawTags.map(String) : [];
        const dedupeKey = emission.dedupeKey?.template
          ? String(evaluateMapping({ template: emission.dedupeKey.template }, context, { policyId: policy.id }, `emissions.${emission.slot}.dedupeKey`))
          : `emission:${input.run.runId}:${policy.id}:${policy.version}:${emission.slot}`;

        events.push({
          type: emission.eventType,
          subject,
          tags,
          payload: mappedData,
          dedupeKey,
          body: `Emission policy ${policy.id}@${policy.version} produced ${emission.eventType}.`
        });
        emittedEvents.push({ slot: emission.slot, eventType: emission.eventType, dedupeKey });
      }

      decisions.push({
        ...base,
        status: emittedEvents.length > 0 ? "emitted" : "skipped",
        reason: emittedEvents.length > 0 ? "Emission policy produced events." : "Emission policy had no emissions.",
        gateDecisions: gates,
        emittedEvents
      });
    } catch (error) {
      if (error instanceof EmissionEngineError) throw error;
      decisions.push({
        ...base,
        status: "failed",
        reason: error instanceof Error ? error.message : String(error),
        gateDecisions: gates
      });
      throw new EmissionEngineError(error instanceof Error ? error.message : String(error), decisions);
    }
  }

  const completedOutput = isRecord(input.output) && input.output.status === "completed";
  if (input.operation.emissionRequired && completedOutput && events.length === 0) {
    throw new EmissionEngineError(`Operation ${input.operation.id}@${input.operation.version} requires at least one emitted event for completed output.`, decisions);
  }

  return { decisions, events };
};

