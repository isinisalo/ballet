import type { DataShapeFieldDraft } from "backend/shared/flow";

export const fieldTypes: Array<{ value: DataShapeFieldDraft["type"]; label: string }> = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "True or false" },
  { value: "text-list", label: "Text list" },
  { value: "number-list", label: "Number list" },
  { value: "object", label: "Object" },
  { value: "object-list", label: "Object list" }
];

export const defaultField = (): DataShapeFieldDraft => ({
  name: "",
  label: "",
  description: "",
  type: "text",
  required: false
});

export const valueToInput = (value: unknown, type: DataShapeFieldDraft["type"]): string => {
  if (value === undefined) return "";
  if (type === "object" || type === "object-list") return typeof value === "string" ? value : JSON.stringify(value);
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
};

export const parseFieldValue = (raw: string, type: DataShapeFieldDraft["type"]): unknown => {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (type === "number") {
    const value = Number(trimmed);
    return Number.isFinite(value) ? value : raw;
  }
  if (type === "boolean") {
    if (trimmed.toLowerCase() === "true") return true;
    if (trimmed.toLowerCase() === "false") return false;
    return raw;
  }
  if (type === "text-list") return raw.split(",").map((item) => item.trim()).filter(Boolean);
  if (type === "number-list") {
    const values = raw.split(",").map((item) => item.trim()).filter(Boolean);
    const numbers = values.map(Number);
    return numbers.every(Number.isFinite) ? numbers : raw;
  }
  if (type === "object" || type === "object-list") {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return raw;
    }
  }
  return raw;
};

export const parseAllowedValues = (raw: string): string[] => raw.trim()
  ? raw.split(",").map((item) => item.trim()).filter(Boolean)
  : [];

const valueTypeError = (label: string, value: unknown, type: DataShapeFieldDraft["type"]): string | undefined => {
  if (value === undefined) return undefined;
  if (type === "number" && typeof value !== "number") return `${label} must be a number.`;
  if (type === "boolean" && typeof value !== "boolean") return `${label} must be true or false.`;
  if (type === "text-list" && (!Array.isArray(value) || !value.every((item) => typeof item === "string"))) return `${label} must be a comma-separated text list.`;
  if (type === "number-list" && (!Array.isArray(value) || !value.every((item) => typeof item === "number"))) return `${label} must be a comma-separated number list.`;
  if (type === "object" && (!value || typeof value !== "object" || Array.isArray(value))) return `${label} must be a JSON object.`;
  if (type === "object-list" && (!Array.isArray(value) || !value.every((item) => Boolean(item) && typeof item === "object" && !Array.isArray(item)))) return `${label} must be a JSON array of objects.`;
  return undefined;
};

export const fieldErrors = (field: DataShapeFieldDraft, fields: DataShapeFieldDraft[], index: number): string[] => {
  const errors: string[] = [];
  const name = field.name.trim();
  if (!name) errors.push("Field name is required.");
  else if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(name)) errors.push("Field name can use letters, numbers, underscores, or hyphens.");
  if (name && fields.some((candidate, candidateIndex) => candidateIndex !== index && candidate.name.trim() === name)) {
    errors.push(`${name} is already used by another field.`);
  }
  if (field.allowedValues?.length && field.type !== "text") {
    errors.push("Allowed values are currently supported for text fields.");
  }
  const defaultError = valueTypeError("Default", field.default, field.type);
  const exampleError = valueTypeError("Example", field.example, field.type);
  if (defaultError) errors.push(defaultError);
  if (exampleError) errors.push(exampleError);
  return errors;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export const fieldsFromObjectSchema = (schema: Record<string, unknown>): DataShapeFieldDraft[] => {
  const properties = isRecord(schema.properties) ? schema.properties : {};
  const required = new Set(Array.isArray(schema.required) ? schema.required.map(String) : []);
  return Object.entries(properties).map(([name, property]) => {
    const propertySchema = isRecord(property) ? property : {};
    const examples = Array.isArray(propertySchema.examples) ? propertySchema.examples : [];
    return {
      name,
      label: typeof propertySchema.title === "string" ? propertySchema.title : name,
      description: typeof propertySchema.description === "string" ? propertySchema.description : "",
      type: schemaFieldType(propertySchema),
      required: required.has(name),
      allowedValues: Array.isArray(propertySchema.enum) ? propertySchema.enum.map(String) : undefined,
      default: propertySchema.default,
      example: examples[0]
    };
  });
};

