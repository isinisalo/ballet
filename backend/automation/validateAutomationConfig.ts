import { projectConfigReadinessSchema } from "../../shared/api/workspace-schemas.js";
import type {
  ProjectAutomationConfig,
  ProjectAutomationIssue,
  ProjectExecutionComposition
} from "../../shared/domain/automation.js";
import { defaultProjectConfiguration, type ExecutionProfile } from "../../shared/domain/projectConfig.js";
import type { ProjectInstruction, ProjectResourceIssue, Skill } from "../../shared/domain/documents.js";

export class AutomationValidationError extends Error {
  constructor(message: string, readonly issues: ProjectAutomationIssue[]) {
    super(message);
    this.name = "AutomationValidationError";
  }
}
export class AutomationConflictError extends Error {
  constructor(message: string) { super(message); this.name = "AutomationConflictError"; }
}

export function validateProjectAutomationConfig(
  config: ProjectAutomationConfig,
  executionProfiles: readonly ExecutionProfile[] = []
): ProjectAutomationIssue[] {
  const parsed = projectConfigReadinessSchema.safeParse({
    ...config,
    executionProfiles: [...executionProfiles],
    issueTracker: defaultProjectConfiguration().issueTracker
  });
  return parsed.success ? [] : parsed.error.issues.map((issue) => ({
    path: issue.path.map(String).join("."),
    message: issue.message
  }));
}

export function validateProjectExecutionResources(
  config: ProjectAutomationConfig,
  resources: { instructions: ProjectInstruction[]; skills: Skill[]; issues: ProjectResourceIssue[] }
): ProjectAutomationIssue[] {
  const issues = resources.issues.map((issue) => ({ path: issue.relativePath, message: issue.message }));
  const instructions = new Map(resources.instructions.flatMap((instruction) =>
    instruction.id ? [[instruction.id, instruction] as const] : []));
  const skills = new Set(resources.skills.map((skill) => skill.id));
  const check = (composition: ProjectExecutionComposition, path: string) => {
    const instruction = instructions.get(composition.primaryInstructionId);
    if (!instruction?.valid) issues.push({
      path: `${path}.primaryInstructionId`,
      message: `Missing or invalid instruction ${composition.primaryInstructionId}.`
    });
    composition.skillIds.forEach((skillId, index) => {
      if (!skills.has(skillId)) issues.push({
        path: `${path}.skillIds.${index}`,
        message: `Missing or invalid skill ${skillId}.`
      });
    });
  };
  config.graph.graphNodes.forEach((graphNode, graphNodeIndex) => {
    graphNode.actionNodes.forEach((actionNode, jobIndex) => {
      const path = `graph.graphNodes.${graphNodeIndex}.actionNodes.${jobIndex}`;
      if (actionNode.workNode.type === "agent") check(actionNode.workNode, `${path}.workNode`);
      if (actionNode.validationNode.type === "agent") check(actionNode.validationNode, `${path}.validationNode`);
    });
  });
  return issues;
}
