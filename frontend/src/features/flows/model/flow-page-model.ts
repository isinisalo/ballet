import type { AppData } from "backend/shared/domain";
import type {
  DataShapeFieldDraft,
  FlowAgentTaskDraft,
  FlowCreateDraft,
  FlowResultEventDraft,
  FlowViewModel
} from "backend/shared/flow";

export const defaultTriggerFields: DataShapeFieldDraft[] = [
  { name: "subject", label: "Subject", type: "text", required: true },
  { name: "goal", label: "Goal", type: "text", required: true },
  { name: "requirements", label: "Requirements", type: "text-list", required: false }
];

export const defaultResultFields: DataShapeFieldDraft[] = [
  { name: "decision", label: "Decision", type: "text", required: false },
  { name: "notes", label: "Notes", type: "text-list", required: false }
];

export const defaultFollowUpInputFields: DataShapeFieldDraft[] = [
  { name: "summary", label: "Summary", type: "text", required: true }
];

export const defaultSafetyLimits = {
  maxHops: "20",
  maxRuns: "20",
  maxIterationsPerStep: "3",
  deadlineSeconds: "86400"
};

export const wholeNumberFromInput = (value: string, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
};

export const optionalPositiveWholeNumberFromInput = (value: string): number | undefined => {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined;
};

export type FlowSelection =
  | { kind: "event"; id: string }
  | { kind: "operation"; id: string }
  | { kind: "routing"; id: string }
  | { kind: "emission"; id: string }
  | { kind: "settings"; id: string };

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export const titleFromKey = (value: string) =>
  value.replace(/[-_.]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\b\w/g, (letter) => letter.toUpperCase());

const pointerSegmentLabel = (path: string) => titleFromKey(path.split("/").at(-1) || path);

const sourcePathLabel = (path: string): string => {
  if (path === "/event/subject") return "Trigger subject";
  if (path === "/event/projectId") return "Trigger project";
  if (path.startsWith("/event/tags/")) return `Trigger tag ${path.split("/").at(-1)}`;
  if (path.startsWith("/event/data/")) return `Trigger data: ${pointerSegmentLabel(path)}`;
  if (path === "/input/subject") return "Agent input subject";
  if (path.startsWith("/input/")) return `Agent input: ${pointerSegmentLabel(path)}`;
  if (path === "/output/summary") return "Agent summary";
  if (path === "/output/status") return "Agent status";
  if (path.startsWith("/output/result/")) return `Result field: ${pointerSegmentLabel(path)}`;
  if (path.startsWith("/output/evidence/")) return `Evidence: ${pointerSegmentLabel(path)}`;
  return pointerSegmentLabel(path);
};

