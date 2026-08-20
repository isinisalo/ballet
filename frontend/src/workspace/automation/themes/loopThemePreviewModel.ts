import type { ExecutionProfile, LoopNodeSize, LoopNodeStyle, ProjectAutomationConfig, ProjectJobNode, ProjectValidationNode } from "@shared/api/workspace-contracts";

export const previewLoopId = "theme-preview";
const profileId = "codex-gpt-5-6-sol-medium-network-off";
const instructionId = "project:theme-preview";
const appearance = (nodeStyle: LoopNodeStyle, nodeSize: LoopNodeSize) => ({ nodeStyle, nodeSize });

const job = (id: string, nodeStyle: LoopNodeStyle, nodeSize: LoopNodeSize): ProjectJobNode => ({
  id,
  description: `${id} preview Job`,
  validationNodeId: `${id}-validation`,
  maxRetries: 3,
  type: "agent",
  task: `Execute ${id}`,
  executionProfileId: profileId,
  primaryInstructionId: instructionId,
  skillIds: [],
  ...appearance(nodeStyle, nodeSize)
});
const validation = (id: string, nodeStyle: LoopNodeStyle, nodeSize: LoopNodeSize): ProjectValidationNode => ({
  id: `${id}-validation`,
  description: `${id} preview Validation`,
  type: "human",
  task: `Validate ${id}`,
  ...appearance(nodeStyle, nodeSize)
});

const jobs = [job("luna", "luna", "tiny"), job("flat", "flat", "medium"), job("terra", "terra", "medium")];
const validations = [validation("luna", "luna", "tiny"), validation("flat", "flat", "medium"), validation("terra", "terra", "medium")];

export const previewConfig: ProjectAutomationConfig = {
  version: 12,
  orchestrator: { executionProfileId: profileId, primaryInstructionId: instructionId, skillIds: [], maxRepairDepth: 4, maxRepairAttempts: 3 },
  graph: { loopEdges: [] },
  loops: [{
    id: previewLoopId,
    description: "Theme preview Workflow.",
    capabilities: { accepts: ["ballet:theme.preview"], provides: ["ballet:theme.previewed"] },
    state: { description: "Theme preview State.", initial: {} },
    workflow: {
      startJobNodeId: "luna",
      jobNodes: jobs,
      validationNodes: validations,
      passEdges: jobs.map((current, index) => ({ id: `${current.id}-pass`, sourceValidationNodeId: current.validationNodeId, target: index < jobs.length - 1 ? { jobNodeId: jobs[index + 1]!.id } : { workflowResult: "PASS" } })),
      failEdges: jobs.map((current) => ({ id: `${current.id}-fail`, sourceValidationNodeId: current.validationNodeId, target: { workflowResult: "FAIL" } }))
    }
  }]
};

export const previewExecutionProfiles = [{
  id: profileId,
  name: "Codex GPT-5.6 Sol · Medium · Network off",
  provider: "codex",
  model: "gpt-5.6-sol",
  reasoningEffort: "medium",
  networkAccess: false
}] satisfies ExecutionProfile[];

export const previewLoop = previewConfig.loops[0]!;
