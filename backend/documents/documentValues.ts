export const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export const recordValue = (value: unknown): Record<string, unknown> => isRecord(value) ? { ...value } : {};
export const stringValue = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : value === undefined || value === null ? fallback : String(value);
export const booleanValue = (value: unknown, fallback = false): boolean =>
  typeof value === "boolean" ? value : typeof value === "string" ? value.toLowerCase() === "true" : fallback;
export const stringArray = (value: unknown): string[] => Array.isArray(value)
  ? value.map((item) => stringValue(item)).filter(Boolean)
  : typeof value === "string" ? value.split(",").map((item) => item.trim()).filter(Boolean) : [];