export const objectSchemaFromFields = (fields: DataShapeFieldDraft[]): Record<string, unknown> => ({
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: false,
  required: fields.filter((field) => field.required).map((field) => field.name),
  properties: Object.fromEntries(fields.filter((field) => field.name).map((field) => [field.name, fieldSchema(field)]))
});

const nestedObjectSchemaFromFields = (fields: DataShapeFieldDraft[]): Record<string, unknown> => {
  return {
    type: "object",
    additionalProperties: false,
    required: fields.filter((field) => field.required).map((field) => field.name),
    properties: Object.fromEntries(fields.filter((field) => field.name).map((field) => [field.name, fieldSchema(field)]))
  };
};

export const resultFieldsFromAgentOutputSchema = (schema: Record<string, unknown>): DataShapeFieldDraft[] => {
  const properties = isRecord(schema.properties) ? schema.properties : {};
  const result = isRecord(properties.result) ? properties.result : {};
  return result.type === "object" ? fieldsFromObjectSchema(result) : [];
};

export const evidenceFieldsFromAgentOutputSchema = (schema: Record<string, unknown>): DataShapeFieldDraft[] => {
  const properties = isRecord(schema.properties) ? schema.properties : {};
  const evidence = isRecord(properties.evidence) ? properties.evidence : {};
  return evidence.type === "object" ? fieldsFromObjectSchema(evidence) : [];
};

export const agentOutputSchemaFromFields = (
  resultFields: DataShapeFieldDraft[],
  evidenceFields: DataShapeFieldDraft[] = []
): Record<string, unknown> => ({
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: false,
  required: ["status", "summary"],
  properties: {
    status: {
      title: "Status",
      type: "string",
      enum: ["completed", "blocked", "needs_input", "failed"]
    },
    summary: {
      title: "Summary",
      type: "string"
    },
    result: nestedObjectSchemaFromFields(resultFields),
    evidence: nestedObjectSchemaFromFields(evidenceFields)
  }
});

export const exampleForField = (field: DataShapeFieldDraft): unknown => {
  if (field.example !== undefined) return field.example;
  if (field.default !== undefined) return field.default;
  if (field.allowedValues?.length) return field.allowedValues[0];
  if (field.type === "number") return 1;
  if (field.type === "boolean") return true;
  if (field.type === "text-list") return ["Example"];
  if (field.type === "number-list") return [1];
  if (field.type === "object") return { value: "Example" };
  if (field.type === "object-list") {
    return field.name.toLowerCase().includes("check")
      ? [{ name: "example", status: "passed" }]
      : [{ value: "Example" }];
  }
  return field.label || field.name || "Example";
};

export const exampleFromFields = (fields: DataShapeFieldDraft[]): Record<string, unknown> =>
  Object.fromEntries(fields.filter((field) => field.name).map((field) => [field.name, exampleForField(field)]));

export const agentOutputExampleFromFields = (
  resultFields: DataShapeFieldDraft[],
  evidenceFields: DataShapeFieldDraft[] = []
): Record<string, unknown> => ({
  status: "completed",
  summary: "Dry-run completed",
  result: exampleFromFields(resultFields),
  evidence: exampleFromFields(evidenceFields)
});

const schemaFieldType = (schema: Record<string, unknown>): DataShapeFieldDraft["type"] => {
  if (schema.type === "number" || schema.type === "integer") return "number";
  if (schema.type === "boolean") return "boolean";
  if (schema.type === "array" && isRecord(schema.items)) {
    if (schema.items.type === "number" || schema.items.type === "integer") return "number-list";
    if (schema.items.type === "object") return "object-list";
    return "text-list";
  }
  if (schema.type === "object") return "object";
  return "text";
};

const fieldSchema = (field: DataShapeFieldDraft): Record<string, unknown> => {
  const base: Record<string, unknown> = {};
  if (field.label) base.title = field.label;
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
