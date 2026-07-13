import type { ProjectAutomationConfig, ProjectLoop, ProjectStep } from "@shared/api/workspace-contracts";
import { automationConfigSchema } from "@shared/api/workspace-schemas";

const kebabCaseIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function loopIdError(loop: ProjectLoop, loops: readonly ProjectLoop[]): string | undefined {
  if (!loop.id) return "Loop ID is required.";
  if (loop.id.length > 160 || !kebabCaseIdPattern.test(loop.id)) {
    return "Use 1–160 lowercase kebab-case characters.";
  }
  if (loops.some((candidate) => candidate !== loop && candidate.id === loop.id)) {
    return `Loop ${loop.id} already exists.`;
  }
  return undefined;
}

export function stepIdError(loop: ProjectLoop, step: ProjectStep): string | undefined {
  if (!step.id) return "Step ID is required.";
  if (step.id.length > 160 || !kebabCaseIdPattern.test(step.id)) {
    return "Use 1–160 lowercase kebab-case characters.";
  }
  if (loop.steps.some((candidate) => candidate !== step && candidate.id === step.id)) {
    return `Step ${step.id} already exists in this Loop.`;
  }
  return undefined;
}

export function stepDescriptionError(step: ProjectStep): string | undefined {
  return step.description.length > 2_000 ? "Description must be 2,000 characters or fewer." : undefined;
}

export function automationDraftIsValid(config: ProjectAutomationConfig): boolean {
  if (!automationConfigSchema.safeParse(config).success) return false;
  const loopIds = new Set<string>();
  for (const loop of config.loops) {
    if (loopIds.has(loop.id)) return false;
    loopIds.add(loop.id);
    const stepIds = new Set<string>();
    for (const step of loop.steps) {
      if (stepIds.has(step.id)) return false;
      stepIds.add(step.id);
    }
  }
  return true;
}
