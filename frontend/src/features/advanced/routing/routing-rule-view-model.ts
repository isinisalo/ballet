import type { Condition } from "backend/shared/conditions";
import type { ContractDefinition } from "backend/shared/contracts";
import type { AppData, EventDefinition } from "backend/shared/domain";
import type { DataShapeFieldDraft } from "backend/shared/flow";
import type { MappingExpression } from "backend/shared/mapping";
import type { AgentOperation } from "backend/shared/operations";
import type { RoutingPolicy } from "backend/shared/routing-policy";
import type { AutoMappingSummaryRow } from "@/components/simple-rules/AutoMappingSummary";
import { fieldsFromObjectSchema, findContract, findEventByType, findOperation, isRecord, refLabel } from "@/features/advanced/model/advanced-resource-model";

export interface SimpleRoutingRuleViewModel {
  id: string;
  name: string;
  description: string;
  active: boolean;
  inputEventType: string;
  inputEventName: string;
  targetOperationId: string;
  targetOperationVersion: number;
  targetOperationName: string;
  targetAgentName?: string;
  conditionSummary: string;
  inputMappingSummary: AutoMappingSummaryRow[];
  health: "ready" | "warning" | "invalid";
  diagnostics: unknown[];
}

export interface SimpleRoutingRuleDraft {
  inputEventType: string;
  targetOperationId: string;
  targetOperationVersion: number;
  description: string;
  active: boolean;
  when?: Condition;
}

const pointerSegment = (value: string): string => value.replace(/~/g, "~0").replace(/\//g, "~1");
const normalize = (value: string): string => value.toLowerCase().replace(/[\s._-]+/g, "");

const schemaDefault = (field: DataShapeFieldDraft): unknown =>
  field.default;

const mappingFromRows = (rows: AutoMappingSummaryRow[]): MappingExpression => ({
  object: Object.fromEntries(rows.flatMap((row): Array<[string, MappingExpression]> => {
    if (row.status === "missing") return [];
    if (row.status === "defaulted") return [[row.targetField, { const: labelValue(row.sourceLabel) } satisfies MappingExpression]];
    if (row.sourceLabel === "from Event subject") return [[row.targetField, { from: "/event/subject" } satisfies MappingExpression]];
    const dataPrefix = "from Event data > ";
    if (row.sourceLabel.startsWith(dataPrefix)) {
      return [[row.targetField, { from: `/event/data/${pointerSegment(row.sourceLabel.slice(dataPrefix.length))}` } satisfies MappingExpression]];
    }
    return [];
  }))
});

const labelValue = (label: string): string | number | boolean | null | string[] => {
  const raw = label.replace(/^default: /, "");
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed === null || typeof parsed === "string" || typeof parsed === "number" || typeof parsed === "boolean" || Array.isArray(parsed)) return parsed as string | number | boolean | null | string[];
  } catch {
    return raw;
  }
  return raw;
};

export const autoMapEventToOperationInput = (
  _eventDefinition: EventDefinition | undefined,
  eventContract: ContractDefinition | undefined,
  _operation: AgentOperation | undefined,
  inputContract: ContractDefinition | undefined,
  existing?: MappingExpression
): { mapping: MappingExpression; summary: AutoMappingSummaryRow[] } => {
  const eventFields = eventContract ? fieldsFromObjectSchema(eventContract.schema) : [];
  const inputFields = inputContract ? fieldsFromObjectSchema(inputContract.schema) : [];
  const existingObject = existing && "object" in existing && isRecord(existing.object) ? existing.object : {};
  const summary = inputFields.flatMap((target): AutoMappingSummaryRow[] => {
    const existingExpression = existingObject[target.name];
    if (existingExpression) return [summarizeMappingExpression(target, existingExpression, true)];
    if (target.name === "workItemId" || target.name === "subject") {
      return [{ targetField: target.name, sourceLabel: "from Event subject", required: Boolean(target.required), status: "mapped" }];
    }
    const exact = eventFields.find((field) => field.name === target.name);
    const normalized = exact ?? eventFields.find((field) => normalize(field.name) === normalize(target.name));
    if (normalized) {
      return [{ targetField: target.name, sourceLabel: `from Event data > ${normalized.name}`, required: Boolean(target.required), status: "mapped" }];
    }
    const defaultValue = schemaDefault(target);
    if (defaultValue !== undefined) {
      return [{ targetField: target.name, sourceLabel: `default: ${JSON.stringify(defaultValue)}`, required: Boolean(target.required), status: "defaulted" }];
    }
    if (target.required) {
      return [{ targetField: target.name, sourceLabel: "missing required mapping", required: true, status: "missing" }];
    }
    return [];
  });

  return { mapping: mappingFromRows(summary), summary };
};

