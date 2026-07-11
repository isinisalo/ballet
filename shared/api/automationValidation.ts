export type AutomationFieldLimit = {
  min?: number;
  max: number;
};

export const automationFieldLimits = {
  token: { min: 2, max: 40 },
  name: { min: 1, max: 80 },
  description: { min: 1, max: 2000 },
  command: { min: 1, max: 120 },
  arg: { min: 1, max: 120 },
  loopId: { min: 2, max: 101 },
  stepId: { min: 1, max: 160 }
} as const satisfies Record<string, AutomationFieldLimit>;

export const kebabCaseIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const automationStringValidationMessage = (
  label: string,
  value: string,
  limit: AutomationFieldLimit,
  { required = true }: { required?: boolean } = {}
): string | undefined => {
  if (required && !value) return `${label} is required.`;
  if (!value) return undefined;
  if (limit.min !== undefined && value.length < limit.min) return `${label} must be at least ${limit.min} characters.`;
  if (value.length > limit.max) return `${label} must be ${limit.max} characters or fewer.`;
  return undefined;
};

export const automationIdValidationMessage = (label: string, value: string): string | undefined => {
  if (!value) return `${label} is required.`;
  if (!kebabCaseIdPattern.test(value)) return `${label} must be lowercase kebab-case.`;
  return undefined;
};
