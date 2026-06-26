import type { AgentRun, AppData, EventDefinition, EventRecord, RuntimeEvent } from "./shared/domain.js";
import type { AgentOperation } from "./shared/operations.js";
import { ContractRegistry, type ContractDefinition, type ContractKind } from "./shared/contracts.js";
import type { EmissionPolicy } from "./shared/emission-policy.js";
import type { LoopDefinition } from "./shared/loop.js";
import type { RoutingPolicy } from "./shared/routing-policy.js";
import type { MappingExpression } from "./shared/mapping.js";
import { isJsonValue, stableJson, type JsonValue, type VersionedRef } from "./shared/json.js";
import { projectFlow, type FlowDiagnostic, type FlowViewModel } from "./flow-projection.js";
import { workspaceValidator, type WorkspaceDiagnostic } from "./workspace-validator.js";
import { routeEventToOperations, RoutingEngineError } from "./routing-engine.js";
import { evaluateEmissionPolicies, EmissionEngineError } from "./emission-engine.js";
import type { DataShapeFieldDraft, FlowAgentTaskDraft, FlowCreateDraft, FlowDraftTestResult, FlowResultEventDraft, FlowSettingsUpdateDraft } from "./shared/flow.js";

export type { DataShapeFieldDraft, FlowAgentTaskDraft, FlowCreateDraft, FlowLimitExceededDraft, FlowResultEventDraft, FlowSafetyLimitsDraft, FlowSettingsUpdateDraft } from "./shared/flow.js";

export interface FlowComposerResult {
  resources: {
    contracts: ContractDefinition[];
    eventDefinitions: EventDefinition[];
    operations: AgentOperation[];
    routingPolicies: RoutingPolicy[];
    emissionPolicies: EmissionPolicy[];
    loopDefinitions: LoopDefinition[];
  };
  validation: {
    valid: boolean;
    diagnostics: WorkspaceDiagnostic[];
  };
  flow?: FlowViewModel;
  test?: FlowDraftTestResult;
}

const now = () => new Date().toISOString();

const defaultSafetyLimits = {
  maxHops: 20,
  maxRuns: 20,
  maxIterationsPerStep: 3
};

const limitExceededFields: DataShapeFieldDraft[] = [
  {
    name: "reason",
    label: "Reason",
    description: "Why the Flow stopped before reaching a terminal outcome.",
    type: "text",
    required: true,
    example: "Maximum steps exceeded."
  }
];

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "flow";

