import type { AdvancedRoute } from "@/app/routes";
import type { AppData, EventDefinition } from "backend/shared/domain";
import type { ContractDefinition } from "backend/shared/contracts";
import type { EmissionGate, EmissionPolicy } from "backend/shared/emission-policy";
import type { LoopDefinition } from "backend/shared/loop";
import type { RoutingPolicy } from "backend/shared/routing-policy";
import type { DataShapeFieldDraft, WorkspaceReference, WorkspaceValidationResult } from "backend/shared/flow";
import {
  evidenceFieldsFromAgentOutputSchema,
  exampleFromFields,
  fieldsFromObjectSchema,
  resultFieldsFromAgentOutputSchema
} from "@/components/data-shape-builder/data-shape-builder-model";

export {
  agentOutputExampleFromFields,
  agentOutputSchemaFromFields,
  evidenceFieldsFromAgentOutputSchema,
  exampleForField,
  exampleFromFields,
  fieldsFromObjectSchema,
  objectSchemaFromFields,
  resultFieldsFromAgentOutputSchema
} from "@/components/data-shape-builder/data-shape-builder-model";

export const labels: Record<AdvancedRoute, string> = {
  contracts: "Data types",
  events: "Events",
  routing: "Routing rules",
  emissions: "Emission rules",
  loops: "Flow boundaries",
  runtimes: "Runtimes",
  skills: "Skills"
};

export interface AdvancedItem {
  key: string;
  name: string;
  description: string;
  identity: string;
  version?: number;
  active?: boolean;
  uses: string[];
  usedBy: string[];
  preview?: string;
  reference: WorkspaceReference;
  validationDiagnostics: NonNullable<WorkspaceValidationResult["diagnostics"]>;
  raw: unknown;
}

