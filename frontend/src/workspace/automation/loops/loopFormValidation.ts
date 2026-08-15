import {
  isProjectTerminalNode,
  type ExecutionProfile,
  type LocalRuntime,
  type ProjectAutomationConfig,
  type ProjectInstruction,
  type ProjectLoop,
  type ProjectLoopNode,
  type Skill
} from "@shared/api/workspace-contracts";
import { automationConfigSchema } from "@shared/api/workspace-schemas";
import { executionProfileBlockingReason } from "../../executionProfiles/executionProfileOptions";
import { canonicalResourceIds } from "./StepSkillsField";

const kebabCaseIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function loopIdError(loop: ProjectLoop, loops: readonly ProjectLoop[]): string | undefined {
  if (!loop.id) return "Loop ID is required.";
  if (loop.id.length < 2 || loop.id.length > 101 || !kebabCaseIdPattern.test(loop.id)) {
    return "Use 2–101 lowercase kebab-case characters.";
  }
  if (loops.some((candidate) => candidate !== loop && candidate.id === loop.id)) {
    return `Loop ${loop.id} already exists.`;
  }
  return undefined;
}

export function stepIdError(loop: ProjectLoop, step: ProjectLoopNode): string | undefined {
  if (!step.id) return "Step ID is required.";
  if (step.id.length > 160 || !kebabCaseIdPattern.test(step.id)) {
    return "Use 1–160 lowercase kebab-case characters.";
  }
  if (loop.nodes.some((candidate) => candidate !== step && candidate.id === step.id)) {
    return `Step ${step.id} already exists in this Loop.`;
  }
  return undefined;
}

export function stepDescriptionError(step: ProjectLoopNode): string | undefined {
  const taskStep = !isProjectTerminalNode(step);
  if (taskStep && !step.description.trim()) return "Task description is required.";
  return step.description.length > 2_000 ? `${taskStep ? "Task description" : "Description"} must be 2,000 characters or fewer.` : undefined;
}

export function automationDraftIsValid(
  config: ProjectAutomationConfig,
  profiles: ExecutionProfile[] = [],
  instructions: ProjectInstruction[] = [],
  skills: Skill[] = [],
  runtime?: LocalRuntime
): boolean {
  if (!automationConfigSchema.safeParse(config).success) return false;
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const instructionById = new Map(instructions.flatMap((instruction) => instruction.id ? [[instruction.id, instruction] as const] : []));
  const skillById = new Map(skills.map((skill) => [skill.id, skill]));
  const loopIds = new Set<string>();
  for (const loop of config.loops) {
    if (loopIds.has(loop.id)) return false;
    loopIds.add(loop.id);
    const nodeIds = new Set<string>();
    for (const node of loop.nodes) {
      if (nodeIds.has(node.id)) return false;
      nodeIds.add(node.id);
      if (node.type !== "agent" && node.type !== "scheduled") continue;
      const profile = profileById.get(node.executionProfileId);
      if (!profile || (runtime && executionProfileBlockingReason(profile, runtime))) return false;
      if (!instructionById.get(node.primaryInstructionId)?.valid) return false;
      if (node.skillIds.some((id) => !skillById.get(id)?.valid)) return false;
      if (node.skillIds.some((id, index) => id !== canonicalResourceIds(node.skillIds)[index])) return false;
    }
  }
  return true;
}