const titleCase = (value: string): string =>
  value.replace(/[-_.]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const jsonRecord = (value: unknown): Record<string, unknown> =>
  isRecord(value) ? value : {};

const wholeNumberOrDefault = (value: number | undefined, fallback: number): number =>
  value !== undefined && Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;

const optionalPositiveWholeNumber = (value: number | undefined): number | undefined =>
  value !== undefined && Number.isFinite(value) && value > 0 ? Math.floor(value) : undefined;

const safetyLimitsFromDraft = (
  draft: Pick<FlowCreateDraft | FlowSettingsUpdateDraft, "safetyLimits">,
  fallback: LoopDefinition["limits"] = defaultSafetyLimits
): LoopDefinition["limits"] => {
  const deadlineSeconds = draft.safetyLimits?.deadlineSeconds !== undefined
    ? optionalPositiveWholeNumber(draft.safetyLimits.deadlineSeconds)
    : fallback.deadlineSeconds;
  return {
    maxHops: wholeNumberOrDefault(draft.safetyLimits?.maxHops, fallback.maxHops),
    maxRuns: wholeNumberOrDefault(draft.safetyLimits?.maxRuns, fallback.maxRuns),
    maxIterationsPerStep: wholeNumberOrDefault(draft.safetyLimits?.maxIterationsPerStep, fallback.maxIterationsPerStep),
    ...(deadlineSeconds !== undefined ? { deadlineSeconds } : {})
  };
};

const schemaProperties = (schema: unknown): Record<string, unknown> =>
  isRecord(schema) && isRecord(schema.properties) ? schema.properties : {};

const dataShapeTypeFromSchema = (schema: unknown): DataShapeFieldDraft["type"] => {
  if (!isRecord(schema)) return "text";
  if (schema.type === "number" || schema.type === "integer") return "number";
  if (schema.type === "boolean") return "boolean";
  if (schema.type === "object") return "object";
  if (schema.type === "array") {
    const items = isRecord(schema.items) ? schema.items : undefined;
    if (items?.type === "number" || items?.type === "integer") return "number-list";
    if (items?.type === "object") return "object-list";
    return "text-list";
  }
  return "text";
};

const dataShapeFieldsFromSchema = (schema: unknown): DataShapeFieldDraft[] => {
  const required = isRecord(schema) && Array.isArray(schema.required) ? schema.required.map(String) : [];
  return Object.entries(schemaProperties(schema)).map(([name, child]) => ({
    name,
    label: titleCase(name),
    description: isRecord(child) && typeof child.description === "string" ? child.description : undefined,
    type: dataShapeTypeFromSchema(child),
    required: required.includes(name)
  }));
};

const exampleValueFromSchema = (schema: unknown, fallback: string): JsonValue => {
  if (!isRecord(schema)) return fallback;
  if (Array.isArray(schema.examples) && schema.examples.length > 0 && isJsonValue(schema.examples[0])) return schema.examples[0];
  if (schema.default !== undefined && isJsonValue(schema.default)) return schema.default;
  if (Array.isArray(schema.enum) && schema.enum.length > 0 && isJsonValue(schema.enum[0])) return schema.enum[0];
  if (schema.type === "number" || schema.type === "integer") return 1;
  if (schema.type === "boolean") return true;
  if (schema.type === "array") return [exampleValueFromSchema(schema.items, fallback)];
  if (schema.type === "object") {
    return Object.fromEntries(
      Object.entries(schemaProperties(schema)).map(([key, child]) => [key, exampleValueFromSchema(child, titleCase(key))])
    );
  }
  return fallback;
};

const exampleAgentOutput = (contract: ContractDefinition): JsonValue => {
  const properties = schemaProperties(contract.schema);
  return {
    status: "completed",
    summary: "Example completed result.",
    result: exampleValueFromSchema(properties.result, "Example result"),
    evidence: exampleValueFromSchema(properties.evidence, "Example evidence")
  };
};

const gateLabel = (gateType: string): string => {
  if (gateType === "required_value") return "Required value";
  if (gateType === "git_commit_exists") return "Git commit exists";
  if (gateType === "no_failed_checks") return "No failed checks";
  return titleCase(gateType);
};

const fieldSchema = (field: DataShapeFieldDraft): Record<string, unknown> => {
  const base: Record<string, unknown> = {};
  if (field.description) base.description = field.description;
  if (field.default !== undefined) base.default = field.default;
  if (field.allowedValues?.length) base.enum = field.allowedValues;
  if (field.example !== undefined) base.examples = [field.example];
  if (field.type === "number") return { ...base, type: "number" };
  if (field.type === "boolean") return { ...base, type: "boolean" };
  if (field.type === "text-list") return { ...base, type: "array", items: { type: "string" } };
  if (field.type === "number-list") return { ...base, type: "array", items: { type: "number" } };
  if (field.type === "object") return { ...base, type: "object", additionalProperties: true };
  if (field.type === "object-list") return { ...base, type: "array", items: { type: "object", additionalProperties: true } };
  return { ...base, type: "string" };
};

const exampleForField = (field: DataShapeFieldDraft): unknown => {
  if (field.example !== undefined) return field.example;
  if (field.default !== undefined) return field.default;
  if (field.type === "number") return 1;
  if (field.type === "boolean") return true;
  if (field.type === "text-list") return ["Example"];
  if (field.type === "number-list") return [1];
  if (field.type === "object") return {};
  if (field.type === "object-list") return [{}];
  return field.label || field.name || "Example";
};

export const exampleFromFields = (fields: DataShapeFieldDraft[]): Record<string, unknown> =>
  Object.fromEntries(fields.map((field) => [field.name, exampleForField(field)]));

export const objectSchemaFromFields = (fields: DataShapeFieldDraft[]): Record<string, unknown> => ({
  type: "object",
  additionalProperties: false,
  required: fields.filter((field) => field.required).map((field) => field.name),
  properties: Object.fromEntries(fields.map((field) => [field.name, fieldSchema(field)]))
});

export const agentOutputSchemaFromFields = (resultFields: DataShapeFieldDraft[]): Record<string, unknown> => ({
  type: "object",
  additionalProperties: false,
  required: ["status", "summary"],
  properties: {
    status: { type: "string", enum: ["completed", "blocked", "needs_input", "failed"] },
    summary: { type: "string" },
    result: objectSchemaFromFields(resultFields),
    evidence: {
      type: "object",
      additionalProperties: false,
      properties: {
        checks: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["name", "status"],
            properties: {
              name: { type: "string" },
              status: { type: "string", enum: ["passed", "failed", "skipped"] },
              details: { type: "string" }
            }
          }
        },
        artifacts: { type: "object", additionalProperties: true }
      }
    }
  }
});

const contract = (
  id: string,
  kind: ContractKind,
  name: string,
  description: string,
  schema: Record<string, unknown>,
  examples: unknown[] = [],
  version = 1
): ContractDefinition => ({
  id,
  version,
  name,
  description,
  kind,
  active: true,
  schema,
  examples,
  createdAt: now(),
  updatedAt: now()
});

const mapRequiredFieldsFromTrigger = (fields: DataShapeFieldDraft[]): MappingExpression => ({
  object: Object.fromEntries(fields.map((field) => [field.name, { from: `/event/data/${field.name}`, ...(field.default !== undefined ? { default: field.default as never } : {}) }]))
});

const findLatestContract = (data: AppData, id: string): VersionedRef | undefined => {
  const versions = data.contracts.filter((item) => item.id === id).sort((left, right) => right.version - left.version);
  return versions[0] ? { id, version: versions[0].version } : undefined;
};

const contractForRef = (data: AppData, ref: VersionedRef | undefined): ContractDefinition | undefined =>
  ref ? data.contracts.find((item) => item.id === ref.id && item.version === ref.version) : undefined;

const latestVersionForId = <T extends { id: string; version: number }>(items: T[], id: string): number =>
  Math.max(0, ...items.filter((item) => item.id === id).map((item) => item.version));

const findLatestOperation = (data: AppData, id: string): AgentOperation | undefined =>
  data.operations
    .filter((item) => item.id === id)
    .sort((left, right) => right.version - left.version)[0];

