import {
  automationFieldLimits,
  automationOutputIdValidationMessage,
  normalizeAutomationToken
} from "@shared/api/automationValidation";

export type OutputId = string;

export const outputIdMinLength = automationFieldLimits.outputId.min ?? 0;
export const outputIdMaxLength = automationFieldLimits.outputId.max;

export const normalizeOutputId = (value: string): OutputId =>
  normalizeAutomationToken(value);

export const uniqueOutputIds = (values: string[], max = Number.POSITIVE_INFINITY): OutputId[] =>
  [...new Set(values.map(normalizeOutputId).filter(Boolean))].slice(0, max);

export const outputValidationMessage = (value: string): string | undefined => {
  const message = automationOutputIdValidationMessage(value);
  if (message === "Output id is required.") return message;
  if (message?.includes("at least")) return `Use at least ${outputIdMinLength} characters.`;
  if (message?.includes("or fewer")) return `Use ${outputIdMaxLength} characters or fewer.`;
  return undefined;
};

export const outputCanCreate = (
  value: string,
  options: string[],
  selected: string[]
): boolean => {
  const normalized = normalizeOutputId(value);
  if (outputValidationMessage(normalized)) return false;
  const existing = new Set(uniqueOutputIds([...options, ...selected]));
  return !existing.has(normalized);
};

export const outputSuggestions = (
  options: string[],
  selected: string[],
  query: string
): OutputId[] => {
  const selectedSet = new Set(uniqueOutputIds(selected));
  const normalizedQuery = normalizeOutputId(query);
  return uniqueOutputIds(options)
    .filter((option) => !selectedSet.has(option))
    .filter((option) => !normalizedQuery || option.includes(normalizedQuery));
};

export const nextSelectedOutputIds = (
  current: string[],
  next: string,
  max: number
): OutputId[] => uniqueOutputIds([...current, next], max);
