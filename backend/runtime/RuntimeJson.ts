import { createHash } from "node:crypto";
import type { EventRoutingSummary } from "../../shared/domain/automation.js";

export const stringifyJson = (value: unknown): string => JSON.stringify(value ?? {});

const stableJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
};

export const hashDedupeKey = (value: unknown): string =>
  createHash("sha256").update(stableJson(value)).digest("hex").slice(0, 32);

export const parseJsonObject = (value: string): Record<string, unknown> => {
  const parsed = JSON.parse(value) as unknown;
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
};

export const parseJsonArray = (value: string): string[] => {
  const parsed = JSON.parse(value) as unknown;
  return Array.isArray(parsed) ? parsed.map((item) => String(item)).filter(Boolean) : [];
};

export const parseRoutingSummary = (value: string | null): EventRoutingSummary | undefined => {
  if (!value) return undefined;
  const parsed = JSON.parse(value) as unknown;
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as EventRoutingSummary : undefined;
};