const buildLimitExceededResources = (
  data: AppData,
  flowId: string,
  flowName: string,
  draft: NonNullable<FlowCreateDraft["limitExceeded"]>,
  currentEventType?: string
): {
  contracts: ContractDefinition[];
  eventDefinitions: EventDefinition[];
  event: EventDefinition;
} => {
  const eventId = draft.eventId ?? data.eventDefinitions.find((event) => event.eventType === currentEventType)?.id ?? `${flowId}-limit-exceeded-v1`;
  const existingEvent = data.eventDefinitions.find((event) => event.id === eventId);
  const existingContract = existingEvent?.dataContract ?? findLatestContract(data, `${flowId}-limit-exceeded-data`);
  const contracts: ContractDefinition[] = [];
  const dataContract = existingContract ?? { id: `${flowId}-limit-exceeded-data`, version: 1 };
  if (!existingContract) {
    contracts.push(contract(
      dataContract.id,
      "event-data",
      `${flowName} limit exceeded data`,
      `Data published when ${flowName} stops because a safety limit is exceeded.`,
      objectSchemaFromFields(limitExceededFields),
      [exampleFromFields(limitExceededFields)]
    ));
  }
  const event: EventDefinition = {
    ...existingEvent,
    id: eventId,
    name: draft.name?.trim() || existingEvent?.name || `${flowName} limit exceeded`,
    description: draft.description?.trim() || existingEvent?.description || `Published when ${flowName} stops because a safety limit is exceeded.`,
    active: true,
    eventType: existingEvent?.eventType || currentEventType || `${flowId}.limit-exceeded.v1`,
    source: existingEvent?.source || "agentd",
    tags: existingEvent?.tags?.length ? existingEvent.tags : [flowId],
    dataContract,
    examples: existingEvent?.examples?.length ? existingEvent.examples : [exampleFromFields(limitExceededFields)],
    createdAt: existingEvent?.createdAt ?? now(),
    updatedAt: now()
  };
  return { contracts, eventDefinitions: [event], event };
};

