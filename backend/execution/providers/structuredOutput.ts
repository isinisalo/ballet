const record = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;

export interface StructuredOutputResult {
  value?: unknown;
  error?: string;
}

export const parseStructuredJson = (text: string, schema?: Record<string, unknown>): StructuredOutputResult => {
  const unwrapped = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(unwrapped) as unknown;
  } catch (error) {
    return { error: `invalid JSON: ${error instanceof Error ? error.message : String(error)}` };
  }
  const validationError = schema ? validateSchema(parsed, schema, "$", 0, schema) : undefined;
  return validationError ? { error: validationError } : { value: parsed };
};

const validateSchema = (
  value: unknown,
  schema: Record<string, unknown>,
  location: string,
  depth: number,
  root: Record<string, unknown>
): string | undefined => {
  if (depth > 128) return `${location} exceeds the supported schema nesting depth.`;
  if (typeof schema.$ref === "string") {
    const referenced = resolveReference(root, schema.$ref);
    return referenced ? validateSchema(value, referenced, location, depth + 1, root) : `${location} uses an unsupported schema reference.`;
  }
  const keywordError = validateKeywords(value, schema, location);
  if (keywordError) return keywordError;
  const combinationError = validateCombinations(value, schema, location, depth, root);
  if (combinationError) return combinationError;
  return validateTypedValue(value, schema, location, depth, root);
};

const validateKeywords = (
  value: unknown,
  schema: Record<string, unknown>,
  location: string
): string | undefined => {
  if ("const" in schema && !Object.is(schema.const, value)) return `${location} does not match const.`;
  if (Array.isArray(schema.enum) && !schema.enum.some((candidate) => Object.is(candidate, value))) {
    return `${location} is not one of the allowed values.`;
  }
  return undefined;
};

const validateCombinations = (
  value: unknown,
  schema: Record<string, unknown>,
  location: string,
  depth: number,
  root: Record<string, unknown>
): string | undefined => {
  const anyOf = schemaAlternatives(schema.anyOf);
  if (anyOf && !anyOf.some((candidate) => !validateSchema(value, candidate, location, depth + 1, root))) {
    return `${location} does not match anyOf.`;
  }
  const oneOf = schemaAlternatives(schema.oneOf);
  if (oneOf && oneOf.filter((candidate) => !validateSchema(value, candidate, location, depth + 1, root)).length !== 1) {
    return `${location} does not match exactly one oneOf branch.`;
  }
  const allOf = schemaAlternatives(schema.allOf);
  if (allOf) {
    for (const candidate of allOf) {
      const error = validateSchema(value, candidate, location, depth + 1, root);
      if (error) return error;
    }
  }
  return undefined;
};

const validateTypedValue = (
  value: unknown,
  schema: Record<string, unknown>,
  location: string,
  depth: number,
  root: Record<string, unknown>
): string | undefined => {
  switch (schema.type) {
    case "object":
      return validateObject(value, schema, location, depth, root);
    case "array":
      return validateArray(value, schema, location, depth, root);
    case "string":
      if (typeof value !== "string") return `${location} must be a string.`;
      if (typeof schema.minLength === "number" && value.length < schema.minLength) return `${location} is shorter than minLength.`;
      if (typeof schema.maxLength === "number" && value.length > schema.maxLength) return `${location} is longer than maxLength.`;
      if (typeof schema.pattern === "string" && !new RegExp(schema.pattern, "u").test(value)) return `${location} does not match pattern.`;
      return undefined;
    case "number":
      return validateNumber(value, schema, location, false);
    case "integer":
      return validateNumber(value, schema, location, true);
    case "boolean":
      return typeof value === "boolean" ? undefined : `${location} must be a boolean.`;
    case "null":
      return value === null ? undefined : `${location} must be null.`;
    default:
      return undefined;
  }
};

const validateObject = (
  value: unknown,
  schema: Record<string, unknown>,
  location: string,
  depth: number,
  root: Record<string, unknown>
): string | undefined => {
  const object = record(value);
  if (!object) return `${location} must be an object.`;
  const required = Array.isArray(schema.required) ? schema.required.filter((item): item is string => typeof item === "string") : [];
  for (const key of required) if (!(key in object)) return `${location}.${key} is required.`;
  const properties = record(schema.properties) ?? {};
  if (schema.additionalProperties === false) {
    const unknown = Object.keys(object).find((key) => !(key in properties));
    if (unknown) return `${location}.${unknown} is not allowed.`;
  }
  for (const [key, propertySchema] of Object.entries(properties)) {
    if (!(key in object)) continue;
    const nested = record(propertySchema);
    if (!nested) continue;
    const error = validateSchema(object[key], nested, `${location}.${key}`, depth + 1, root);
    if (error) return error;
  }
  const propertyNames = record(schema.propertyNames);
  if (propertyNames) {
    for (const key of Object.keys(object)) {
      const error = validateSchema(key, propertyNames, `${location} property name`, depth + 1, root);
      if (error) return error;
    }
  }
  const additional = record(schema.additionalProperties);
  if (additional) {
    for (const [key, entry] of Object.entries(object)) {
      if (key in properties) continue;
      const error = validateSchema(entry, additional, `${location}.${key}`, depth + 1, root);
      if (error) return error;
    }
  }
  return undefined;
};

const validateArray = (
  value: unknown,
  schema: Record<string, unknown>,
  location: string,
  depth: number,
  root: Record<string, unknown>
): string | undefined => {
  if (!Array.isArray(value)) return `${location} must be an array.`;
  if (typeof schema.minItems === "number" && value.length < schema.minItems) return `${location} has fewer than minItems entries.`;
  if (typeof schema.maxItems === "number" && value.length > schema.maxItems) return `${location} has more than maxItems entries.`;
  const itemSchema = record(schema.items);
  if (!itemSchema) return undefined;
  for (let index = 0; index < value.length; index += 1) {
    const error = validateSchema(value[index], itemSchema, `${location}[${index}]`, depth + 1, root);
    if (error) return error;
  }
  return undefined;
};

const validateNumber = (
  value: unknown,
  schema: Record<string, unknown>,
  location: string,
  integer: boolean
): string | undefined => {
  if (typeof value !== "number" || !Number.isFinite(value) || (integer && !Number.isInteger(value))) {
    return `${location} must be ${integer ? "an integer" : "a number"}.`;
  }
  if (typeof schema.minimum === "number" && value < schema.minimum) return `${location} is below minimum.`;
  if (typeof schema.maximum === "number" && value > schema.maximum) return `${location} is above maximum.`;
  return undefined;
};

const schemaAlternatives = (value: unknown): Record<string, unknown>[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  return value.reduce<Record<string, unknown>[]>((result, candidate) => {
    const schema = record(candidate);
    if (schema) result.push(schema);
    return result;
  }, []);
};

const resolveReference = (
  root: Record<string, unknown>,
  reference: string
): Record<string, unknown> | undefined => {
  if (!reference.startsWith("#/")) return undefined;
  let current: unknown = root;
  for (const raw of reference.slice(2).split("/")) {
    const key = raw.replace(/~1/g, "/").replace(/~0/g, "~");
    const object = record(current);
    if (!object || !(key in object)) return undefined;
    current = object[key];
  }
  return record(current);
};
