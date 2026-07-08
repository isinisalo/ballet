import { normalizePolicyToken, normalizeLoopId } from "../policy-actions.js";

export type AutomationFieldLimit = {
  min?: number;
  max: number;
};

export const automationFieldLimits = {
  token: { min: 2, max: 40 },
  outputId: { min: 2, max: 32 },
  name: { min: 1, max: 40 },
  description: { min: 1, max: 240 },
  command: { min: 1, max: 120 },
  arg: { min: 1, max: 120 },
  eventType: { min: 1, max: 96 },
  loopId: { min: 2, max: 101 },
  policyId: { min: 1, max: 160 }
} as const satisfies Record<string, AutomationFieldLimit>;

export const normalizeAutomationToken = (value: string): string =>
  normalizePolicyToken(value);

export const normalizeAutomationLoopId = (value: string): string =>
  normalizeLoopId(value);

export const automationStringValidationMessage = (
  label: string,
  value: string,
  limit: AutomationFieldLimit,
  { required = true, normalize }: { required?: boolean; normalize?: (value: string) => string } = {}
): string | undefined => {
  const normalizedValue = normalize ? normalize(value) : value.trim();
  if (required && !normalizedValue) return `${label} is required.`;
  if (!normalizedValue) return undefined;
  if (limit.min !== undefined && normalizedValue.length < limit.min) return `${label} must be at least ${limit.min} characters.`;
  if (normalizedValue.length > limit.max) return `${label} must be ${limit.max} characters or fewer.`;
  return undefined;
};

export const automationTokenValidationMessage = (label: string, value: string): string | undefined =>
  automationStringValidationMessage(label, value, automationFieldLimits.token, { normalize: normalizeAutomationToken });

export const automationLoopIdValidationMessage = (label: string, value: string): string | undefined =>
  automationStringValidationMessage(label, value, automationFieldLimits.loopId, { normalize: normalizeAutomationLoopId });

export const automationOutputIdValidationMessage = (value: string): string | undefined =>
  automationStringValidationMessage("Output id", value, automationFieldLimits.outputId, { normalize: normalizeAutomationToken });