export class FlowComposer {
  compose(data: AppData, draft: FlowCreateDraft): FlowComposerResult {
    const flowId = slugify(draft.id ?? draft.name);
    const triggerId = draft.trigger?.eventId ?? `${flowId}-started-v1`;
    const triggerEventType = `${flowId}.started.v1`;
    const existingTriggerEvent = data.eventDefinitions.find((event) => event.id === triggerId);
    const existingTriggerContract = contractForRef(data, existingTriggerEvent?.dataContract);
    const triggerFields: DataShapeFieldDraft[] = draft.trigger?.fields?.length
      ? draft.trigger.fields
      : existingTriggerContract
        ? dataShapeFieldsFromSchema(existingTriggerContract.schema)
        : [
            { name: "subject", type: "text", required: true },
            { name: "goal", type: "text", required: true }
          ];
    const contracts: ContractDefinition[] = [];
    const eventDefinitions: EventDefinition[] = [];
    const operations: AgentOperation[] = [];
    const routingPolicies: RoutingPolicy[] = [];
    const emissionPolicies: EmissionPolicy[] = [];
    const ensureContract = (
      id: string,
      kind: ContractKind,
      name: string,
      description: string,
      schema: Record<string, unknown>,
      examples: unknown[] = []
    ): VersionedRef => {
      const existing = findLatestContract(data, id);
      if (!existing) {
        contracts.push(contract(id, kind, name, description, schema, examples));
      }
      return existing ?? { id, version: 1 };
    };
    const ensureNextContractVersion = (
      ref: VersionedRef,
      kind: ContractKind,
      name: string,
      description: string,
      schema: Record<string, unknown>,
      examples: unknown[] = []
    ): VersionedRef => {
      const existing = contractForRef(data, ref);
      if (existing && existing.kind === kind && stableJson(existing.schema) === stableJson(schema)) {
        return { id: existing.id, version: existing.version };
      }
      const version = Math.max(
        latestVersionForId(data.contracts, ref.id),
        latestVersionForId(contracts, ref.id)
      ) + 1;
      contracts.push(contract(ref.id, kind, name, description, schema, examples, version));
      return { id: ref.id, version };
    };

    const triggerSchema = objectSchemaFromFields(triggerFields);
    const triggerExample = draft.trigger?.example ?? exampleFromFields(triggerFields);
    const ownsTriggerEvent = Boolean(existingTriggerEvent && !draft.trigger?.eventId);
    const triggerContract = existingTriggerEvent?.dataContract
      ? ownsTriggerEvent
        ? ensureNextContractVersion(
            existingTriggerEvent.dataContract,
            "event-data",
            `${draft.name} trigger data`,
            `Trigger data for ${draft.name}.`,
            triggerSchema,
            [triggerExample]
          )
        : existingTriggerEvent.dataContract
      : ensureContract(
          `${flowId}-trigger-data`,
          "event-data",
          `${draft.name} trigger data`,
          `Trigger data for ${draft.name}.`,
          triggerSchema,
          [triggerExample]
        );

    const triggerEvent: EventDefinition = existingTriggerEvent
      ? ownsTriggerEvent
        ? {
            ...existingTriggerEvent,
            name: draft.trigger?.name ?? existingTriggerEvent.name,
            description: draft.trigger?.description ?? existingTriggerEvent.description,
            dataContract: triggerContract,
            examples: [triggerExample],
            updatedAt: now()
          }
        : existingTriggerEvent
      : {
          id: triggerId,
          name: draft.trigger?.name ?? `${draft.name} started`,
          description: draft.trigger?.description ?? `Starts ${draft.name}.`,
          active: true,
          eventType: triggerEventType,
          source: "*",
          tags: [flowId],
          dataContract: triggerContract,
          examples: [draft.trigger?.example ?? exampleFromFields(triggerFields)],
          createdAt: now(),
          updatedAt: now()
        };
    if (!existingTriggerEvent || ownsTriggerEvent) eventDefinitions.push(triggerEvent);

    const taskDrafts: Array<{
      task: FlowAgentTaskDraft;
      inputMapping?: MappingExpression;
      resultEvent?: FlowResultEventDraft;
    }> = [
      { task: draft.agentTask ?? {}, inputMapping: draft.inputMapping ?? draft.agentTask?.inputMapping, resultEvent: draft.resultEvent ?? draft.agentTask?.resultEvent },
      ...(draft.followUpTasks ?? []).map((task) => ({ task, inputMapping: task.inputMapping, resultEvent: task.resultEvent }))
    ];

    let sourceEvent = triggerEvent;
    let terminalEvent = triggerEvent;

    taskDrafts.forEach(({ task, inputMapping, resultEvent: resultEventDraft }, index) => {
      const draftAgentId = task.agentId ?? data.agents[0]?.id ?? "agent";
      const requestedOperationId = task.operationId;
      const generatedOperationId = `${slugify(draftAgentId)}/${index === 0 ? flowId : `${flowId}-${slugify(task.name ?? `step-${index + 1}`)}`}`;
      const operationId = requestedOperationId ?? generatedOperationId;
      const existingOperation = findLatestOperation(data, operationId);
      const agentId = task.agentId ?? existingOperation?.agentId ?? draftAgentId;
      const stepName = task.name ?? existingOperation?.name ?? (index === 0 ? titleCase(flowId) : `${titleCase(flowId)} step ${index + 1}`);
      const stepSlug = index === 0 ? "task" : slugify(stepName);
      const existingInputContract = contractForRef(data, existingOperation?.inputContract);
      const existingOutputContract = contractForRef(data, existingOperation?.outputContract);
      const hasEditableInputFields = Boolean(task.inputFields?.length);
      const hasEditableResultFields = Boolean(task.resultFields?.length);
      const inputFields: DataShapeFieldDraft[] = hasEditableInputFields ? task.inputFields! : existingInputContract ? dataShapeFieldsFromSchema(existingInputContract.schema) : index === 0 ? triggerFields : [
        { name: "summary", type: "text", required: true }
      ];
      const resultFields: DataShapeFieldDraft[] = hasEditableResultFields
        ? task.resultFields!
        : existingOutputContract
          ? dataShapeFieldsFromSchema(schemaProperties(existingOutputContract.schema).result)
          : [
              { name: "decision", type: "text", required: false }
            ];
      const inputContractId = index === 0 ? `${flowId}-task-input` : `${flowId}-${stepSlug}-task-input`;
      const outputContractId = index === 0 ? `${flowId}-task-output` : `${flowId}-${stepSlug}-task-output`;
      const resultContractId = index === 0 ? `${flowId}-result-data` : `${flowId}-${stepSlug}-result-data`;
      const inputSchema = objectSchemaFromFields(inputFields);
      const outputSchema = agentOutputSchemaFromFields(resultFields);
      const inputContract = existingOperation?.inputContract
        ? hasEditableInputFields
          ? ensureNextContractVersion(
              existingOperation.inputContract,
              "agent-input",
              `${draft.name} ${index === 0 ? "task" : stepName} input`,
              `Task input for ${stepName}.`,
              inputSchema
            )
          : existingOperation.inputContract
        : ensureContract(inputContractId, "agent-input", `${draft.name} ${index === 0 ? "task" : stepName} input`, `Task input for ${stepName}.`, inputSchema);
      const outputContract = existingOperation?.outputContract
        ? hasEditableResultFields
          ? ensureNextContractVersion(
              existingOperation.outputContract,
              "agent-output",
              `${draft.name} ${index === 0 ? "task" : stepName} output`,
              `Task output for ${stepName}.`,
              outputSchema
            )
          : existingOperation.outputContract
        : ensureContract(outputContractId, "agent-output", `${draft.name} ${index === 0 ? "task" : stepName} output`, `Task output for ${stepName}.`, outputSchema);
      const resultEventId = resultEventDraft?.eventId ?? (index === 0 ? `${flowId}-completed-v1` : `${flowId}-${stepSlug}-completed-v1`);
      const generatedResultEventType = index === 0 ? `${flowId}.completed.v1` : `${flowId}.${stepSlug}.completed.v1`;
      const existingResultEvent = data.eventDefinitions.find((event) => event.id === resultEventId);
      const existingResultContract = contractForRef(data, existingResultEvent?.dataContract);
      const resultEventFields: DataShapeFieldDraft[] = resultEventDraft?.fields?.length
        ? resultEventDraft.fields
        : existingResultContract
          ? dataShapeFieldsFromSchema(existingResultContract.schema)
          : [
              { name: "summary", type: "text", required: true }
            ];
      const resultEventSchema = objectSchemaFromFields(resultEventFields);
      const resultEventExample = exampleFromFields(resultEventFields);
      const ownsResultEvent = Boolean(existingResultEvent && !resultEventDraft?.eventId);
      const resultContract = existingResultEvent?.dataContract
        ? ownsResultEvent
          ? ensureNextContractVersion(
              existingResultEvent.dataContract,
              "event-data",
              `${draft.name} ${index === 0 ? "result" : stepName} data`,
              `Result event data for ${stepName}.`,
              resultEventSchema,
              [resultEventExample]
            )
          : existingResultEvent.dataContract
        : ensureContract(resultContractId, "event-data", `${draft.name} ${index === 0 ? "result" : stepName} data`, `Result event data for ${stepName}.`, resultEventSchema, [resultEventExample]);
      const subjectField = resultEventDraft?.subjectField?.trim() || "subject";
      const gates = resultEventDraft?.requireSummaryGate === false
        ? []
        : [{ type: "required_value" as const, path: "/output/summary" }];
      const resultEvent: EventDefinition = existingResultEvent
        ? ownsResultEvent
          ? {
              ...existingResultEvent,
              name: resultEventDraft?.name ?? existingResultEvent.name,
              description: resultEventDraft?.description ?? existingResultEvent.description,
              dataContract: resultContract,
              examples: [resultEventExample],
              updatedAt: now()
            }
          : existingResultEvent
        : {
        id: resultEventId,
        name: resultEventDraft?.name ?? (index === 0 ? `${draft.name} completed` : `${stepName} completed`),
        description: resultEventDraft?.description ?? (index === 0 ? `Completes ${draft.name}.` : `Continues ${draft.name} after ${stepName}.`),
        active: true,
        eventType: generatedResultEventType,
        source: "agentd",
        tags: [flowId],
        dataContract: resultContract,
        examples: [exampleFromFields(resultEventFields)],
        createdAt: now(),
        updatedAt: now()
      };
      if (!existingResultEvent || ownsResultEvent) eventDefinitions.push(resultEvent);

      const desiredOperation: AgentOperation = {
        ...(existingOperation ?? {}),
        id: operationId,
        version: existingOperation?.version ?? 1,
        name: stepName,
        description: existingOperation?.description ?? draft.purpose,
        active: existingOperation?.active ?? true,
        agentId,
        instructions: task.instructions ?? existingOperation?.instructions ?? draft.purpose,
        inputContract,
        outputContract,
        emissionRequired: existingOperation?.emissionRequired ?? true,
        createdAt: existingOperation?.createdAt ?? now(),
        updatedAt: now()
      };
      const operationChanged = !existingOperation || [
        "name",
        "description",
        "active",
        "agentId",
        "instructions",
        "inputContract",
        "outputContract",
        "emissionRequired"
      ].some((field) => stableJson(existingOperation[field as keyof AgentOperation]) !== stableJson(desiredOperation[field as keyof AgentOperation]));
      const operation: AgentOperation = existingOperation && operationChanged
        ? {
            ...desiredOperation,
            version: latestVersionForId(data.operations, operationId) + 1,
            createdAt: now(),
            updatedAt: now()
          }
        : desiredOperation;
      if (operationChanged) operations.push(operation);

      const routingPolicy: RoutingPolicy = {
        id: index === 0 ? `on-${flowId}-started-start-${slugify(operation.name)}` : `on-${flowId}-${slugify(sourceEvent.name)}-start-${slugify(operation.name)}`,
        name: `When ${sourceEvent.name}, ask ${operation.name}`,
        description: `Routes ${sourceEvent.name} to ${operation.name}.`,
        active: draft.active ?? false,
        consumes: { eventType: sourceEvent.eventType },
        dispatch: { operation: { id: operation.id, version: operation.version } },
        input: inputMapping ?? mapRequiredFieldsFromTrigger(inputFields),
        selection: { mode: "fanout" },
        onInvalidInput: "reject-event",
        createdAt: now(),
        updatedAt: now()
      };
      routingPolicies.push(routingPolicy);

      const emissionPolicyId = index === 0 ? `emit-${flowId}-completed` : `emit-${flowId}-${stepSlug}-completed`;
      const emissionPolicy: EmissionPolicy = {
        id: emissionPolicyId,
        version: 1,
        name: `Publish ${resultEvent.name}`,
        description: `Publishes ${resultEvent.name} after ${operation.name} completes.`,
        active: draft.active ?? false,
        observes: { operation: { id: operation.id, version: operation.version } },
        when: { path: "/output/status", op: "eq", value: "completed" },
        gates,
        emissions: [{
          slot: "completed",
          eventType: resultEvent.eventType,
          subject: { from: `/input/${subjectField}`, default: flowId },
          data: {
            object: Object.fromEntries(resultEventFields.map((field) => [
              field.name,
              field.name === "summary" ? { from: "/output/summary" } : { from: `/output/result/${field.name}`, ...(field.default !== undefined ? { default: field.default as never } : {}) }
            ]))
          },
          dedupeKey: { template: `emission:{{/run/id}}:${emissionPolicyId}:completed` }
        }],
        onGateFailure: resultEventDraft?.onGateFailure ?? "fail_run",
        createdAt: now(),
        updatedAt: now()
      };
      emissionPolicies.push(emissionPolicy);
      sourceEvent = resultEvent;
      terminalEvent = resultEvent;
    });

    let limitExceededEvent: EventDefinition | undefined;
    if (draft.limitExceeded?.enabled) {
      const limitResources = buildLimitExceededResources(data, flowId, draft.name, draft.limitExceeded);
      contracts.push(...limitResources.contracts);
      eventDefinitions.push(...limitResources.eventDefinitions);
      limitExceededEvent = limitResources.event;
    }

    const loop: LoopDefinition = {
      id: flowId,
      version: 1,
      name: draft.name,
      description: draft.description ?? draft.purpose,
      active: draft.active ?? false,
      entryEventTypes: [triggerEvent.eventType],
      terminalEventTypes: [terminalEvent.eventType],
      routingPolicyIds: routingPolicies.map((policy) => policy.id),
      emissionPolicyIds: emissionPolicies.map((policy) => policy.id),
      limits: safetyLimitsFromDraft(draft),
      ...(limitExceededEvent ? { onLimitExceeded: { eventType: limitExceededEvent.eventType } } : {}),
      createdAt: now(),
      updatedAt: now()
    };

    const proposed: AppData = {
      ...data,
      contracts: [...data.contracts, ...contracts],
      eventDefinitions: [...data.eventDefinitions.filter((event) => !eventDefinitions.some((candidate) => candidate.id === event.id)), ...eventDefinitions],
      operations: [...data.operations.filter((item) => !operations.some((candidate) => candidate.id === item.id && candidate.version === item.version)), ...operations],
      policies: [...data.policies.filter((policy) => !routingPolicies.some((candidate) => candidate.id === policy.id)), ...routingPolicies],
      emissionPolicies: [...data.emissionPolicies.filter((policy) => !emissionPolicies.some((candidate) => candidate.id === policy.id && candidate.version === policy.version)), ...emissionPolicies],
      loopDefinitions: [...data.loopDefinitions.filter((item) => !(item.id === loop.id && item.version === loop.version)), loop]
    };
    const validation = workspaceValidator.validate(proposed);
    const flow = projectFlow(loop, proposed);
    const projectedFlow = validation.valid
      ? flow
      : { ...flow, diagnostics: [...flow.diagnostics, ...validation.diagnostics.map(this.toFlowDiagnostic)], health: "invalid" as const };
    return {
      resources: {
        contracts,
        eventDefinitions,
        operations,
        routingPolicies,
        emissionPolicies,
        loopDefinitions: [loop]
      },
      validation,
      flow: projectedFlow,
      test: this.previewFlowTest(proposed, loop, projectedFlow)
    };
  }

