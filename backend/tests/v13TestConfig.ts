import type {
  ProjectAutomationConfig,
  ProjectJobNode,
  ProjectJobSchedule,
  ProjectLoop,
  ProjectLoopOrchestrator,
  ProjectValidationNode
} from "../../shared/domain/automation.js";
import type { ExecutionProfile, ProjectConfiguration } from "../../shared/domain/projectConfig.js";

export const testExecutionProfile: ExecutionProfile = {
  id: "codex-test",
  name: "Codex Test",
  provider: "codex",
  model: "test-model",
  reasoningEffort: "medium",
  networkAccess: false
};

export const testRunbookOrchestrator = (): ProjectLoopOrchestrator => ({
  mode: "runbook",
  maxTransitions: 256
});

export const testOrchestrator = (): ProjectLoopOrchestrator => ({
  ...testRunbookOrchestrator(),
  repairRouter: {
    executionProfileId: testExecutionProfile.id,
    primaryInstructionId: "project:architect",
    skillIds: [],
    maxRepairDepth: 4,
    maxRepairAttempts: 3
  }
});

export interface TestJobPair {
  job: ProjectJobNode;
  validation: ProjectValidationNode;
}

export const testJobPair = (
  id = "job",
  options: { scheduled?: ProjectJobSchedule; validation?: "agent" | "human"; maxRetries?: number } = {}
): TestJobPair => ({
  job: options.scheduled ? {
    id,
    description: `Execute ${id}.`,
    validationNodeId: `${id}-validation`,
    maxRetries: options.maxRetries ?? 3,
    type: "scheduled",
    task: `Execute ${id} on schedule.`,
    executionProfileId: testExecutionProfile.id,
    primaryInstructionId: "project:worker",
    skillIds: [],
    nodeStyle: "terra",
    nodeSize: "medium",
    schedule: options.scheduled
  } : {
    id,
    description: `Execute ${id}.`,
    validationNodeId: `${id}-validation`,
    maxRetries: options.maxRetries ?? 3,
    type: "agent",
    task: `Execute ${id}.`,
    executionProfileId: testExecutionProfile.id,
    primaryInstructionId: "project:worker",
    skillIds: [],
    nodeStyle: "terra",
    nodeSize: "medium"
  },
  validation: options.validation === "agent" ? {
    id: `${id}-validation`,
    description: `Validate ${id}.`,
    type: "agent",
    task: `Validate ${id}.`,
    executionProfileId: testExecutionProfile.id,
    primaryInstructionId: "project:reviewer",
    skillIds: [],
    nodeStyle: "luna",
    nodeSize: "small"
  } : {
    id: `${id}-validation`,
    description: `Validate ${id}.`,
    type: "human",
    task: `Validate ${id}.`,
    nodeStyle: "luna",
    nodeSize: "small"
  }
});

export const testLoop = (id = "main-loop", pair = testJobPair()): ProjectLoop => ({
  id,
  description: `Test Loop ${id}.`,
  capabilities: { accepts: ["test:loop.transfer"], provides: ["test:loop.transfer"] },
  state: { description: `State for ${id}.`, initial: {} },
  workflow: {
    startJobNodeId: pair.job.id,
    jobNodes: [pair.job],
    validationNodes: [pair.validation],
    passEdges: [{ id: `${id}-${pair.job.id}-pass`, sourceValidationNodeId: pair.validation.id, target: { workflowResult: "PASS" } }],
    failEdges: [{ id: `${id}-${pair.job.id}-fail`, sourceValidationNodeId: pair.validation.id, target: { workflowResult: "FAIL" } }]
  }
});

export const testAutomationConfig = (loop = testLoop()): ProjectAutomationConfig => ({
  version: 13,
  orchestrator: testRunbookOrchestrator(),
  graph: {
    id: "test-graph",
    name: "Test Graph",
    startLoopId: loop.id,
    transitions: [{
      id: `${loop.id}-success-done`,
      source: loop.id,
      decision: "PASS",
      outcome: "success",
      target: { runResult: "DONE" },
      description: "Finish the test graph."
    }],
    repairEdges: []
  },
  loops: [loop]
});

export const testProjectConfiguration = (loop = testLoop()): ProjectConfiguration => ({
  ...testAutomationConfig(loop),
  executionProfiles: [testExecutionProfile],
  issueTracker: {
    kind: "tk",
    testedRevision: "d778bb520ee526c314c26f2bb876447e0a19caa5",
    orchestrationDirectory: ".tickets/orchestration",
    workDirectory: ".tickets/work"
  }
});
