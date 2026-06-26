import type { AppData } from "./shared/domain.js";
import type { ContractDefinition } from "./shared/contracts.js";
import type { Condition } from "./shared/conditions.js";
import type { MappingExpression } from "./shared/mapping.js";
import type { VersionedRef } from "./shared/json.js";
import { ContractRegistry, ContractRegistryError, contractKey } from "./shared/contracts.js";
import { assertCondition } from "./shared/conditions.js";
import { isJsonValue } from "./shared/json.js";
import { parseJsonPointer } from "./shared/json-pointer.js";

export type WorkspaceDiagnosticSeverity = "error" | "warning" | "info";

export interface WorkspaceReference {
  type: "contract" | "event" | "operation" | "routing-policy" | "emission-policy" | "loop" | "agent" | "runtime" | "skill";
  id: string;
  version?: number;
  label: string;
}

export interface WorkspaceDiagnostic {
  severity: WorkspaceDiagnosticSeverity;
  title: string;
  explanation: string;
  resource: WorkspaceReference;
  suggestedFix?: string;
}

export interface WorkspaceValidationResult {
  valid: boolean;
  diagnostics: WorkspaceDiagnostic[];
}

export interface SafeDeleteResult {
  allowed: boolean;
  references: WorkspaceReference[];
  diagnostics: WorkspaceDiagnostic[];
}

const refKey = (ref: VersionedRef): string => `${ref.id}@${ref.version}`;
const policyVersion = (policy: { version?: number }) => policy.version;
const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "resource";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const addDiagnostic = (
  diagnostics: WorkspaceDiagnostic[],
  severity: WorkspaceDiagnosticSeverity,
  title: string,
  explanation: string,
  resource: WorkspaceReference,
  suggestedFix?: string
) => {
  diagnostics.push({ severity, title, explanation, resource, suggestedFix });
};

export const assertMappingExpression = (expression: unknown, location = "mapping"): void => {
  if (!isRecord(expression)) throw new Error(`${location} must be an object.`);
  const keys = Object.keys(expression);
  const operators = keys.filter((key) => ["from", "const", "object", "array", "coalesce", "template"].includes(key));
  if (operators.length !== 1) throw new Error(`${location} must contain exactly one mapping operator.`);
  if ("from" in expression) {
    if (typeof expression.from !== "string" || !expression.from.startsWith("/")) throw new Error(`${location}.from must be a JSON Pointer.`);
    if ("default" in expression && !isJsonValue(expression.default)) throw new Error(`${location}.default must be a JSON value.`);
    return;
  }
  if ("const" in expression) {
    if (!isJsonValue(expression.const)) throw new Error(`${location}.const must be a JSON value.`);
    return;
  }
  if ("template" in expression) {
    if (typeof expression.template !== "string") throw new Error(`${location}.template must be a string.`);
    return;
  }
  if ("array" in expression) {
    if (!Array.isArray(expression.array)) throw new Error(`${location}.array must be an array.`);
    expression.array.forEach((item, index) => assertMappingExpression(item, `${location}.array[${index}]`));
    return;
  }
  if ("coalesce" in expression) {
    if (!Array.isArray(expression.coalesce) || expression.coalesce.length === 0) throw new Error(`${location}.coalesce must be a non-empty array.`);
    expression.coalesce.forEach((item, index) => assertMappingExpression(item, `${location}.coalesce[${index}]`));
    return;
  }
  if (!isRecord(expression.object)) throw new Error(`${location}.object must be an object.`);
  for (const [key, child] of Object.entries(expression.object)) {
    assertMappingExpression(child, `${location}.object.${key}`);
  }
};

const requiredObjectFields = (contract: ContractDefinition | undefined): string[] => {
  if (!contract) return [];
  return Array.isArray(contract.schema.required) ? contract.schema.required.map(String) : [];
};

const mappedObjectFields = (mapping: MappingExpression | undefined): Set<string> | undefined => {
  if (!mapping || !("object" in mapping) || !isRecord(mapping.object)) return undefined;
  return new Set(Object.keys(mapping.object));
};

type InferredMappingType = "text" | "text-list" | "number" | "number-list" | "boolean" | "object" | "array" | "unknown";

const typeFromSchema = (schema: unknown): InferredMappingType => {
  if (!isRecord(schema)) return "unknown";
  const type = schema.type;
  if (type === "string") return "text";
  if (type === "number" || type === "integer") return "number";
  if (type === "boolean") return "boolean";
  if (type === "object") return "object";
  if (type === "array") {
    const items = isRecord(schema.items) ? schema.items : undefined;
    if (items?.type === "string") return "text-list";
    if (items?.type === "number" || items?.type === "integer") return "number-list";
    return "array";
  }
  return "unknown";
};

const childSchema = (schema: unknown, segment: string): unknown => {
  if (!isRecord(schema)) return undefined;
  if (isRecord(schema.properties) && Object.prototype.hasOwnProperty.call(schema.properties, segment)) {
    return schema.properties[segment];
  }
  return undefined;
};

const schemaTypeAt = (contract: ContractDefinition | undefined, path: string): InferredMappingType => {
  if (!contract) return "unknown";
  let schema: unknown = contract.schema;
  for (const segment of parseJsonPointer(path)) {
    schema = childSchema(schema, segment);
    if (!schema) return "unknown";
  }
  return typeFromSchema(schema);
};