  composeSettingsUpdate(data: AppData, flowId: string, draft: FlowSettingsUpdateDraft, flowVersion?: number): FlowComposerResult {
    const matchingLoops = data.loopDefinitions.filter((item) => item.id === flowId);
    const loop = flowVersion === undefined
      ? matchingLoops.length === 1 ? matchingLoops[0] : undefined
      : matchingLoops.find((item) => item.version === flowVersion);
    if (!loop) {
      const versionRequired = flowVersion === undefined && matchingLoops.length > 1;
      return {
        resources: {
          contracts: [],
          eventDefinitions: [],
          operations: [],
          routingPolicies: [],
          emissionPolicies: [],
          loopDefinitions: []
        },
        validation: {
          valid: false,
          diagnostics: [{
            severity: "error",
            title: versionRequired ? "Flow version required" : "Flow not found",
            explanation: versionRequired
              ? `Flow ${flowId} has multiple versions. Choose the version before editing settings.`
              : `Flow ${flowId}${flowVersion === undefined ? "" : `@${flowVersion}`} does not exist.`,
            resource: { type: "loop", id: flowId, ...(flowVersion !== undefined ? { version: flowVersion } : {}), label: flowId },
            suggestedFix: versionRequired ? "Open the specific Flow version before editing settings." : "Choose an existing Flow before editing settings."
          }]
        }
      };
    }

    const contracts: ContractDefinition[] = [];
    const eventDefinitions: EventDefinition[] = [];
    let onLimitExceeded = loop.onLimitExceeded;
    if (draft.limitExceeded?.enabled === false) {
      onLimitExceeded = undefined;
    } else if (draft.limitExceeded?.enabled) {
      const limitResources = buildLimitExceededResources(
        data,
        loop.id,
        draft.name?.trim() || loop.name,
        draft.limitExceeded,
        loop.onLimitExceeded?.eventType
      );
      contracts.push(...limitResources.contracts);
      eventDefinitions.push(...limitResources.eventDefinitions);
      onLimitExceeded = { eventType: limitResources.event.eventType };
    }

    const nextLoop: LoopDefinition = {
      ...loop,
      name: draft.name?.trim() || loop.name,
      description: draft.description !== undefined ? draft.description : loop.description,
      limits: safetyLimitsFromDraft(draft, loop.limits),
      ...(onLimitExceeded ? { onLimitExceeded } : { onLimitExceeded: undefined }),
      updatedAt: now()
    };
    const proposed: AppData = {
      ...data,
      contracts: [...data.contracts, ...contracts],
      eventDefinitions: [
        ...data.eventDefinitions.filter((event) => !eventDefinitions.some((candidate) => candidate.id === event.id)),
        ...eventDefinitions
      ],
      loopDefinitions: data.loopDefinitions.map((item) =>
        item.id === loop.id && item.version === loop.version ? nextLoop : item
      )
    };
    const validation = workspaceValidator.validate(proposed);
    const flow = projectFlow(nextLoop, proposed);
    const projectedFlow = validation.valid
      ? flow
      : { ...flow, diagnostics: [...flow.diagnostics, ...validation.diagnostics.map(this.toFlowDiagnostic)], health: "invalid" as const };
    return {
      resources: {
        contracts,
        eventDefinitions,
        operations: [],
        routingPolicies: [],
        emissionPolicies: [],
        loopDefinitions: [nextLoop]
      },
      validation,
      flow: projectedFlow
    };
  }

