export const parseObject = (value: string | null): Record<string, unknown> | undefined => {
  if (!value) return undefined;
  const parsed = JSON.parse(value) as unknown;
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : undefined;
};

export const parseArray = <T>(value: string): T[] => {
  const parsed = JSON.parse(value) as unknown;
  return Array.isArray(parsed) ? parsed as T[] : [];
};

export const stringify = (value: unknown): string => JSON.stringify(value ?? null);