const summarizeMappingExpression = (target: DataShapeFieldDraft, expression: unknown, allowCustom: boolean): AutoMappingSummaryRow => {
  if (isRecord(expression) && typeof expression.from === "string") {
    if (expression.from === "/event/subject") return { targetField: target.name, sourceLabel: "from Event subject", required: Boolean(target.required), status: "mapped" };
    if (expression.from.startsWith("/event/data/")) return { targetField: target.name, sourceLabel: `from Event data > ${expression.from.slice("/event/data/".length).replace(/~1/g, "/").replace(/~0/g, "~")}`, required: Boolean(target.required), status: "mapped" };
  }
  if (isRecord(expression) && "const" in expression) {
    return { targetField: target.name, sourceLabel: `default: ${JSON.stringify(expression.const)}`, required: Boolean(target.required), status: "defaulted" };
  }
  return { targetField: target.name, sourceLabel: allowCustom ? "custom mapping" : "missing required mapping", required: Boolean(target.required), status: allowCustom ? "custom" : "missing" };
};

export const summarizeRoutingCondition = (condition: Condition | undefined): string => {
  if (!condition) return "Always route this event";
  if ("path" in condition) {
    const field = condition.path.replace(/^\/event\/data\//, "Event data > ").replace(/^\/event\//, "Event ");
    const op = condition.op === "eq" ? "is" : condition.op === "neq" ? "is not" : condition.op === "gt" ? "greater than" : condition.op === "lt" ? "less than" : condition.op;
    return condition.op === "exists" ? `${field} exists` : `${field} ${op} ${String(condition.value ?? "")}`;
  }
  if ("all" in condition) return `${condition.all.length} conditions must match`;
  if ("any" in condition) return `${condition.any.length} condition options`;
  return "Advanced condition";
};

export const summarizeMapping = (summary: AutoMappingSummaryRow[]): AutoMappingSummaryRow[] => summary;

export const simpleRoutingRuleFromPolicy = (
  policy: RoutingPolicy,
  data: AppData,
  diagnostics: unknown[] = []
): SimpleRoutingRuleViewModel => {
  const eventDefinition = findEventByType(data, policy.consumes.eventType);
  const operation = findOperation(data, policy.dispatch.operation);
  const agent = operation ? data.agents.find((candidate) => candidate.id === operation.agentId) : undefined;
  const eventContract = findContract(data, eventDefinition?.dataContract);
  const inputContract = findContract(data, operation?.inputContract);
  const auto = autoMapEventToOperationInput(eventDefinition, eventContract, operation, inputContract, policy.input);
  const invalid = diagnostics.length > 0 || auto.summary.some((row) => row.status === "missing") || !eventDefinition || !operation;
  return {
    id: policy.id,
    name: policy.name,
    description: policy.description,
    active: policy.active,
    inputEventType: policy.consumes.eventType,
    inputEventName: eventDefinition?.name ?? policy.consumes.eventType,
    targetOperationId: policy.dispatch.operation.id,
    targetOperationVersion: policy.dispatch.operation.version,
    targetOperationName: operation?.name ?? refLabel(policy.dispatch.operation),
    targetAgentName: agent?.name,
    conditionSummary: summarizeRoutingCondition(policy.when),
    inputMappingSummary: auto.summary,
    health: invalid ? "invalid" : auto.summary.some((row) => row.status === "custom") ? "warning" : "ready",
    diagnostics
  };
};

export const routingPolicyFromSimpleDraft = (
  policy: RoutingPolicy,
  draft: SimpleRoutingRuleDraft,
  data: AppData
): RoutingPolicy => {
  const eventDefinition = findEventByType(data, draft.inputEventType);
  const operation = findOperation(data, { id: draft.targetOperationId, version: draft.targetOperationVersion });
  const eventContract = findContract(data, eventDefinition?.dataContract);
  const inputContract = findContract(data, operation?.inputContract);
  const auto = autoMapEventToOperationInput(eventDefinition, eventContract, operation, inputContract);
  const eventName = eventDefinition?.name ?? draft.inputEventType;
  const operationName = operation?.name ?? `${draft.targetOperationId}@${draft.targetOperationVersion}`;
  return {
    ...policy,
    active: draft.active,
    name: `When ${eventName}, ask ${operationName}`,
    description: draft.description.trim() || `Route ${eventName} to ${operationName}.`,
    consumes: { eventType: draft.inputEventType },
    when: draft.when,
    dispatch: { operation: { id: draft.targetOperationId, version: draft.targetOperationVersion } },
    input: auto.mapping,
    selection: { mode: "fanout" },
    onInvalidInput: "reject-event",
    updatedAt: new Date().toISOString()
  };
};