  previewFlowTest(data: AppData, loop: LoopDefinition, flow: FlowViewModel, payload?: Record<string, unknown>): FlowDraftTestResult {
    try {
      return this.previewDraftTest(data, loop, flow, payload);
    } catch (error) {
      return {
        matched: false,
        trigger: {
          name: flow.entryEvents[0]?.name ?? flow.name,
          summary: "The draft test could not run yet.",
          exampleData: {}
        },
        operationInputs: [],
        exampleOutputs: [],
        resultBranches: [],
        emittedEvents: [],
        downstreamTasks: [],
        diagnostics: flow.diagnostics,
        trace: [{
          title: "Draft test unavailable",
          summary: error instanceof Error ? error.message : String(error)
        }]
      };
    }
  }

  private previewDraftTest(data: AppData, loop: LoopDefinition, flow: FlowViewModel, payload?: Record<string, unknown>): FlowDraftTestResult {
    if (!flow.entryEvents[0]) {
      return {
        matched: false,
        trigger: { name: flow.name, summary: "This Flow does not have an entry trigger yet.", exampleData: {} },
        operationInputs: [],
        exampleOutputs: [],
        resultBranches: [],
        emittedEvents: [],
        downstreamTasks: [],
        diagnostics: flow.diagnostics,
        trace: [{ title: "Trigger missing", summary: "Add a trigger before testing this Flow." }]
      };
    }

    const registry = new ContractRegistry(data.contracts);
    const simulationData = {
      ...data,
      policies: data.policies.map((policy) => loop.routingPolicyIds.includes(policy.id) ? { ...policy, active: true } : policy),
      emissionPolicies: data.emissionPolicies.map((policy) => loop.emissionPolicyIds.includes(policy.id) ? { ...policy, active: true } : policy)
    };
    const trace: FlowDraftTestResult["trace"] = [];
    const operationInputs: FlowDraftTestResult["operationInputs"] = [];
    const exampleOutputs: FlowDraftTestResult["exampleOutputs"] = [];
    const resultBranches: FlowDraftTestResult["resultBranches"] = [];
    const emittedEvents: FlowDraftTestResult["emittedEvents"] = [];
    const downstreamTasks = new Map<string, FlowDraftTestResult["downstreamTasks"][number]>();
    const entryDefinition = simulationData.eventDefinitions.find((event) => event.eventType === flow.entryEvents[0]!.eventType);
    const providedPayload = payload && Object.keys(payload).length > 0 ? payload : undefined;
    const exampleData = jsonRecord(providedPayload ?? entryDefinition?.examples?.find(isRecord) ?? {});
    let currentEvent = this.eventRecordFor(entryDefinition, exampleData, 0);
    const visitedEvents = new Set<string>();
    let matched = false;

    trace.push({
      title: "Trigger checked",
      summary: entryDefinition ? `${entryDefinition.name} uses example data and can start this Flow.` : "The trigger definition is missing."
    });

    for (let index = 0; index < 10; index += 1) {
      if (!currentEvent || visitedEvents.has(currentEvent.eventType)) break;
      visitedEvents.add(currentEvent.eventType);

      let routingDecisions;
      try {
        routingDecisions = routeEventToOperations({
          event: currentEvent,
          policies: simulationData.policies,
          operations: simulationData.operations,
          agents: simulationData.agents,
          contracts: registry
        });
      } catch (error) {
        routingDecisions = error instanceof RoutingEngineError ? error.decisions : [];
        trace.push({ title: "Input validation failed", summary: error instanceof Error ? error.message : String(error) });
      }

      const routed = routingDecisions.find((decision) => decision.status === "routed");
      for (const decision of routingDecisions) {
        const operation = simulationData.operations.find((candidate) =>
          candidate.id === decision.operationId && candidate.version === decision.operationVersion
        );
        const agent = simulationData.agents.find((candidate) => candidate.id === operation?.agentId);
        operationInputs.push({
          taskName: operation?.name ?? decision.operationId ?? "Agent task",
          agentName: agent?.name,
          status: decision.status,
          summary: decision.status === "routed"
            ? "Input mapped and passed validation."
            : decision.reason,
          input: jsonRecord(decision.input)
        });
      }

      if (!routed?.operationId || !routed.operationVersion) break;
      matched = true;
      const operation = simulationData.operations.find((candidate) =>
        candidate.id === routed.operationId && candidate.version === routed.operationVersion
      );
      if (!operation) break;
      const outputContract = registry.require(operation.outputContract, "agent-output");
      const output = exampleAgentOutput(outputContract);
      const outputRecord = jsonRecord(output);
      exampleOutputs.push({
        taskName: operation.name,
        status: String(outputRecord.status ?? "completed"),
        summary: String(outputRecord.summary ?? "Example completed result."),
        result: jsonRecord(outputRecord.result)
      });
      trace.push({
        title: "Operation input mapped",
        summary: `${operation.name} receives ${Object.keys(jsonRecord(routed.input)).length} mapped field${Object.keys(jsonRecord(routed.input)).length === 1 ? "" : "s"}.`
      });
      trace.push({ title: "Input validated", summary: `${operation.name} input matches its contract.` });
      trace.push({ title: "Example output prepared", summary: `${operation.name} returns a completed example output.` });

      let emissionResult;
      try {
        emissionResult = evaluateEmissionPolicies({
          projectRoot: process.cwd(),
          operation,
          run: this.agentRunFor(operation, routed, currentEvent, index),
          trigger: this.runtimeEventFor(currentEvent, index),
          input: (routed.input ?? {}) as JsonValue,
          output,
          policies: simulationData.emissionPolicies,
          eventDefinitions: simulationData.eventDefinitions,
          contracts: registry
        });
      } catch (error) {
        const decisions = error instanceof EmissionEngineError ? error.decisions : [];
        for (const decision of decisions) {
          const policy = simulationData.emissionPolicies.find((candidate) =>
            candidate.id === decision.emissionPolicyId && candidate.version === decision.emissionPolicyVersion
          );
          resultBranches.push({
            taskName: operation.name,
            branchName: policy?.emissions[0]?.slot ? titleCase(policy.emissions[0].slot) : policy?.name ?? "Result branch",
            matched: decision.status !== "skipped",
            summary: decision.reason,
            gateSummary: decision.gateDecisions.length
              ? decision.gateDecisions.map((gate) => `${gateLabel(gate.type)} ${gate.passed ? "passed" : "failed"}`).join(", ")
              : "No technical gates",
            gateFailureBehavior: policy?.onGateFailure === "skip" ? "Skip publishing" : "Fail this run"
          });
        }
        trace.push({ title: "Result branch failed", summary: error instanceof Error ? error.message : String(error) });
        break;
      }

      let nextEvent: EventRecord | undefined;
      for (const decision of emissionResult.decisions) {
        const policy = simulationData.emissionPolicies.find((candidate) =>
          candidate.id === decision.emissionPolicyId && candidate.version === decision.emissionPolicyVersion
        );
        const branchName = policy?.emissions[0]?.slot ? titleCase(policy.emissions[0].slot) : policy?.name ?? "Result branch";
        resultBranches.push({
          taskName: operation.name,
          branchName,
          matched: decision.status === "emitted",
          summary: decision.reason,
          gateSummary: decision.gateDecisions.length
            ? decision.gateDecisions.map((gate) => `${gateLabel(gate.type)} ${gate.passed ? "passed" : "failed"}`).join(", ")
            : "No technical gates",
          gateFailureBehavior: policy?.onGateFailure === "skip" ? "Skip publishing" : "Fail this run"
        });
        trace.push({
          title: decision.status === "emitted" ? "Result branch matched" : "Result branch skipped",
          summary: `${branchName} ${decision.status === "emitted" ? "matched" : "did not publish"} for ${operation.name}.`
        });
      }
      for (const event of emissionResult.events) {
        const definition = simulationData.eventDefinitions.find((candidate) => candidate.eventType === event.type);
        emittedEvents.push({
          name: definition?.name ?? titleCase(event.type),
          eventType: event.type,
          subject: event.subject,
          summary: `${definition?.name ?? event.type} would be published.`,
          data: event.payload
        });
        trace.push({ title: "Event emitted", summary: `${definition?.name ?? event.type} would be published.` });
        const downstreamPolicies = simulationData.policies.filter((policy) =>
          loop.routingPolicyIds.includes(policy.id) && policy.consumes.eventType === event.type
        );
        for (const policy of downstreamPolicies) {
          const downstreamOperation = simulationData.operations.find((candidate) =>
            candidate.id === policy.dispatch.operation.id && candidate.version === policy.dispatch.operation.version
          );
          if (!downstreamOperation) continue;
          const agent = simulationData.agents.find((candidate) => candidate.id === downstreamOperation.agentId);
          downstreamTasks.set(`${downstreamOperation.id}@${downstreamOperation.version}`, {
            taskName: downstreamOperation.name,
            agentName: agent?.name,
            summary: `${definition?.name ?? event.type} can continue to ${downstreamOperation.name}.`
          });
        }
        nextEvent ??= this.eventRecordFor(definition, event.payload, index + 1, event.subject);
      }
      currentEvent = nextEvent;
    }

    if (downstreamTasks.size > 0) {
      trace.push({
        title: "Downstream task found",
        summary: `${downstreamTasks.size} next task${downstreamTasks.size === 1 ? "" : "s"} can continue after the emitted event.`
      });
    }
    trace.push({
      title: "Diagnostics checked",
      summary: flow.diagnostics.length === 0 ? "No configuration problems were found." : `${flow.diagnostics.length} configuration issue${flow.diagnostics.length === 1 ? "" : "s"} need attention.`
    });

    return {
      matched,
      trigger: {
        name: entryDefinition?.name ?? flow.entryEvents[0].name,
        summary: matched ? "The trigger example can route into the Flow." : "The trigger example did not route into an agent task.",
        exampleData
      },
      operationInputs,
      exampleOutputs,
      resultBranches,
      emittedEvents,
      downstreamTasks: [...downstreamTasks.values()],
      diagnostics: flow.diagnostics,
      trace
    };
  }

