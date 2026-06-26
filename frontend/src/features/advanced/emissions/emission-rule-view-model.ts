import type { Condition } from "backend/shared/conditions";
import type { ContractDefinition } from "backend/shared/contracts";
import type { AppData } from "backend/shared/domain";
import type { EmissionGate, EmissionPolicy } from "backend/shared/emission-policy";
import type { DataShapeFieldDraft } from "backend/shared/flow";
import type { MappingExpression } from "backend/shared/mapping";
import type { AgentOperation } from "backend/shared/operations";
import type { JsonValue } from "backend/shared/json";
import type { AutoMappingSummaryRow } from "@/components/simple-rules/AutoMappingSummary";
import {
  fieldsFromObjectSchema,
  findContract,
  findEventByType,
  findOperation,
  isRecord,
  refLabel,
  resultFieldsFromOutputContract
} from "@/features/advanced/model/advanced-resource-model";

export interface SimpleEmissionRuleViewModel {
  id: string;
  version: number;
  name: string;
  description: string;
  active: boolean;
  operationId: string;
  operationVersion: number;
  operationName: string;
  agentName?: string;
  conditionSummary: string;
  emittedEventType: string;
  emittedEventName: string;
  gateSummary: string[];
  dataMappingSummary: AutoMappingSummaryRow[];
  health: "ready" | "warning" | "invalid";
  diagnostics: unknown[];
}

export interface SimpleEmissionRuleDraft {
  operationId: string;
  operationVersion: number;
  condition: Condition;
  emittedEventType: string;
  description: string;
  active: boolean;
  gates: EmissionGate[];
}

