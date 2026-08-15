import { automationConfigSchema, kebabCaseIdPattern } from "@shared/api/workspace-contracts";
import type { ProjectAutomationConfig, ProjectLoop, ProjectWorkLoopNode } from "@shared/api/workspace-contracts";

export const automationDraftIsStructurallyValid = (config: ProjectAutomationConfig): boolean =>
  automationConfigSchema.safeParse(config).success;

export const loopIdError = (loop: ProjectLoop, loops: readonly ProjectLoop[]): string | undefined => {
  if (!loop.id) return "Loop ID is required.";
  if (!kebabCaseIdPattern.test(loop.id)) return "Loop ID must be lowercase kebab-case.";
  if (loops.some((candidate) => candidate !== loop && candidate.id === loop.id)) return "Loop ID must be unique.";
  return undefined;
};

export const workLoopNodeIdError = (
  node: ProjectWorkLoopNode,
  loop: ProjectLoop
): string | undefined => {
  if (!node.id) return "Work Loop Node ID is required.";
  if (!kebabCaseIdPattern.test(node.id)) return "Work Loop Node ID must be lowercase kebab-case.";
  if (loop.nodes.some((candidate) => candidate !== node && candidate.id === node.id)) {
    return "Work Loop Node ID must be unique.";
  }
  return undefined;
};