  private eventRecordFor(definition: EventDefinition | undefined, payload: Record<string, unknown>, index: number, subject?: string): EventRecord | undefined {
    if (!definition) return undefined;
    return {
      id: `draft-event-${index + 1}`,
      eventId: `draft-event-${index + 1}`,
      projectId: "draft-project",
      source: "flow-test",
      eventType: definition.eventType,
      subject: subject ?? (typeof payload.subject === "string" ? payload.subject : "flow-test"),
      correlationId: "draft-correlation",
      correlationDepth: index,
      tags: definition.tags ?? [],
      payload,
      data: payload,
      status: "received",
      createdAt: now()
    };
  }

  private runtimeEventFor(event: EventRecord, index: number): RuntimeEvent {
    return {
      seq: index + 1,
      eventId: event.eventId ?? event.id,
      type: event.eventType,
      source: event.source,
      subject: event.subject ?? "flow-test",
      correlationId: event.correlationId ?? "draft-correlation",
      causationId: event.causationId,
      correlationDepth: event.correlationDepth ?? index,
      occurredAt: event.occurredAt ?? now(),
      projectId: event.projectId,
      tags: event.tags,
      payload: event.payload,
      data: event.data,
      status: event.status
    };
  }

  private agentRunFor(
    operation: AgentOperation,
    decision: { policyId: string; policyVersion: number; input?: JsonValue },
    event: EventRecord,
    index: number
  ): AgentRun {
    return {
      runId: `draft-run-${index + 1}`,
      triggerEventId: event.eventId ?? event.id,
      policyId: decision.policyId,
      policyVersion: decision.policyVersion,
      agentRole: operation.agentId,
      correlationId: event.correlationId,
      operationId: operation.id,
      operationVersion: operation.version,
      inputJson: decision.input,
      status: "running",
      attempt: 1,
      createdAt: now(),
      updatedAt: now()
    };
  }

  private toFlowDiagnostic(diagnostic: WorkspaceDiagnostic): FlowDiagnostic {
    return {
      severity: diagnostic.severity === "error" ? "error" : diagnostic.severity === "warning" ? "warning" : "info",
      title: diagnostic.title,
      explanation: diagnostic.explanation,
      affectedResource: {
        type: diagnostic.resource.type === "routing-policy" ? "routing-policy" : diagnostic.resource.type === "emission-policy" ? "emission-policy" : diagnostic.resource.type,
        id: diagnostic.resource.id,
        version: diagnostic.resource.version
      } as FlowDiagnostic["affectedResource"],
      suggestedFix: diagnostic.suggestedFix
    };
  }
}

export const flowComposer = new FlowComposer();