const pointerSegment = (value: string): string => value.replace(/~/g, "~0").replace(/\//g, "~1");
const normalize = (value: string): string => value.toLowerCase().replace(/[\s._-]+/g, "");

const isJsonValue = (value: unknown): value is JsonValue =>
  value === null ||
  typeof value === "string" ||
  typeof value === "number" ||
  typeof value === "boolean" ||
  (Array.isArray(value) && value.every(isJsonValue)) ||
  (isRecord(value) && Object.values(value).every(isJsonValue));

const labelValue = (label: string): JsonValue => {
  const raw = label.replace(/^default: /, "");
  try {
    const parsed = JSON.parse(raw) as unknown;
    return isJsonValue(parsed) ? parsed : raw;
  } catch {
    return raw;
  }
};

const mappingFromRows = (rows: AutoMappingSummaryRow[]): MappingExpression => ({
  object: Object.fromEntries(rows.flatMap((row): Array<[string, MappingExpression]> => {
    if (row.status === "missing") return [];
    if (row.status === "defaulted") return [[row.targetField, { const: labelValue(row.sourceLabel) }]];
    if (row.sourceLabel === "from Agent summary") return [[row.targetField, { from: "/output/summary" }]];
    const resultPrefix = "from Agent result > ";
    if (row.sourceLabel.startsWith(resultPrefix)) return [[row.targetField, { from: `/output/result/${pointerSegment(row.sourceLabel.slice(resultPrefix.length))}` }]];
    return [];
  }))
});

export const autoSubjectMapping = (operationInputContract: ContractDefinition | undefined): { mapping?: MappingExpression; label: string; needsSelection: boolean } => {
  const inputFields = operationInputContract ? fieldsFromObjectSchema(operationInputContract.schema) : [];
  if (inputFields.some((field) => field.name === "workItemId")) return { mapping: { from: "/input/workItemId" }, label: "from Agent input > workItemId", needsSelection: false };
  if (inputFields.some((field) => field.name === "subject")) return { mapping: { from: "/input/subject" }, label: "from Agent input > subject", needsSelection: false };
  return { mapping: { from: "/trigger/subject" }, label: "from triggering Event subject", needsSelection: false };
};

export const autoMapOperationOutputToEventData = (
  _operation: AgentOperation | undefined,
  outputContract: ContractDefinition | undefined,
  _emittedEvent: unknown,
  eventDataContract: ContractDefinition | undefined,
  existing?: MappingExpression
): { mapping: MappingExpression; summary: AutoMappingSummaryRow[] } => {
  const resultFields = resultFieldsFromOutputContract(outputContract);
  const targetFields = eventDataContract ? fieldsFromObjectSchema(eventDataContract.schema) : [];
  const existingObject = existing && "object" in existing && isRecord(existing.object) ? existing.object : {};
  const summary = targetFields.flatMap((target): AutoMappingSummaryRow[] => {
    const existingExpression = existingObject[target.name];
    if (existingExpression) return [summarizeMappingExpression(target, existingExpression, true)];
    if (target.name === "summary") return [{ targetField: target.name, sourceLabel: "from Agent summary", required: Boolean(target.required), status: "mapped" }];
    const exact = resultFields.find((field) => field.name === target.name);
    const normalized = exact ?? resultFields.find((field) => normalize(field.name) === normalize(target.name));
    if (normalized) return [{ targetField: target.name, sourceLabel: `from Agent result > ${normalized.name}`, required: Boolean(target.required), status: "mapped" }];
    if (target.default !== undefined) return [{ targetField: target.name, sourceLabel: `default: ${JSON.stringify(target.default)}`, required: Boolean(target.required), status: "defaulted" }];
    if (target.required) return [{ targetField: target.name, sourceLabel: "missing required mapping", required: true, status: "missing" }];
    return [];
  });
  return { mapping: mappingFromRows(summary), summary };
};

const summarizeMappingExpression = (target: DataShapeFieldDraft, expression: unknown, allowCustom: boolean): AutoMappingSummaryRow => {
  if (isRecord(expression) && typeof expression.from === "string") {
    if (expression.from === "/output/summary") return { targetField: target.name, sourceLabel: "from Agent summary", required: Boolean(target.required), status: "mapped" };
    if (expression.from.startsWith("/output/result/")) return { targetField: target.name, sourceLabel: `from Agent result > ${expression.from.slice("/output/result/".length).replace(/~1/g, "/").replace(/~0/g, "~")}`, required: Boolean(target.required), status: "mapped" };
  }
  if (isRecord(expression) && "const" in expression) return { targetField: target.name, sourceLabel: `default: ${JSON.stringify(expression.const)}`, required: Boolean(target.required), status: "defaulted" };
  return { targetField: target.name, sourceLabel: allowCustom ? "custom mapping" : "missing required mapping", required: Boolean(target.required), status: allowCustom ? "custom" : "missing" };
};

export const emissionPresetCondition = (preset: string): Condition => {
  if (preset === "blocked") return { path: "/output/status", op: "eq", value: "blocked" };
  if (preset === "needs_input") return { path: "/output/status", op: "eq", value: "needs_input" };
  if (preset === "approved") return { all: [{ path: "/output/status", op: "eq", value: "completed" }, { path: "/output/result/decision", op: "eq", value: "approved" }] };
  if (preset === "changes_requested") return { all: [{ path: "/output/status", op: "eq", value: "completed" }, { path: "/output/result/decision", op: "eq", value: "changes_requested" }] };
  return { path: "/output/status", op: "eq", value: "completed" };
};

export const summarizeEmissionCondition = (condition: Condition | undefined): string => {
  if (!condition) return "Task completed";
  if ("path" in condition) return condition.op === "eq" ? `${condition.path.replace(/^\/output\/result\//, "result.").replace(/^\/output\//, "")} is ${String(condition.value ?? "")}` : "Custom output condition";
  if ("all" in condition) return condition.all.map(summarizeEmissionCondition).join(" and ");
  return "Advanced output condition";
};

export const summarizeGates = (gates: EmissionGate[] | undefined): string[] => {
  if (!gates?.length) return ["No checks before publishing"];
  return gates.map((gate) => {
    if (gate.type === "required_value" && gate.path === "/output/summary") return "Require a summary";
    if (gate.type === "no_failed_checks") return "Require no failed checks";
    if (gate.type === "git_commit_exists") return "Verify Git commit exists";
    return `${gate.type} at ${gate.path}`;
  });
};

export const simpleEmissionRuleFromPolicy = (
  policy: EmissionPolicy,
  data: AppData,
  diagnostics: unknown[] = []
): SimpleEmissionRuleViewModel => {
  const operation = findOperation(data, policy.observes.operation);
  const agent = operation ? data.agents.find((candidate) => candidate.id === operation.agentId) : undefined;
  const firstEmission = policy.emissions[0];
  const eventDefinition = findEventByType(data, firstEmission?.eventType);
  const outputContract = findContract(data, operation?.outputContract);
  const eventContract = findContract(data, eventDefinition?.dataContract);
  const auto = autoMapOperationOutputToEventData(operation, outputContract, eventDefinition, eventContract, firstEmission?.data);
  const invalid = diagnostics.length > 0 || auto.summary.some((row) => row.status === "missing") || !operation || !firstEmission || !eventDefinition;
  return {
    id: policy.id,
    version: policy.version,
    name: policy.name,
    description: policy.description,
    active: policy.active,
    operationId: policy.observes.operation.id,
    operationVersion: policy.observes.operation.version,
    operationName: operation?.name ?? refLabel(policy.observes.operation),
    agentName: agent?.name,
    conditionSummary: summarizeEmissionCondition(policy.when),
    emittedEventType: firstEmission?.eventType ?? "",
    emittedEventName: eventDefinition?.name ?? firstEmission?.eventType ?? "No event",
    gateSummary: summarizeGates(policy.gates),
    dataMappingSummary: auto.summary,
    health: invalid ? "invalid" : auto.summary.some((row) => row.status === "custom") ? "warning" : "ready",
    diagnostics
  };
};

export const emissionPolicyFromSimpleDraft = (
  policy: EmissionPolicy,
  draft: SimpleEmissionRuleDraft,
  data: AppData
): EmissionPolicy => {
  const operation = findOperation(data, { id: draft.operationId, version: draft.operationVersion });
  const eventDefinition = findEventByType(data, draft.emittedEventType);
  const inputContract = findContract(data, operation?.inputContract);
  const outputContract = findContract(data, operation?.outputContract);
  const eventContract = findContract(data, eventDefinition?.dataContract);
  const dataMapping = autoMapOperationOutputToEventData(operation, outputContract, eventDefinition, eventContract);
  const subject = autoSubjectMapping(inputContract);
  const eventName = eventDefinition?.name ?? draft.emittedEventType;
  const operationName = operation?.name ?? `${draft.operationId}@${draft.operationVersion}`;
  return {
    ...policy,
    active: draft.active,
    name: `Publish ${eventName}`,
    description: draft.description.trim() || `Publish ${eventName} after ${operationName} completes.`,
    observes: { operation: { id: draft.operationId, version: draft.operationVersion } },
    when: draft.condition,
    gates: draft.gates,
    emissions: [{
      ...(policy.emissions[0] ?? {}),
      slot: "completed",
      eventType: draft.emittedEventType,
      subject: subject.mapping,
      data: dataMapping.mapping,
      dedupeKey: { template: `emission:{{/run/id}}:${policy.id}:completed` }
    }],
    onGateFailure: "fail_run",
    updatedAt: new Date().toISOString()
  };
};