const escapeJsonPointerSegment = (segment: string): string =>
  segment.replace(/~/g, "~0").replace(/\//g, "~1");

const pointerFromSegments = (segments: string[]): string =>
  segments.length ? `/${segments.map(escapeJsonPointerSegment).join("/")}` : "";

const typeFromJsonValue = (value: unknown): InferredMappingType => {
  if (typeof value === "string") return "text";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (Array.isArray(value)) {
    if (value.every((item) => typeof item === "string")) return "text-list";
    if (value.every((item) => typeof item === "number")) return "number-list";
    return "array";
  }
  if (isRecord(value)) return "object";
  return "unknown";
};

const mappingTypeFromExpression = (
  mapping: MappingExpression | undefined,
  sourceTypeAt: (path: string) => InferredMappingType
): InferredMappingType => {
  if (!mapping) return "unknown";
  if ("from" in mapping) {
    const sourceType = sourceTypeAt(mapping.from);
    if (sourceType === "unknown" && "default" in mapping) return typeFromJsonValue(mapping.default);
    return sourceType;
  }
  if ("const" in mapping) return typeFromJsonValue(mapping.const);
  if ("template" in mapping) return "text";
  if ("object" in mapping) return "object";
  if ("array" in mapping) {
    const childTypes = mapping.array.map((child) => mappingTypeFromExpression(child, sourceTypeAt));
    if (childTypes.length > 0 && childTypes.every((type) => type === "text")) return "text-list";
    if (childTypes.length > 0 && childTypes.every((type) => type === "number")) return "number-list";
    return "array";
  }
  if ("coalesce" in mapping) {
    const knownTypes = mapping.coalesce
      .map((child) => mappingTypeFromExpression(child, sourceTypeAt))
      .filter((type) => type !== "unknown");
    return knownTypes.every((type) => type === knownTypes[0]) ? knownTypes[0] ?? "unknown" : "unknown";
  }
  return "unknown";
};

const mappingTypeLabel = (type: InferredMappingType): string =>
  type.replace("-", " ");

const mappingTypesCompatible = (source: InferredMappingType, target: InferredMappingType): boolean => {
  if (source === "unknown" || target === "unknown") return true;
  if (source === target) return true;
  if (target === "array" && (source === "array" || source === "text-list" || source === "number-list")) return true;
  if (source === "array" && (target === "text-list" || target === "number-list")) return true;
  return false;
};

const operationContextTypeAt = (
  path: string,
  inputContract: ContractDefinition | undefined,
  outputContract: ContractDefinition | undefined
): InferredMappingType => {
  try {
    const [source, ...rest] = parseJsonPointer(path);
    const sourcePath = pointerFromSegments(rest);
    if (source === "input") return schemaTypeAt(inputContract, sourcePath);
    if (source === "output") return schemaTypeAt(outputContract, sourcePath);
  } catch {
    return "unknown";
  }
  return "unknown";
};

const routingContextTypeAt = (path: string, eventDataContract: ContractDefinition | undefined): InferredMappingType => {
  try {
    const [root, section, ...rest] = parseJsonPointer(path);
    if (root !== "event") return "unknown";
    if (["id", "type", "source", "subject", "projectId"].includes(section ?? "")) return "text";
    if (section === "tags") return rest.length === 0 ? "text-list" : "text";
    if (section === "data") return schemaTypeAt(eventDataContract, pointerFromSegments(rest));
  } catch {
    return "unknown";
  }
  return "unknown";
};

const findContract = (data: AppData, ref?: VersionedRef): ContractDefinition | undefined =>
  ref ? data.contracts.find((contract) => contract.active && contract.id === ref.id && contract.version === ref.version) : undefined;

const findEventByType = (data: AppData, eventType: string | undefined) =>
  eventType ? data.eventDefinitions.find((event) => event.active && event.eventType === eventType) : undefined;

const findOperation = (data: AppData, ref: VersionedRef | undefined) =>
  ref ? data.operations.find((operation) => operation.active && operation.id === ref.id && operation.version === ref.version) : undefined;

const activeContractKeys = (contracts: ContractDefinition[]) =>
  new Set(contracts.filter((contract) => contract.active).map((contract) => contractKey(contract)));

const hasActiveContract = (contracts: Set<string>, ref?: VersionedRef): boolean =>
  Boolean(ref && contracts.has(refKey(ref)));

const hasOperation = (data: AppData, ref: VersionedRef): boolean =>
  data.operations.some((operation) => operation.active && operation.id === ref.id && operation.version === ref.version);

const hasEventType = (data: AppData, eventType?: string): boolean =>
  Boolean(eventType && data.eventDefinitions.some((event) => event.active && event.eventType === eventType));

const mappingTypeFromContracts = (
  mapping: MappingExpression | undefined,
  inputContract: ContractDefinition | undefined,
  outputContract: ContractDefinition | undefined
): InferredMappingType => {
  return mappingTypeFromExpression(mapping, (path) => operationContextTypeAt(path, inputContract, outputContract));
};

export class WorkspaceValidator {
  validate(data: AppData): WorkspaceValidationResult {
    const diagnostics: WorkspaceDiagnostic[] = [];
    this.validateDuplicateVersioned("contract", data.contracts, diagnostics);
    this.validateDuplicateVersioned("operation", data.operations, diagnostics);
    this.validateDuplicateVersioned("emission-policy", data.emissionPolicies, diagnostics);
    this.validateDuplicateVersioned("loop", data.loopDefinitions, diagnostics);
    this.validateVersionedPaths(data, diagnostics);
    this.validateDuplicateActiveEvents(data, diagnostics);
    this.validateContracts(data, diagnostics);
    this.validateReferences(data, diagnostics);
    this.validateLoopConfiguration(data, diagnostics);
    this.validateRoutingConfiguration(data, diagnostics);
    this.validateEmissionConfiguration(data, diagnostics);
    this.validateRequiredResultHandling(data, diagnostics);
    this.validateAst(data, diagnostics);
    return {
      valid: !diagnostics.some((diagnostic) => diagnostic.severity === "error"),
      diagnostics
    };
  }

  safeDelete(data: AppData, target: WorkspaceReference): SafeDeleteResult {
    const references: WorkspaceReference[] = [];
    const targetKey = target.version === undefined ? target.id : `${target.id}@${target.version}`;
    if (target.type === "contract") {
      for (const event of data.eventDefinitions) {
        if (event.dataContract && refKey(event.dataContract) === targetKey) references.push({ type: "event", id: event.id, label: event.name });
      }
      for (const operation of data.operations) {
        if (refKey(operation.inputContract) === targetKey || refKey(operation.outputContract) === targetKey) references.push({ type: "operation", id: operation.id, version: operation.version, label: operation.name });
      }
    }
    if (target.type === "event") {
      const eventType = data.eventDefinitions.find((event) => event.id === target.id)?.eventType ?? target.id;
      for (const policy of data.policies) {
        if (policy.consumes.eventType === eventType) references.push({ type: "routing-policy", id: policy.id, label: policy.name });
      }
      for (const policy of data.emissionPolicies) {
        if (policy.emissions.some((emission) => emission.eventType === eventType)) references.push({ type: "emission-policy", id: policy.id, version: policy.version, label: policy.name });
      }
      for (const loop of data.loopDefinitions) {
        if (loop.entryEventTypes.includes(eventType) || loop.terminalEventTypes.includes(eventType) || loop.onLimitExceeded?.eventType === eventType) {
          references.push({ type: "loop", id: loop.id, version: loop.version, label: loop.name });
        }
      }
    }
    if (target.type === "operation") {
      for (const policy of data.policies) {
        if (refKey(policy.dispatch.operation) === targetKey) references.push({ type: "routing-policy", id: policy.id, label: policy.name });
      }
      for (const policy of data.emissionPolicies) {
        if (refKey(policy.observes.operation) === targetKey) references.push({ type: "emission-policy", id: policy.id, version: policy.version, label: policy.name });
      }
    }
    if (target.type === "agent") {
      for (const operation of data.operations) {
        if (operation.agentId === target.id) references.push({ type: "operation", id: operation.id, version: operation.version, label: operation.name });
      }
    }
    if (target.type === "runtime") {
      for (const agent of data.agents) {
        if (agent.frontmatter?.runtime === target.id) references.push({ type: "agent", id: agent.id, label: agent.name });
      }
    }
    if (target.type === "skill") {
      for (const agent of data.agents) {
        if (agent.skills.some((skill) => skill.id === target.id)) references.push({ type: "agent", id: agent.id, label: agent.name });
      }
    }
    if (target.type === "routing-policy") {
      for (const loop of data.loopDefinitions) {
        if (loop.routingPolicyIds.includes(target.id)) references.push({ type: "loop", id: loop.id, version: loop.version, label: loop.name });
      }
    }
    if (target.type === "emission-policy") {
      for (const loop of data.loopDefinitions) {
        if (loop.emissionPolicyIds.includes(target.id)) references.push({ type: "loop", id: loop.id, version: loop.version, label: loop.name });
      }
    }

    const diagnostics: WorkspaceDiagnostic[] = references.map((reference) => ({
      severity: "error",
      title: "Resource is still in use",
      explanation: `${target.label} is referenced by ${reference.label}. Remove that reference before deleting or deactivating it.`,
      resource: reference,
      suggestedFix: "Open the referencing resource and select a replacement or remove the dependency."
    }));
    return { allowed: references.length === 0, references, diagnostics };
  }

  private validateDuplicateVersioned(
    type: WorkspaceReference["type"],
    items: Array<{ id: string; version: number; name?: string }>,
    diagnostics: WorkspaceDiagnostic[]
  ) {
    const seen = new Set<string>();
    for (const item of items) {
      if (!item.id || !Number.isInteger(item.version) || item.version < 1) {
        addDiagnostic(diagnostics, "error", "Invalid versioned identity", `${type} must have an ID and a positive integer version.`, { type, id: item.id || "(missing)", version: item.version, label: item.name || item.id || "(missing)" });
        continue;
      }
      const key = `${item.id}@${item.version}`;
      if (seen.has(key)) {
        addDiagnostic(diagnostics, "error", "Duplicate version", `${type} ${key} is defined more than once.`, { type, id: item.id, version: item.version, label: item.name || item.id });
      }
      seen.add(key);
    }
  }

  private validateVersionedPaths(data: AppData, diagnostics: WorkspaceDiagnostic[]) {
    const check = (
      type: WorkspaceReference["type"],
      folder: string,
      item: { id: string; version: number; name?: string; relativePath?: string }
    ) => {
      if (!item.relativePath) return;
      const expected = `${folder}/${slugify(item.id)}.v${item.version}.md`;
      if (item.relativePath !== expected) {
        addDiagnostic(
          diagnostics,
          "error",
          "Versioned file path is ambiguous",
          `${item.name || item.id} is stored at ${item.relativePath}, but versioned resources must use ${expected}.`,
          { type, id: item.id, version: item.version, label: item.name || item.id },
          "Move the resource to the version-aware path before editing it."
        );
      }
    };

    data.contracts.forEach((item) => check("contract", ".ballet/contracts", item));
    data.operations.forEach((item) => check("operation", ".ballet/operations", item));
    data.emissionPolicies.forEach((item) => check("emission-policy", ".ballet/emissions", item));
    data.loopDefinitions.forEach((item) => check("loop", ".ballet/loops", item));
  }

  private validateDuplicateActiveEvents(data: AppData, diagnostics: WorkspaceDiagnostic[]) {
    const seen = new Set<string>();
    for (const event of data.eventDefinitions.filter((definition) => definition.active)) {
      if (!event.eventType) {
        addDiagnostic(diagnostics, "error", "Missing event type", `Event "${event.name}" does not have an event type.`, { type: "event", id: event.id, label: event.name });
        continue;
      }
      if (seen.has(event.eventType)) {
        addDiagnostic(diagnostics, "error", "Duplicate active event type", `More than one active event definition uses ${event.eventType}.`, { type: "event", id: event.id, label: event.name });
      }
      seen.add(event.eventType);
    }
  }

  private validateContracts(data: AppData, diagnostics: WorkspaceDiagnostic[]) {
    try {
      const registry = new ContractRegistry(data.contracts);
      for (const contract of data.contracts) {
        for (const [index, example] of contract.examples.entries()) {
          const validation = registry.validate(contract, example, contract.kind);
          if (!validation.valid) {
            addDiagnostic(diagnostics, "error", "Example does not match data shape", `Example ${index + 1} for ${contract.name} does not match its schema.`, { type: "contract", id: contract.id, version: contract.version, label: contract.name }, "Update the example or create a new version of the data shape.");
          }
        }
      }
      for (const event of data.eventDefinitions) {
        const eventContract = findContract(data, event.dataContract);
        if (!event.dataContract || eventContract?.kind !== "event-data") continue;
        for (const [index, example] of event.examples.entries()) {
          const validation = registry.validate(event.dataContract, example, "event-data");
          if (!validation.valid) {
            addDiagnostic(
              diagnostics,
              "error",
              "Example does not match event data shape",
              `Example ${index + 1} for ${event.name} does not match ${refKey(event.dataContract)}.`,
              { type: "event", id: event.id, label: event.name },
              "Update the example data or choose a compatible data shape."
            );
          }
        }
      }
      for (const loop of data.loopDefinitions) {
        const eventType = loop.onLimitExceeded?.eventType;
        if (!eventType) continue;
        const event = findEventByType(data, eventType);
        if (!event) continue;
        if (!event.dataContract) {
          addDiagnostic(
            diagnostics,
            "error",
            "Invalid limit-exceeded event data shape",
            `${loop.name} publishes ${event.name} when a safety limit is exceeded, but that event has no data shape.`,
            { type: "loop", id: loop.id, version: loop.version, label: loop.name },
            "Choose an event with a data shape that accepts a reason field."
          );
          continue;
        }
        if (findContract(data, event.dataContract)?.kind !== "event-data") continue;
        const validation = registry.validate(event.dataContract, { reason: "Flow safety limit exceeded." }, "event-data");
        if (!validation.valid) {
          addDiagnostic(
            diagnostics,
            "error",
            "Invalid limit-exceeded event data shape",
            `${loop.name} publishes ${event.name} when a safety limit is exceeded, but ${refKey(event.dataContract)} does not accept the runtime reason payload.`,
            { type: "loop", id: loop.id, version: loop.version, label: loop.name },
            "Update the event data shape to include a text reason field or choose a different limit-exceeded event."
          );
        }
      }
    } catch (error) {
      const message = error instanceof ContractRegistryError ? error.message : error instanceof Error ? error.message : String(error);
      addDiagnostic(diagnostics, "error", "Invalid data shape", message, { type: "contract", id: "workspace", label: "Contracts" });
    }
  }

  private validateReferences(data: AppData, diagnostics: WorkspaceDiagnostic[]) {
    const contracts = activeContractKeys(data.contracts);
    for (const event of data.eventDefinitions) {
      if (event.active && !event.dataContract) {
        addDiagnostic(
          diagnostics,
          "error",
          "Missing event data shape",
          `${event.name} is active but does not declare an event data shape.`,
          { type: "event", id: event.id, label: event.name },
          "Choose or create an event data shape before activating this event."
        );
      }
      if (event.dataContract) {
        const dataContract = findContract(data, event.dataContract);
        if (!hasActiveContract(contracts, event.dataContract)) {
          addDiagnostic(diagnostics, "error", "Missing event data shape", `${event.name} references ${refKey(event.dataContract)}, which is not active.`, { type: "event", id: event.id, label: event.name });
        } else if (dataContract?.kind !== "event-data") {
          addDiagnostic(
            diagnostics,
            "error",
            "Wrong event data shape type",
            `${event.name} references ${refKey(event.dataContract)}, but events must use an event data shape.`,
            { type: "event", id: event.id, label: event.name },
            "Choose an event data shape for this event."
          );
        }
      }
    }
    for (const operation of data.operations) {
      const agent = data.agents.find((candidate) => candidate.id === operation.agentId);
      if (!agent) {
        addDiagnostic(diagnostics, "error", "Missing agent", `${operation.name} references missing agent ${operation.agentId}.`, { type: "operation", id: operation.id, version: operation.version, label: operation.name });
      } else if (operation.active && !agent.enabled) {
        addDiagnostic(
          diagnostics,
          "error",
          "Disabled agent",
          `${operation.name} references disabled agent ${agent.name}.`,
          { type: "operation", id: operation.id, version: operation.version, label: operation.name },
          "Enable the agent or pause the task before activating this workspace."
        );
      }
      if (!hasActiveContract(contracts, operation.inputContract)) {
        addDiagnostic(diagnostics, "error", "Missing input shape", `${operation.name} references input ${refKey(operation.inputContract)}, which is not active.`, { type: "operation", id: operation.id, version: operation.version, label: operation.name });
      } else if (findContract(data, operation.inputContract)?.kind !== "agent-input") {
        addDiagnostic(
          diagnostics,
          "error",
          "Wrong input shape type",
          `${operation.name} references ${refKey(operation.inputContract)}, but task inputs must use an agent input shape.`,
          { type: "operation", id: operation.id, version: operation.version, label: operation.name },
          "Choose an agent input shape for this task."
        );
      }
      if (!hasActiveContract(contracts, operation.outputContract)) {
        addDiagnostic(diagnostics, "error", "Missing output shape", `${operation.name} references output ${refKey(operation.outputContract)}, which is not active.`, { type: "operation", id: operation.id, version: operation.version, label: operation.name });
      } else if (findContract(data, operation.outputContract)?.kind !== "agent-output") {
        addDiagnostic(
          diagnostics,
          "error",
          "Wrong output shape type",
          `${operation.name} references ${refKey(operation.outputContract)}, but task outputs must use an agent output shape.`,
          { type: "operation", id: operation.id, version: operation.version, label: operation.name },
          "Choose an agent output shape for this task."
        );
      }
    }
    for (const policy of data.policies) {
      if (!hasEventType(data, policy.consumes.eventType)) {
        addDiagnostic(diagnostics, "error", "Missing trigger", `${policy.name} consumes ${policy.consumes.eventType}, which is not an active event.`, { type: "routing-policy", id: policy.id, label: policy.name });
      }
      if (!hasOperation(data, policy.dispatch.operation)) {
        addDiagnostic(diagnostics, "error", "Missing target task", `${policy.name} dispatches to ${refKey(policy.dispatch.operation)}, which is not an active task.`, { type: "routing-policy", id: policy.id, label: policy.name });
      }
    }
    for (const policy of data.emissionPolicies) {
      if (!hasOperation(data, policy.observes.operation)) {
        addDiagnostic(diagnostics, "error", "Missing observed task", `${policy.name} observes ${refKey(policy.observes.operation)}, which is not an active task.`, { type: "emission-policy", id: policy.id, version: policyVersion(policy), label: policy.name });
      }
      const slots = new Set<string>();
      for (const emission of policy.emissions) {
        if (slots.has(emission.slot)) {
          addDiagnostic(diagnostics, "error", "Duplicate result branch", `${policy.name} has more than one branch named ${emission.slot}.`, { type: "emission-policy", id: policy.id, version: policy.version, label: policy.name });
        }
        slots.add(emission.slot);
        if (!hasEventType(data, emission.eventType)) {
          addDiagnostic(diagnostics, "error", "Missing emitted event", `${policy.name} emits ${emission.eventType}, which is not an active event.`, { type: "emission-policy", id: policy.id, version: policy.version, label: policy.name });
        }
      }
    }
    for (const loop of data.loopDefinitions) {
      for (const eventType of [...loop.entryEventTypes, ...loop.terminalEventTypes, loop.onLimitExceeded?.eventType].filter(Boolean) as string[]) {
        if (!hasEventType(data, eventType)) {
          addDiagnostic(diagnostics, "error", "Missing Flow event", `${loop.name} references ${eventType}, which is not an active event.`, { type: "loop", id: loop.id, version: loop.version, label: loop.name });
        }
      }
      for (const policyId of loop.routingPolicyIds) {
        const policy = data.policies.find((candidate) => candidate.id === policyId);
        if (!policy) {
          addDiagnostic(diagnostics, "error", "Missing routing rule", `${loop.name} includes missing routing rule ${policyId}.`, { type: "loop", id: loop.id, version: loop.version, label: loop.name });
        } else if (loop.active && !policy.active) {
          addDiagnostic(
            diagnostics,
            "error",
            "Inactive routing rule",
            `${loop.name} is active but includes inactive routing rule ${policy.name}.`,
            { type: "loop", id: loop.id, version: loop.version, label: loop.name },
            "Activate the Flow from the Flow page so included routing rules are activated together."
          );
        }
      }
      for (const policyId of loop.emissionPolicyIds) {
        const matchingPolicies = data.emissionPolicies.filter((candidate) => candidate.id === policyId);
        const activePolicies = matchingPolicies.filter((candidate) => candidate.active);
        const policy = matchingPolicies[0];
        if (!policy) {
          addDiagnostic(diagnostics, "error", "Missing emission rule", `${loop.name} includes missing emission rule ${policyId}.`, { type: "loop", id: loop.id, version: loop.version, label: loop.name });
        } else if (loop.active && activePolicies.length > 1) {
          addDiagnostic(
            diagnostics,
            "error",
            "Ambiguous emission rule version",
            `${loop.name} includes ${policyId}, but multiple active versions exist. Pause old versions or create a Flow membership that selects one version.`,
            { type: "loop", id: loop.id, version: loop.version, label: loop.name },
            "Keep only one active version of the emission rule for this Flow."
          );
        } else if (loop.active && activePolicies.length === 0) {
          addDiagnostic(
            diagnostics,
            "error",
            "Inactive emission rule",
            `${loop.name} is active but includes inactive emission rule ${policy.name}.`,
            { type: "loop", id: loop.id, version: loop.version, label: loop.name },
            "Activate the Flow from the Flow page so included emission rules are activated together."
          );
        }
      }
    }
  }

  private validateRequiredResultHandling(data: AppData, diagnostics: WorkspaceDiagnostic[]) {
    for (const policy of data.policies.filter((candidate) => candidate.active)) {
      const operation = findOperation(data, policy.dispatch.operation);
      if (!operation?.emissionRequired) continue;
      const activeResultHandlers = data.emissionPolicies.filter((candidate) =>
        candidate.active &&
        candidate.observes.operation.id === operation.id &&
        candidate.observes.operation.version === operation.version &&
        candidate.emissions.length > 0
      );
      if (activeResultHandlers.length > 0) continue;
      addDiagnostic(
        diagnostics,
        "error",
        "Missing result handling",
        `${policy.name} starts ${operation.name}, but that task requires a result event and no active emission rule publishes one.`,
        { type: "routing-policy", id: policy.id, label: policy.name },
        "Activate or create an emission rule for this task before accepting matching trigger events."
      );
    }
  }

  private validateRoutingConfiguration(data: AppData, diagnostics: WorkspaceDiagnostic[]) {
    for (const policy of data.policies) {
      const resource = { type: "routing-policy" as const, id: policy.id, label: policy.name };
      if (policy.onInvalidInput !== undefined && policy.onInvalidInput !== "skip" && policy.onInvalidInput !== "reject-event") {
        addDiagnostic(
          diagnostics,
          "error",
          "Invalid routing failure behavior",
          `${policy.name} must either skip invalid input or reject the triggering event.`,
          resource,
          "Open the routing rule and choose a supported invalid-input behavior."
        );
      }
      if (policy.selection !== undefined && !isRecord(policy.selection)) {
        addDiagnostic(
          diagnostics,
          "error",
          "Invalid routing selection",
          `${policy.name} selection settings must be an object.`,
          resource,
          "Open the routing rule and choose fan-out or exclusive selection."
        );
        continue;
      }
      if (policy.selection) {
        if (policy.selection.mode !== "fanout" && policy.selection.mode !== "exclusive") {
          addDiagnostic(
            diagnostics,
            "error",
            "Invalid routing selection",
            `${policy.name} selection mode must be fan-out or exclusive.`,
            resource,
            "Open the routing rule and choose fan-out or exclusive selection."
          );
        }
        if (policy.selection.group !== undefined && typeof policy.selection.group !== "string") {
          addDiagnostic(
            diagnostics,
            "error",
            "Invalid routing selection",
            `${policy.name} exclusive group must be text.`,
            resource,
            "Use a text label for the exclusive routing group."
          );
        }
      }
    }
  }

  private validateEmissionConfiguration(data: AppData, diagnostics: WorkspaceDiagnostic[]) {
    const gateTypes = new Set(["git_commit_exists", "no_failed_checks", "required_value"]);
    for (const policy of data.emissionPolicies) {
      const resource = { type: "emission-policy" as const, id: policy.id, version: policy.version, label: policy.name };
      if (policy.onGateFailure !== undefined && policy.onGateFailure !== "skip" && policy.onGateFailure !== "fail_run") {
        addDiagnostic(
          diagnostics,
          "error",
          "Invalid gate failure behavior",
          `${policy.name} must either skip publishing or fail the run when a technical gate fails.`,
          resource,
          "Open the emission rule and choose a supported gate-failure behavior."
        );
      }
      if (policy.gates !== undefined && !Array.isArray(policy.gates)) {
        addDiagnostic(
          diagnostics,
          "error",
          "Invalid technical gate",
          `${policy.name} technical gates must be a list.`,
          resource,
          "Open the emission builder and configure technical checks as gate rows."
        );
        continue;
      }
      for (const [index, gate] of (policy.gates ?? []).entries()) {
        if (!isRecord(gate)) {
          addDiagnostic(diagnostics, "error", "Invalid technical gate", `${policy.name} gate ${index + 1} must be an object.`, resource, "Open the emission builder and remove or replace the invalid gate.");
          continue;
        }
        const type = gate.type;
        if (typeof type !== "string" || !gateTypes.has(type)) {
          addDiagnostic(
            diagnostics,
            "error",
            "Invalid technical gate",
            `${policy.name} gate ${index + 1} has unsupported type ${String(type || "(missing)")}.`,
            resource,
            "Choose Git commit exists, no failed checks, or required value."
          );
        }
        if (typeof gate.path !== "string") {
          addDiagnostic(diagnostics, "error", "Invalid technical gate", `${policy.name} gate ${index + 1} must point to an input or output field.`, resource, "Choose a field for the technical check.");
        } else {
          try {
            parseJsonPointer(gate.path);
          } catch (error) {
            addDiagnostic(diagnostics, "error", "Invalid technical gate", error instanceof Error ? error.message : String(error), resource, "Choose a valid field for the technical check.");
          }
        }
        if (type === "no_failed_checks" && "required" in gate && typeof gate.required !== "boolean") {
          addDiagnostic(
            diagnostics,
            "error",
            "Invalid technical gate",
            `${policy.name} gate ${index + 1} required setting must be true or false.`,
            resource,
            "Use the technical gate controls to choose whether checks are required."
          );
        }
      }
      for (const [index, emission] of policy.emissions.entries()) {
        const branchLabel = typeof emission.slot === "string" && emission.slot.trim() ? emission.slot : `branch ${index + 1}`;
        if (typeof emission.slot !== "string" || !emission.slot.trim()) {
          addDiagnostic(
            diagnostics,
            "error",
            "Invalid result branch",
            `${policy.name} result branch ${index + 1} must have a branch name.`,
            resource,
            "Open the emission builder and name every result branch."
          );
        }
        if (typeof emission.eventType !== "string" || !emission.eventType.trim()) {
          addDiagnostic(
            diagnostics,
            "error",
            "Invalid result branch",
            `${policy.name} ${branchLabel} must publish a named event.`,
            resource,
            "Choose the event published by this result branch."
          );
        }
        if (emission.dedupeKey === undefined) continue;
        if (!isRecord(emission.dedupeKey)) {
          addDiagnostic(
            diagnostics,
            "error",
            "Invalid deduplication key",
            `${policy.name} ${branchLabel} deduplication key must be configured as a template.`,
            resource,
            "Use the emission builder to configure the deduplication summary."
          );
          continue;
        }
        if (typeof emission.dedupeKey.template !== "string" || !emission.dedupeKey.template.trim()) {
          addDiagnostic(
            diagnostics,
            "error",
            "Invalid deduplication key",
            `${policy.name} ${branchLabel} deduplication template must be text.`,
            resource,
            "Use a text template for the deduplication key."
          );
          continue;
        }
        for (const match of emission.dedupeKey.template.matchAll(/\{\{([^}]+)\}\}/g)) {
          const sourcePath = match[1]?.trim() ?? "";
          try {
            parseJsonPointer(sourcePath);
          } catch (error) {
            addDiagnostic(
              diagnostics,
              "error",
              "Invalid deduplication key",
              error instanceof Error ? error.message : String(error),
              resource,
              "Use JSON Pointer placeholders such as {{/run/id}} in the deduplication template."
            );
          }
        }
      }
    }
  }

  private validateLoopConfiguration(data: AppData, diagnostics: WorkspaceDiagnostic[]) {
    const validateWholeNumber = (
      value: unknown,
      min: number,
      label: string,
      loop: AppData["loopDefinitions"][number],
      diagnostics: WorkspaceDiagnostic[]
    ) => {
      if (typeof value === "number" && Number.isInteger(value) && value >= min) return;
      addDiagnostic(
        diagnostics,
        "error",
        "Invalid Flow safety limit",
        `${loop.name} ${label} must be a whole number greater than or equal to ${min}.`,
        { type: "loop", id: loop.id, version: loop.version, label: loop.name },
        "Open Flow settings and enter whole-number safety limits."
      );
    };

    for (const loop of data.loopDefinitions) {
      const limits = isRecord(loop.limits) ? loop.limits : undefined;
      validateWholeNumber(limits?.maxHops, 0, "maximum steps", loop, diagnostics);
      validateWholeNumber(limits?.maxRuns, 0, "maximum agent runs", loop, diagnostics);
      validateWholeNumber(limits?.maxIterationsPerStep, 0, "maximum repetitions of one step", loop, diagnostics);
      if (limits && "deadlineSeconds" in limits && limits.deadlineSeconds !== undefined) {
        validateWholeNumber(limits.deadlineSeconds, 1, "maximum duration", loop, diagnostics);
      }
    }
  }

  private validateAst(data: AppData, diagnostics: WorkspaceDiagnostic[]) {
    const validateCondition = (condition: Condition | undefined, resource: WorkspaceReference) => {
      if (!condition) return;
      try {
        assertCondition(condition);
      } catch (error) {
        addDiagnostic(diagnostics, "error", "Invalid condition", error instanceof Error ? error.message : String(error), resource, "Open the condition builder and fix the invalid rule.");
      }
    };
    const validateMapping = (mapping: MappingExpression | undefined, resource: WorkspaceReference, label: string) => {
      if (mapping === undefined) return;
      try {
        assertMappingExpression(mapping, label);
      } catch (error) {
        addDiagnostic(diagnostics, "error", "Invalid field mapping", error instanceof Error ? error.message : String(error), resource, "Open the mapping builder and fix the invalid mapping.");
      }
    };
    const validateRequiredTargets = (mapping: MappingExpression | undefined, contract: ContractDefinition | undefined, resource: WorkspaceReference, label: string) => {
      const fields = mappedObjectFields(mapping);
      if (!fields) return;
      for (const field of requiredObjectFields(contract)) {
        if (!fields.has(field)) {
          addDiagnostic(
            diagnostics,
            "error",
            "Missing required field mapping",
            `${label} must map required field ${field}.`,
            resource,
            "Open the mapping builder and map every required target field."
          );
        }
      }
    };
    const validateMappedFieldTypes = (
      mapping: MappingExpression | undefined,
      contract: ContractDefinition | undefined,
      sourceTypeAt: (path: string) => InferredMappingType,
      resource: WorkspaceReference,
      label: string
    ) => {
      if (!mapping || !("object" in mapping) || !isRecord(mapping.object)) return;
      for (const [field, fieldMapping] of Object.entries(mapping.object)) {
        const targetType = schemaTypeAt(contract, `/${escapeJsonPointerSegment(field)}`);
        const sourceType = mappingTypeFromExpression(fieldMapping, sourceTypeAt);
        if (mappingTypesCompatible(sourceType, targetType)) continue;
        addDiagnostic(
          diagnostics,
          "error",
          "Incompatible field mapping",
          `${label} field ${field} maps a ${mappingTypeLabel(sourceType)} value, but the target field expects ${mappingTypeLabel(targetType)}.`,
          resource,
          "Open the mapping builder and choose a source field or constant with a compatible type."
        );
      }
    };
    const validateSubjectMapping = (mapping: MappingExpression | undefined, resource: WorkspaceReference, label: string, inputContract?: ContractDefinition, outputContract?: ContractDefinition) => {
      if (!mapping) return;
      if ("const" in mapping && typeof mapping.const !== "string") {
        addDiagnostic(diagnostics, "error", "Invalid subject mapping", `${label} must produce text.`, resource, "Map the subject from a text field or use a text constant.");
        return;
      }
      const inferred = mappingTypeFromContracts(mapping, inputContract, outputContract);
      if (inferred !== "unknown" && inferred !== "text") {
        addDiagnostic(diagnostics, "error", "Invalid subject mapping", `${label} maps a ${inferred} value, but subjects must be text.`, resource, "Map the subject from a text field or use a text constant.");
      }
    };
    const validateTagMapping = (mapping: MappingExpression | undefined, resource: WorkspaceReference, label: string, inputContract?: ContractDefinition, outputContract?: ContractDefinition) => {
      if (!mapping) return;
      if ("const" in mapping && (!Array.isArray(mapping.const) || !mapping.const.every((tag) => typeof tag === "string"))) {
        addDiagnostic(diagnostics, "error", "Invalid tag mapping", `${label} must produce a text list.`, resource, "Map tags from a text-list field or use a list of text constants.");
        return;
      }
      const inferred = mappingTypeFromContracts(mapping, inputContract, outputContract);
      if (inferred !== "unknown" && inferred !== "text-list") {
        addDiagnostic(diagnostics, "error", "Invalid tag mapping", `${label} maps a ${inferred} value, but tags must be a text list.`, resource, "Map tags from a text-list field or use a list of text constants.");
      }
    };

    for (const policy of data.policies) {
      const resource = { type: "routing-policy" as const, id: policy.id, label: policy.name };
      validateCondition(policy.when, resource);
      validateMapping(policy.input, resource, "routing input");
      const operation = findOperation(data, policy.dispatch.operation);
      const inputContract = findContract(data, operation?.inputContract);
      const event = findEventByType(data, policy.consumes.eventType);
      const eventDataContract = findContract(data, event?.dataContract);
      validateRequiredTargets(policy.input, inputContract, resource, "Routing input mapping");
      validateMappedFieldTypes(
        policy.input,
        inputContract,
        (path) => routingContextTypeAt(path, eventDataContract),
        resource,
        "Routing input mapping"
      );
    }
    for (const policy of data.emissionPolicies) {
      const resource = { type: "emission-policy" as const, id: policy.id, version: policy.version, label: policy.name };
      const operation = findOperation(data, policy.observes.operation);
      const inputContract = findContract(data, operation?.inputContract);
      const outputContract = findContract(data, operation?.outputContract);
      validateCondition(policy.when, resource);
      for (const emission of policy.emissions) {
        validateMapping(emission.subject, resource, `${emission.slot} subject`);
        validateMapping(emission.tags, resource, `${emission.slot} tags`);
        validateMapping(emission.data, resource, `${emission.slot} data`);
        validateSubjectMapping(emission.subject, resource, `${emission.slot} subject mapping`, inputContract, outputContract);
        validateTagMapping(emission.tags, resource, `${emission.slot} tag mapping`, inputContract, outputContract);
        const event = findEventByType(data, emission.eventType);
        const eventDataContract = findContract(data, event?.dataContract);
        validateRequiredTargets(emission.data, eventDataContract, resource, `${emission.slot} event data mapping`);
        validateMappedFieldTypes(
          emission.data,
          eventDataContract,
          (path) => operationContextTypeAt(path, inputContract, outputContract),
          resource,
          `${emission.slot} event data mapping`
        );
      }
    }
  }
}

export const workspaceValidator = new WorkspaceValidator();