export const valueLabel = (value: unknown): string => {
  if (value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(valueLabel).join(", ");
  return "configured value";
};

export const conditionSummary = (condition: unknown): string => {
  if (!condition) return "Always";
  if (!isRecord(condition)) return "Configured condition";
  if (Array.isArray(condition.all)) return condition.all.map(conditionSummary).join(" and ");
  if (Array.isArray(condition.any)) return condition.any.map(conditionSummary).join(" or ");
  if ("not" in condition) return `Not (${conditionSummary(condition.not)})`;
  if (typeof condition.path !== "string" || typeof condition.op !== "string") return "Configured condition";
  const field = sourcePathLabel(condition.path);
  if (condition.op === "eq") return `${field} is ${valueLabel(condition.value)}`;
  if (condition.op === "neq") return `${field} is not ${valueLabel(condition.value)}`;
  if (condition.op === "in") return `${field} is one of ${valueLabel(condition.value)}`;
  if (condition.op === "contains") return `${field} contains ${valueLabel(condition.value)}`;
  if (condition.op === "exists") return `${field} is present`;
  if (condition.op === "gt") return `${field} is greater than ${valueLabel(condition.value)}`;
  if (condition.op === "gte") return `${field} is at least ${valueLabel(condition.value)}`;
  if (condition.op === "lt") return `${field} is less than ${valueLabel(condition.value)}`;
  if (condition.op === "lte") return `${field} is at most ${valueLabel(condition.value)}`;
  if (condition.op === "matches") return `${field} matches an advanced pattern`;
  return "Configured condition";
};

export const mappingSummary = (mapping: unknown): string => {
  if (!isRecord(mapping)) return "Configured mapping";
  if (typeof mapping.from === "string") {
    const fallback = "default" in mapping ? `, fallback ${valueLabel(mapping.default)}` : "";
    return `${sourcePathLabel(mapping.from)}${fallback}`;
  }
  if ("const" in mapping) return `Constant ${valueLabel(mapping.const)}`;
  if (typeof mapping.template === "string") return "Template value";
  if (Array.isArray(mapping.array)) return `${mapping.array.length} mapped values`;
  if (Array.isArray(mapping.coalesce)) return mapping.coalesce.map(mappingSummary).join(" or ");
  if (isRecord(mapping.object)) return `${Object.keys(mapping.object).length} mapped fields`;
  return "Configured mapping";
};

export const mappingRows = (mapping: unknown): Array<{ target: string; source: string }> => {
  if (!isRecord(mapping) || !isRecord(mapping.object)) return [{ target: "Value", source: mappingSummary(mapping) }];
  return Object.entries(mapping.object).map(([target, expression]) => ({ target: titleFromKey(target), source: mappingSummary(expression) }));
};

const schemaProperties = (schema: unknown) => isRecord(schema) && isRecord(schema.properties) ? schema.properties : {};

const unpointerSegment = (value: string): string => value.replace(/~1/g, "/").replace(/~0/g, "~");

const schemaTypeLabel = (schema: unknown): string => {
  if (!isRecord(schema)) return "value";
  if (schema.type === "array" && isRecord(schema.items)) return `${schemaTypeLabel(schema.items)} list`;
  return typeof schema.type === "string" ? schema.type : "value";
};

export const fieldsFromSchema = (schema: unknown): Array<{ name: string; description?: string; type: string; required: boolean }> => {
  const required = isRecord(schema) && Array.isArray(schema.required) ? schema.required.map(String) : [];
  return Object.entries(schemaProperties(schema)).map(([name, fieldSchema]) => ({
    name,
    description: isRecord(fieldSchema) && typeof fieldSchema.description === "string" ? fieldSchema.description : undefined,
    type: schemaTypeLabel(fieldSchema),
    required: required.includes(name)
  }));
};

export const resultFieldsFromSchema = (schema: unknown) => {
  const properties = schemaProperties(schema);
  const resultSchema = properties.result;
  const evidenceSchema = properties.evidence;
  return [
    ...fieldsFromSchema(resultSchema),
    ...fieldsFromSchema(evidenceSchema).map((field) => ({ ...field, name: `evidence ${field.name}` }))
  ];
};

const dataShapeTypeFromSchema = (schema: unknown): DataShapeFieldDraft["type"] => {
  if (!isRecord(schema)) return "text";
  if (schema.type === "number" || schema.type === "integer") return "number";
  if (schema.type === "boolean") return "boolean";
  if (schema.type === "object") return "object";
  if (schema.type === "array") {
    const itemSchema = schema.items;
    if (isRecord(itemSchema) && (itemSchema.type === "number" || itemSchema.type === "integer")) return "number-list";
    if (isRecord(itemSchema) && itemSchema.type === "object") return "object-list";
    return "text-list";
  }
  return "text";
};

export const dataShapeFieldsFromSchema = (schema: unknown): DataShapeFieldDraft[] => {
  const required = isRecord(schema) && Array.isArray(schema.required) ? schema.required.map(String) : [];
  return Object.entries(schemaProperties(schema)).map(([name, fieldSchema]) => {
    const field = isRecord(fieldSchema) ? fieldSchema : {};
    const enumValues = Array.isArray(field.enum) ? field.enum.filter((value): value is string => typeof value === "string") : [];
    return {
      name,
      label: typeof field.title === "string" ? field.title : titleFromKey(name),
      description: typeof field.description === "string" ? field.description : undefined,
      type: dataShapeTypeFromSchema(field),
      required: required.includes(name),
      ...(enumValues.length ? { allowedValues: enumValues } : {}),
      ...(field.default !== undefined ? { default: field.default } : {}),
      ...(Array.isArray(field.examples) && field.examples.length ? { example: field.examples[0] } : {})
    };
  });
};

export const cloneDataShapeFields = (fields: DataShapeFieldDraft[]): DataShapeFieldDraft[] =>
  fields.map((field) => ({
    ...field,
    ...(field.allowedValues ? { allowedValues: [...field.allowedValues] } : {})
  }));

const findContract = (data: AppData, ref: { id: string; version: number } | undefined) =>
  ref ? data.contracts.find((contract) => contract.id === ref.id && contract.version === ref.version) : undefined;

const recordExample = (example: unknown): Record<string, unknown> | undefined =>
  isRecord(example) ? example : undefined;

const resultFieldsFromOutputContract = (data: AppData, ref: { id: string; version: number } | undefined): DataShapeFieldDraft[] => {
  const contract = findContract(data, ref);
  const fields = dataShapeFieldsFromSchema(schemaProperties(contract?.schema).result);
  return fields.length ? fields : cloneDataShapeFields(defaultResultFields);
};

const inputFieldFromMapping = (mapping: unknown): string | undefined => {
  if (!isRecord(mapping)) return undefined;
  if (typeof mapping.from === "string" && mapping.from.startsWith("/input/")) {
    return unpointerSegment(mapping.from.slice("/input/".length));
  }
  if (Array.isArray(mapping.coalesce)) {
    return mapping.coalesce.map(inputFieldFromMapping).find(Boolean);
  }
  return undefined;
};

const resultEventDraftFromEmission = (
  data: AppData,
  edge: Extract<FlowViewModel["edges"][number], { kind: "emission" }> | undefined
): FlowResultEventDraft | undefined => {
  if (!edge) return undefined;
  const policy = data.emissionPolicies.find((item) => item.id === edge.policyId && item.version === edge.policyVersion);
  const emission = policy?.emissions.find((item) => item.slot === edge.slot) ?? policy?.emissions[0];
  const event = data.eventDefinitions.find((item) => item.eventType === emission?.eventType);
  const contract = findContract(data, event?.dataContract);
  const fields = dataShapeFieldsFromSchema(contract?.schema);
  return {
    name: event?.name ?? edge.policyName.replace(/^Publish\s+/i, ""),
    description: event?.description ?? policy?.description,
    fields: fields.length ? fields : [{ name: "summary", label: "Summary", type: "text", required: true }],
    subjectField: inputFieldFromMapping(emission?.subject) ?? "subject",
    requireSummaryGate: policy?.gates?.some((gate) => gate.type === "required_value" && gate.path === "/output/summary") ?? false,
    onGateFailure: policy?.onGateFailure ?? "fail_run"
  };
};

const primaryFlowSteps = (flow: FlowViewModel) => {
  const nodes = new Map(flow.nodes.map((node) => [node.id, node]));
  const steps: Array<{
    routingEdge: Extract<FlowViewModel["edges"][number], { kind: "routing" }>;
    operationNode: Extract<FlowViewModel["nodes"][number], { kind: "operation" }>;
    emissionEdge?: Extract<FlowViewModel["edges"][number], { kind: "emission" }>;
  }> = [];
  let eventId = flow.entryEvents[0]?.id;
  const visitedEvents = new Set<string>();
  const visitedOperations = new Set<string>();

  while (eventId && !visitedEvents.has(eventId) && steps.length <= flow.edges.length) {
    visitedEvents.add(eventId);
    const routingEdge = flow.edges.find((edge): edge is Extract<FlowViewModel["edges"][number], { kind: "routing" }> =>
      edge.kind === "routing" && edge.from === eventId && !visitedOperations.has(edge.to)
    );
    if (!routingEdge) break;
    const operationNode = nodes.get(routingEdge.to);
    if (!isFlowOperationNode(operationNode)) break;
    visitedOperations.add(operationNode.id);
    const emissionEdge = flow.edges.find((edge): edge is Extract<FlowViewModel["edges"][number], { kind: "emission" }> =>
      edge.kind === "emission" && edge.from === operationNode.id && edge.slot === "completed"
    ) ?? flow.edges.find((edge): edge is Extract<FlowViewModel["edges"][number], { kind: "emission" }> =>
      edge.kind === "emission" && edge.from === operationNode.id
    );
    steps.push({ routingEdge, operationNode, emissionEdge });
    if (!emissionEdge || visitedEvents.has(emissionEdge.to)) break;
    eventId = emissionEdge.to;
  }

  return steps;
};

const taskDraftFromFlowStep = (
  data: AppData,
  step: ReturnType<typeof primaryFlowSteps>[number]
): FlowAgentTaskDraft => {
  const operation = data.operations.find((item) => item.id === step.operationNode.operationId && item.version === step.operationNode.version);
  const inputContract = findContract(data, operation?.inputContract ?? step.operationNode.inputContract);
  const inputFields = dataShapeFieldsFromSchema(inputContract?.schema);
  const routingPolicy = data.policies.find((item) => item.id === step.routingEdge.policyId);
  return {
    agentId: operation?.agentId ?? step.operationNode.agentId,
    name: operation?.name ?? step.operationNode.name,
    instructions: operation?.instructions ?? step.operationNode.description,
    inputFields: inputFields.length ? inputFields : cloneDataShapeFields(defaultTriggerFields),
    resultFields: resultFieldsFromOutputContract(data, operation?.outputContract ?? step.operationNode.outputContract),
    inputMapping: routingPolicy?.input,
    resultEvent: resultEventDraftFromEmission(data, step.emissionEdge)
  };
};

const flowDraftFromFlow = (data: AppData, flow: FlowViewModel, mode: "copy" | "edit"): FlowCreateDraft => {
  const flowName = mode === "copy" ? `Copy of ${flow.name}` : flow.name;
  const entryEvent = flow.entryEvents[0];
  const entryDefinition = data.eventDefinitions.find((event) => event.eventType === entryEvent?.eventType);
  const triggerContract = findContract(data, entryDefinition?.dataContract ?? entryEvent?.dataContract);
  const triggerFields = dataShapeFieldsFromSchema(triggerContract?.schema);
  const steps = primaryFlowSteps(flow);
  const firstTask = steps[0] ? taskDraftFromFlowStep(data, steps[0]) : undefined;
  const followUpTasks = steps.slice(1).map((step) => taskDraftFromFlowStep(data, step));
  const loop = data.loopDefinitions.find((item) => item.id === flow.id && item.version === flow.version)
    ?? data.loopDefinitions.find((item) => item.id === flow.id);
  const limitExceededEvent = data.eventDefinitions.find((event) => event.eventType === loop?.onLimitExceeded?.eventType);

  return {
    ...(mode === "edit" ? { id: flow.id } : {}),
    name: flowName,
    purpose: flow.description || flow.name,
    description: flow.description,
    trigger: {
      name: mode === "copy" && entryDefinition?.name ? `Copy of ${entryDefinition.name}` : entryDefinition?.name ?? entryEvent?.name ?? `${flowName} started`,
      description: entryDefinition?.description ?? entryEvent?.description ?? `Starts ${flowName}.`,
      fields: triggerFields.length ? triggerFields : cloneDataShapeFields(defaultTriggerFields),
      ...(recordExample(entryDefinition?.examples[0]) ? { example: recordExample(entryDefinition?.examples[0]) } : {})
    },
    ...(firstTask ? { agentTask: firstTask, inputMapping: firstTask.inputMapping, resultEvent: firstTask.resultEvent } : {}),
    ...(followUpTasks.length ? { followUpTasks } : {}),
    safetyLimits: {
      maxHops: flow.safetyLimits.maxHops,
      maxRuns: flow.safetyLimits.maxRuns,
      maxIterationsPerStep: flow.safetyLimits.maxIterationsPerStep,
      ...(flow.safetyLimits.deadlineSeconds !== undefined ? { deadlineSeconds: flow.safetyLimits.deadlineSeconds } : {})
    },
    limitExceeded: loop?.onLimitExceeded?.eventType
      ? {
          enabled: true,
          name: mode === "copy" && limitExceededEvent?.name ? `Copy of ${limitExceededEvent.name}` : limitExceededEvent?.name ?? `${flowName} limit exceeded`,
          description: limitExceededEvent?.description ?? `Published when ${flowName} stops because a safety limit is exceeded.`
        }
      : { enabled: false },
    active: mode === "edit" ? flow.active : false
  };
};

export const flowCreateDraftFromFlow = (data: AppData, flow: FlowViewModel): FlowCreateDraft =>
  flowDraftFromFlow(data, flow, "copy");

export const flowEditDraftFromFlow = (data: AppData, flow: FlowViewModel): FlowCreateDraft =>
  flowDraftFromFlow(data, flow, "edit");

export const flowPath = (flow: Pick<FlowViewModel, "id" | "version">): string =>
  `/flows/${encodeURIComponent(flow.id)}?version=${encodeURIComponent(String(flow.version))}`;

export const defaultSelection = (flow?: FlowViewModel): FlowSelection | undefined =>
  flow?.entryEvents[0]
    ? { kind: "event", id: flow.entryEvents[0].id }
    : flow?.nodes[0]
      ? { kind: flow.nodes[0].kind, id: flow.nodes[0].id }
      : flow
        ? { kind: "settings", id: flow.id }
        : undefined;

export const selectionExists = (flow: FlowViewModel, selection?: FlowSelection): boolean => {
  if (!selection) return false;
  if (selection.kind === "settings") return selection.id === flow.id;
  if (selection.kind === "routing" || selection.kind === "emission") return flow.edges.some((edge) => edge.id === selection.id && edge.kind === selection.kind);
  return flow.nodes.some((node) => node.id === selection.id && node.kind === selection.kind);
};

export const isFlowEventNode = (node: FlowViewModel["nodes"][number] | undefined): node is Extract<FlowViewModel["nodes"][number], { kind: "event" }> =>
  node?.kind === "event";

export const isFlowOperationNode = (node: FlowViewModel["nodes"][number] | undefined): node is Extract<FlowViewModel["nodes"][number], { kind: "operation" }> =>
  node?.kind === "operation";

export const isFlowRoutingEdge = (edge: FlowViewModel["edges"][number] | undefined): edge is Extract<FlowViewModel["edges"][number], { kind: "routing" }> =>
  edge?.kind === "routing";

export const isFlowEmissionEdge = (edge: FlowViewModel["edges"][number] | undefined): edge is Extract<FlowViewModel["edges"][number], { kind: "emission" }> =>
  edge?.kind === "emission";
