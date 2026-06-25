import type { JsonValue } from "./json.js";
import { assertJsonValue, isJsonValue } from "./json.js";
import { getByJsonPointer } from "./json-pointer.js";

export type MappingExpression =
  | {
      from: string;
      default?: JsonValue;
    }
  | {
      const: JsonValue;
    }
  | {
      object: Record<string, MappingExpression>;
    }
  | {
      array: MappingExpression[];
    }
  | {
      coalesce: MappingExpression[];
    }
  | {
      template: string;
    };

export class MappingEvaluationError extends Error {
  constructor(
    message: string,
    readonly policyId?: string,
    readonly location?: string,
    readonly sourcePath?: string
  ) {
    super([message, policyId ? `policy=${policyId}` : undefined, location ? `location=${location}` : undefined, sourcePath ? `path=${sourcePath}` : undefined].filter(Boolean).join(" "));
    this.name = "MappingEvaluationError";
  }
}

export interface MappingOptions {
  policyId?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const defined = Symbol("defined");
type MaybeMapped = { marker: typeof defined; value: JsonValue } | undefined;

const missing = (message: string, options: MappingOptions, location: string, sourcePath?: string): never => {
  throw new MappingEvaluationError(message, options.policyId, location, sourcePath);
};

const evaluateMaybe = (
  expression: MappingExpression,
  context: unknown,
  options: MappingOptions,
  location: string
): MaybeMapped => {
  if ("from" in expression) {
    if (typeof expression.from !== "string") missing("Mapping source must be a JSON Pointer.", options, location);
    const lookup = getByJsonPointer(context, expression.from);
    if (!lookup.found) {
      if ("default" in expression) return { marker: defined, value: assertJsonValue(expression.default, `${location}.default`) };
      missing("Required mapping source is missing.", options, location, expression.from);
    }
    return { marker: defined, value: assertJsonValue(lookup.value, location) };
  }

  if ("const" in expression) {
    return { marker: defined, value: assertJsonValue(expression.const, location) };
  }

  if ("object" in expression) {
    if (!isRecord(expression.object)) missing("object mapping must contain a mapping object.", options, location);
    const value: Record<string, JsonValue> = {};
    for (const [key, child] of Object.entries(expression.object)) {
      value[key] = evaluateMapping(child, context, options, `${location}.object.${key}`);
    }
    return { marker: defined, value };
  }

  if ("array" in expression) {
    if (!Array.isArray(expression.array)) missing("array mapping must contain an array.", options, location);
    return {
      marker: defined,
      value: expression.array.map((child, index) => evaluateMapping(child, context, options, `${location}.array[${index}]`))
    };
  }

  if ("coalesce" in expression) {
    if (!Array.isArray(expression.coalesce)) missing("coalesce mapping must contain an array.", options, location);
    for (const [index, child] of expression.coalesce.entries()) {
      try {
        const result = evaluateMaybe(child, context, options, `${location}.coalesce[${index}]`);
        if (result) return result;
      } catch (error) {
        if (!(error instanceof MappingEvaluationError) || !error.message.includes("Required mapping source is missing.")) throw error;
      }
    }
    return undefined;
  }

  if ("template" in expression) {
    if (typeof expression.template !== "string") missing("template mapping must be a string.", options, location);
    const value = expression.template.replace(/\{\{([^}]+)\}\}/g, (_match, rawPath: string) => {
      const sourcePath = rawPath.trim();
      const lookup = getByJsonPointer(context, sourcePath);
      if (!lookup.found) missing("Template placeholder source is missing.", options, location, sourcePath);
      if (lookup.value === null || ["string", "number", "boolean"].includes(typeof lookup.value)) return String(lookup.value);
      return JSON.stringify(lookup.value);
    });
    return { marker: defined, value };
  }

  missing("Unknown mapping expression.", options, location);
};

export const evaluateMapping = (
  expression: MappingExpression,
  context: unknown,
  options: MappingOptions = {},
  location = "mapping"
): JsonValue => {
  const result = evaluateMaybe(expression, context, options, location);
  if (!result) return missing("Mapping did not produce a value.", options, location);
  const value = (result as { value: JsonValue }).value;
  if (!isJsonValue(value)) missing("Mapping produced a non-JSON value.", options, location);
  return value;
};
