import { createHash } from "node:crypto";

const sortValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => compare(left, right))
    .map(([key, child]) => [key, sortValue(child)]));
};

export const canonicalLoopModuleJson = (value: unknown): string => `${JSON.stringify(sortValue(value), null, 2)}\n`;
export const loopModuleSha256 = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");
export const compareLoopModuleText = (left: string, right: string): number => compare(left, right);

const compare = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
