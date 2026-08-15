import { createHash } from "node:crypto";
import type { JsonValue } from "../../../shared/domain/automation.js";

export class RuntimeJsonValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuntimeJsonValidationError";
  }
}

export function assertJsonValue(
  value: unknown,
  options: { label?: string; maxBytes?: number; maxDepth?: number } = {}
): asserts value is JsonValue {
  const label = options.label ?? "JSON value";
  validateValue(value, label, 0, options.maxDepth, new Set<object>());
  const bytes = Buffer.byteLength(canonicalJson(value), "utf8");
  if (options.maxBytes !== undefined && bytes > options.maxBytes) {
    throw new RuntimeJsonValidationError(`${label} is ${bytes} bytes; the maximum is ${options.maxBytes} bytes.`);
  }
}

export const parseJsonValue = (
  source: string,
  label: string,
  options: { maxBytes?: number; maxDepth?: number } = {}
): JsonValue => {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch (error) {
    throw new RuntimeJsonValidationError(
      `${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  assertJsonValue(value, { label, ...options });
  return value;
};

export const canonicalJson = (value: JsonValue): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) =>
    `${JSON.stringify(key)}:${canonicalJson(value[key]!)}`).join(",")}}`;
};

export const jsonSha256 = (value: JsonValue): string =>
  createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");

function validateValue(
  value: unknown,
  path: string,
  depth: number,
  maxDepth: number | undefined,
  ancestors: Set<object>
): asserts value is JsonValue {
  if (maxDepth !== undefined && depth > maxDepth) {
    throw new RuntimeJsonValidationError(`${path} exceeds the maximum JSON depth of ${maxDepth}.`);
  }
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new RuntimeJsonValidationError(`${path} contains a non-finite number.`);
    return;
  }
  if (typeof value !== "object") throw new RuntimeJsonValidationError(`${path} is not a JSON value.`);
  if (ancestors.has(value)) throw new RuntimeJsonValidationError(`${path} contains a cycle.`);
  ancestors.add(value);
  if (Array.isArray(value)) {
    if (Object.keys(value).length !== value.length) {
      throw new RuntimeJsonValidationError(`${path} contains an array hole or a non-index property.`);
    }
    value.forEach((entry, index) => validateValue(entry, `${path}[${index}]`, depth + 1, maxDepth, ancestors));
  } else {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new RuntimeJsonValidationError(`${path} must contain only plain JSON objects.`);
    }
    for (const [key, entry] of Object.entries(value)) {
      validateValue(entry, `${path}.${key}`, depth + 1, maxDepth, ancestors);
    }
  }
  ancestors.delete(value);
}
