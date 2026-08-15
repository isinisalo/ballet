export const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export const recordValue = (value: unknown): Record<string, unknown> => isRecord(value) ? { ...value } : {};
export const stringValue = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : value === undefined || value === null ? fallback : String(value);
