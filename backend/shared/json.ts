import { createHash } from "node:crypto";

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface VersionedRef {
  id: string;
  version: number;
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export const stableJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().filter((key) => value[key] !== undefined).map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
};

export const hashStableJson = (value: unknown): string =>
  createHash("sha256").update(stableJson(value)).digest("hex");

export const isJsonValue = (value: unknown): value is JsonValue => {
  if (value === null) return true;
  if (["boolean", "string"].includes(typeof value)) return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (isRecord(value)) return Object.values(value).every(isJsonValue);
  return false;
};

export const assertJsonValue = (value: unknown, label = "value"): JsonValue => {
  if (!isJsonValue(value)) throw new Error(`${label} must be a JSON value.`);
  return value;
};
