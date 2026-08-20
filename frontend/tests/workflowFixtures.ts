import type { ProjectAutomationConfig, ProjectLoop } from "@shared/api/workspace-contracts";

export const workflowLoop = (id = "main-loop"): ProjectLoop => ({
  id,
  description: `Workflow Loop ${id}.`,
  capabilities: { accepts: ["test:loop.transfer"], provides: ["test:loop.transfer"] },
  state: { description: `State for ${id}.`, initial: {} },
  workflow: {
    startJobNodeId: "job",
    jobNodes: [{
      id: "job",
      description: "Execute the Job.",
      validationNodeId: "job-validation",
      maxRetries: 3,
      type: "agent",
      task: "Execute the Job.",
      executionProfileId: "codex-test",
      primaryInstructionId: "project:worker",
      skillIds: [],
      nodeStyle: "terra",
      nodeSize: "medium"
    }],
    validationNodes: [{
      id: "job-validation",
      description: "Validate the Job.",
      type: "human",
      task: "Validate the Job.",
      nodeStyle: "luna",
      nodeSize: "small"
    }],
    passEdges: [{ id: `${id}-job-pass`, sourceValidationNodeId: "job-validation", target: { workflowResult: "PASS" } }],
    failEdges: [{ id: `${id}-job-fail`, sourceValidationNodeId: "job-validation", target: { workflowResult: "FAIL" } }]
  }
});

export const workflowAutomation = (...loops: ProjectLoop[]): ProjectAutomationConfig => ({
  version: 12,
  orchestrator: {
    executionProfileId: "codex-test",
    primaryInstructionId: "project:architect",
    skillIds: [],
    maxRepairDepth: 4,
    maxRepairAttempts: 3
  },
  graph: { loopEdges: [] },
  loops: loops.length > 0 ? loops : [workflowLoop()]
});