export const resourcesFor = (data: AppData, route: AdvancedRoute, validation?: WorkspaceValidationResult): AdvancedItem[] => {
  if (route === "contracts") {
    return data.contracts
      .slice()
      .sort((left, right) => left.id.localeCompare(right.id) || left.version - right.version)
      .map((contract) => {
        const usedBy = [
          ...data.eventDefinitions.filter((event) => event.dataContract?.id === contract.id && event.dataContract.version === contract.version).map((event) => event.name),
          ...data.operations.filter((operation) =>
            (operation.inputContract.id === contract.id && operation.inputContract.version === contract.version) ||
            (operation.outputContract.id === contract.id && operation.outputContract.version === contract.version)
          ).map((operation) => operation.name)
        ];
        return {
          key: `${contract.id}@${contract.version}`,
          name: contract.name,
          description: contract.description,
          identity: `${contract.id}@${contract.version}`,
          version: contract.version,
          active: contract.active,
          uses: [],
          usedBy,
          preview: `${contract.kind} · ${Object.keys((contract.schema.properties as Record<string, unknown> | undefined) ?? {}).length} fields`,
          reference: { type: "contract", id: contract.id, version: contract.version, label: contract.name },
          validationDiagnostics: resourceDiagnostics(validation, "contract", contract.id, contract.version),
          raw: contract
        };
      });
  }
  if (route === "events") {
    return data.eventDefinitions.map((event) => ({
      key: event.id,
      name: event.name,
      description: event.description,
      identity: event.eventType,
      active: event.active,
      uses: event.dataContract ? [`${event.dataContract.id}@${event.dataContract.version}`] : [],
      usedBy: [
        ...data.policies.filter((policy) => policy.consumes.eventType === event.eventType).map((policy) => policy.name),
        ...data.emissionPolicies.filter((policy) => policy.emissions.some((emission) => emission.eventType === event.eventType)).map((policy) => policy.name),
        ...data.loopDefinitions.filter((loop) => loop.entryEventTypes.includes(event.eventType) || loop.terminalEventTypes.includes(event.eventType)).map((loop) => loop.name)
      ],
      preview: event.dataContract ? `Data type ${event.dataContract.id}@${event.dataContract.version}` : "No data type",
      reference: { type: "event", id: event.id, label: event.name },
      validationDiagnostics: resourceDiagnostics(validation, "event", event.id),
      raw: event
    }));
  }
  if (route === "routing") {
    return data.policies.map((policy) => ({
      key: policy.id,
      name: policy.name,
      description: policy.description,
      identity: policy.id,
      active: policy.active,
      uses: [policy.consumes.eventType, `${policy.dispatch.operation.id}@${policy.dispatch.operation.version}`],
      usedBy: data.loopDefinitions.filter((loop) => loop.routingPolicyIds.includes(policy.id)).map((loop) => loop.name),
      preview: `${policy.consumes.eventType} -> ${policy.dispatch.operation.id}@${policy.dispatch.operation.version}`,
      reference: { type: "routing-policy", id: policy.id, label: policy.name },
      validationDiagnostics: resourceDiagnostics(validation, "routing-policy", policy.id),
      raw: policy
    }));
  }
  if (route === "emissions") {
    return data.emissionPolicies.map((policy) => ({
      key: `${policy.id}@${policy.version}`,
      name: policy.name,
      description: policy.description,
      identity: `${policy.id}@${policy.version}`,
      version: policy.version,
      active: policy.active,
      uses: [`${policy.observes.operation.id}@${policy.observes.operation.version}`, ...policy.emissions.map((emission) => emission.eventType)],
      usedBy: data.loopDefinitions.filter((loop) => loop.emissionPolicyIds.includes(policy.id)).map((loop) => loop.name),
      preview: `${policy.observes.operation.id}@${policy.observes.operation.version} publishes ${policy.emissions.map((emission) => emission.eventType).join(", ")}`,
      reference: { type: "emission-policy", id: policy.id, version: policy.version, label: policy.name },
      validationDiagnostics: resourceDiagnostics(validation, "emission-policy", policy.id, policy.version),
      raw: policy
    }));
  }
  if (route === "loops") {
    return data.loopDefinitions.map((loop) => ({
      key: `${loop.id}@${loop.version}`,
      name: loop.name,
      description: loop.description,
      identity: `${loop.id}@${loop.version}`,
      version: loop.version,
      active: loop.active,
      uses: [...loop.entryEventTypes, ...loop.terminalEventTypes, ...loop.routingPolicyIds, ...loop.emissionPolicyIds],
      usedBy: [],
      preview: `${loop.entryEventTypes.join(", ")} -> ${loop.terminalEventTypes.join(", ")}`,
      reference: { type: "loop", id: loop.id, version: loop.version, label: loop.name },
      validationDiagnostics: resourceDiagnostics(validation, "loop", loop.id, loop.version),
      raw: loop
    }));
  }
  if (route === "runtimes") {
    return data.runtimes.map((runtime) => ({
      key: runtime.id,
      name: runtime.name,
      description: runtime.type,
      identity: runtime.id,
      active: runtime.enabled,
      uses: [],
      usedBy: data.agents.filter((agent) => agent.frontmatter?.runtime === runtime.id).map((agent) => agent.name),
      reference: { type: "runtime", id: runtime.id, label: runtime.name },
      validationDiagnostics: [],
      raw: runtime
    }));
  }
  return data.skills.map((skill) => ({
    key: skill.id,
    name: skill.name,
    description: skill.description,
    identity: skill.id,
    active: skill.enabled,
    uses: [],
    usedBy: data.agents.filter((agent) => agent.skills.some((item) => item.id === skill.id)).map((agent) => agent.name),
    reference: { type: "skill", id: skill.id, label: skill.name },
    validationDiagnostics: [],
    raw: skill
  }));
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export const isContract = (value: unknown): value is ContractDefinition =>
  isRecord(value) && typeof value.id === "string" && typeof value.version === "number" && isRecord(value.schema);

export const isEventDefinition = (value: unknown): value is EventDefinition =>
  isRecord(value) && typeof value.id === "string" && typeof value.eventType === "string";

export const isRoutingPolicy = (value: unknown): value is RoutingPolicy =>
  isRecord(value) && typeof value.id === "string" && isRecord(value.consumes) && isRecord(value.dispatch);

export const isEmissionPolicy = (value: unknown): value is EmissionPolicy =>
  isRecord(value) && typeof value.id === "string" && typeof value.version === "number" && isRecord(value.observes) && Array.isArray(value.emissions);

export const isLoopDefinition = (value: unknown): value is LoopDefinition =>
  isRecord(value) && typeof value.id === "string" && typeof value.version === "number" && Array.isArray(value.routingPolicyIds) && Array.isArray(value.emissionPolicyIds);

export const refLabel = (ref: { id: string; version: number }) => `${ref.id}@${ref.version}`;

export const findContract = (data: AppData, ref?: { id: string; version: number }) =>
  ref ? data.contracts.find((contract) => contract.id === ref.id && contract.version === ref.version) : undefined;

export const findEventByType = (data: AppData, eventType: string | undefined) =>
  eventType ? data.eventDefinitions.find((eventDefinition) => eventDefinition.eventType === eventType) : undefined;

export const findOperation = (data: AppData, ref?: { id: string; version: number }) =>
  ref ? data.operations.find((operation) => operation.id === ref.id && operation.version === ref.version) : undefined;

export const eventNameFor = (data: AppData, eventType: string) =>
  findEventByType(data, eventType)?.name ?? eventType;

export const operationNameFor = (data: AppData, ref: { id: string; version: number }) =>
  findOperation(data, ref)?.name ?? refLabel(ref);

export const conditionRootForEmission = (condition: unknown) =>
  firstConditionPath(condition)?.startsWith("/output/result/") ? "/output/result" : "/output";

export const resultFieldsFromOutputContract = (contract: ContractDefinition | undefined): DataShapeFieldDraft[] => {
  if (!contract) return [];
  const properties = isRecord(contract.schema.properties) ? contract.schema.properties : {};
  const result = isRecord(properties.result) ? properties.result : undefined;
  if (contract.kind === "agent-output") return resultFieldsFromAgentOutputSchema(contract.schema);
  if (result && result.type === "object") return fieldsFromObjectSchema(result);
  return fieldsFromObjectSchema(contract.schema);
};

export const evidenceFieldsFromOutputContract = (contract: ContractDefinition | undefined): DataShapeFieldDraft[] => {
  if (!contract || contract.kind !== "agent-output") return [];
  return evidenceFieldsFromAgentOutputSchema(contract.schema);
};

export const exampleForContract = (contract: ContractDefinition | undefined): Record<string, unknown> => {
  if (!contract) return {};
  const example = contract.examples[0];
  if (isRecord(example)) return example;
  return exampleFromFields(fieldsFromObjectSchema(contract.schema));
};

export const operationOutputExample = (contract: ContractDefinition | undefined): Record<string, unknown> => {
  const base = exampleForContract(contract);
  const result = isRecord(base.result)
    ? base.result
    : exampleFromFields(resultFieldsFromOutputContract(contract));
  return {
    ...base,
    status: typeof base.status === "string" ? base.status : "completed",
    summary: typeof base.summary === "string" ? base.summary : "Dry-run completed",
    result,
    evidence: isRecord(base.evidence) ? base.evidence : exampleFromFields(evidenceFieldsFromOutputContract(contract))
  };
};

export const formatJson = (value: unknown): string => JSON.stringify(value ?? {}, null, 2);

export const gateDescription = (gate: EmissionGate): string => {
  if (gate.type === "git_commit_exists") return `Verify that a Git commit exists at ${gate.path}`;
  if (gate.type === "no_failed_checks") return `${gate.required === false ? "Allow empty checks and require" : "Require"} no failed checks at ${gate.path}`;
  return `Require a value at ${gate.path}`;
};

export const mappingSummary = (expression: unknown): string => {
  if (!expression || !isRecord(expression)) return "";
  if (typeof expression.from === "string") return `from ${friendlyPath(expression.from)}`;
  if ("const" in expression) return `constant ${String(expression.const ?? "")}`;
  if (typeof expression.template === "string") return `template ${expression.template}`;
  if (isRecord(expression.object)) return `maps ${Object.keys(expression.object).join(", ")}`;
  if (Array.isArray(expression.array)) return `${expression.array.length} values`;
  if (Array.isArray(expression.coalesce)) return "first available value";
  return "custom mapping";
};

const resourceDiagnostics = (
  validation: WorkspaceValidationResult | undefined,
  type: WorkspaceReference["type"],
  id: string,
  version?: number
) => (validation?.diagnostics ?? []).filter((diagnostic) =>
  diagnostic.resource.type === type &&
  diagnostic.resource.id === id &&
  (version === undefined || diagnostic.resource.version === undefined || diagnostic.resource.version === version)
);

const firstConditionPath = (condition: unknown): string | undefined => {
  if (!isRecord(condition)) return undefined;
  if (typeof condition.path === "string") return condition.path;
  if (Array.isArray(condition.all)) return condition.all.map(firstConditionPath).find(Boolean);
  if (Array.isArray(condition.any)) return condition.any.map(firstConditionPath).find(Boolean);
  return firstConditionPath(condition.not);
};

const friendlyPath = (path: string): string => path
  .replace(/^\/event\/data\//, "trigger data ")
  .replace(/^\/event\//, "trigger ")
  .replace(/^\/output\/result\//, "operation result ")
  .replace(/^\/output\//, "operation output ")
  .replace(/^\/input\//, "operation input ")
  .replace(/^\/trigger\//, "trigger ");
