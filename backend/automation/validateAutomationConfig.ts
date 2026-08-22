import { projectConfigSchema } from "../../shared/api/workspace-schemas.js";
import type {
  ProjectAutomationConfig,
  ProjectAutomationIssue,
  ProjectExecutionComposition,
  ProjectGraphNode
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

export const validateProjectAutomationConfig = (
  config: ProjectAutomationConfig,
  executionProfiles: readonly ExecutionProfile[] = []
): ProjectAutomationIssue[] => {
  const parsed = projectConfigSchema.safeParse({
    ...config,
    executionProfiles: [...executionProfiles],
    issueTracker: defaultProjectConfiguration().issueTracker
  });
  return parsed.success ? [] : parsed.error.issues.map((issue) => ({
    path: issue.path.map(String).join("."),
    message: issue.message
  }));
};

export const validateProjectExecutionResources = (
  config: ProjectAutomationConfig,
  resources: {
    instructions: ProjectInstruction[];
    skills: Skill[];
    issues: ProjectResourceIssue[];
  }
): ProjectAutomationIssue[] => {
  const issues: ProjectAutomationIssue[] = resources.issues.map((issue) => ({ path: issue.relativePath, message: issue.message }));
  const instructions = new Map(resources.instructions.flatMap((instruction) =>
    instruction.id ? [[instruction.id, instruction] as const] : []));
  const skills = new Set(resources.skills.map((skill) => skill.id));
  const check = (composition: ProjectExecutionComposition, path: string, peerIds: readonly string[] = []) => {
    const instruction = instructions.get(composition.primaryInstructionId);
    if (!instruction?.valid) issues.push({ path: `${path}.primaryInstructionId`, message: `Missing or invalid instruction ${composition.primaryInstructionId}.` });
    composition.skillIds.forEach((skillId, index) => {
      if (!skills.has(skillId)) issues.push({ path: `${path}.skillIds.${index}`, message: `Missing or invalid skill ${skillId}.` });
    });
    if (instruction) for (const peerId of peerIds) if (containsIdentifier(instruction.body, peerId)) {
      issues.push({ path: `${path}.primaryInstructionId`, message: `Instruction must not name peer node ${peerId}; routing belongs to the Orchestrator.` });
    }
  };
  check(config.graph.orchestrator, "graph.orchestrator");
  if (config.graph.repairNode) check(config.graph.repairNode, "graph.repairNode", config.graph.graphNodes.map((node) => node.id));
  config.graph.graphNodes.forEach((graphNode, graphNodeIndex) => validateGraphNodeResources(
    graphNode,
    `graph.graphNodes.${graphNodeIndex}`,
    check,
    issues
  ));
  return issues;
};

const validateGraphNodeResources = (
  graphNode: ProjectGraphNode,
  path: string,
  check: (composition: ProjectExecutionComposition, path: string, peerIds?: readonly string[]) => void,
  issues: ProjectAutomationIssue[]
) => {
  check(graphNode.orchestrator, `${path}.orchestrator`);
  const peerIds = graphNode.jobNodes.map((jobNode) => jobNode.id);
  if (graphNode.repairNode) {
    check(graphNode.repairNode, `${path}.repairNode`, peerIds);
    peerIds.forEach((peerId) => {
      if (containsIdentifier(graphNode.repairNode!.task, peerId)) issues.push({
        path: `${path}.repairNode.task`,
        message: `Repair task must not name peer node ${peerId}; routing belongs to the Orchestrator.`
      });
    });
  }
  graphNode.jobNodes.forEach((jobNode, jobIndex) => {
    const nodePath = `${path}.jobNodes.${jobIndex}`;
    const otherPeers = peerIds.filter((id) => id !== jobNode.id);
    if (jobNode.workNode.type === "agent") check(jobNode.workNode, `${nodePath}.workNode`, otherPeers);
    if (jobNode.validationNode.type === "agent") check(jobNode.validationNode, `${nodePath}.validationNode`, otherPeers);
    for (const [role, task] of [["workNode", jobNode.workNode.task], ["validationNode", jobNode.validationNode.task]] as const) {
      otherPeers.forEach((peerId) => {
        if (containsIdentifier(task, peerId)) issues.push({
          path: `${nodePath}.${role}.task`,
          message: `${role} task must not name peer node ${peerId}; routing belongs to the Orchestrator.`
        });
      });
    }
  });
};

const containsIdentifier = (source: string, id: string): boolean =>
  new RegExp(`(^|[^a-z0-9-])${escapeRegExp(id)}([^a-z0-9-]|$)`, "i").test(source);
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
