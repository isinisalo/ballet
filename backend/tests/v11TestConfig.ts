import type {
  ProjectAutomationConfig,
  ProjectLoop,
  ProjectWorkLoopNode,
  ProjectWorkSchedule
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

export const testOrchestrator = () => ({
  executionProfileId: testExecutionProfile.id,
  primaryInstructionId: "project:architect",
  skillIds: [],
  maxRepairDepth: 4,
  maxRepairAttempts: 3
});

export const testWorkLoopNode = (
  id = "work",
  options: { scheduled?: ProjectWorkSchedule; validation?: "agent" | "human" } = {}
): ProjectWorkLoopNode => ({
  id,
  description: `Execute and validate ${id}.`,
  work: options.scheduled ? {
    type: "scheduled",
    task: `Execute ${id} on schedule.`,
    executionProfileId: testExecutionProfile.id,
    primaryInstructionId: "project:worker",
    skillIds: [],
    nodeStyle: "terra",
    nodeSize: "medium",
    schedule: options.scheduled
  } : {
    type: "agent",
    task: `Execute ${id}.`,
    executionProfileId: testExecutionProfile.id,
    primaryInstructionId: "project:worker",
    skillIds: [],
    nodeStyle: "terra",
    nodeSize: "medium"
  },
  validation: options.validation === "agent" ? {
    type: "agent",
    task: `Validate ${id}.`,
    executionProfileId: testExecutionProfile.id,
    primaryInstructionId: "project:reviewer",
    skillIds: [],
    nodeStyle: "luna",
    nodeSize: "small"
  } : {
    type: "human",
    task: `Validate ${id}.`,
    nodeStyle: "luna",
    nodeSize: "small"
  },
  maxLocalAttempts: 3
});

export const testLoop = (id = "main-loop", node = testWorkLoopNode()): ProjectLoop => ({
  id,
  description: `Test Loop ${id}.`,
  capabilities: { accepts: ["test:loop.transfer"], provides: ["test:loop.transfer"] },
  state: { description: `State for ${id}.`, initial: {} },
  startNodeId: node.id,
  nodes: [node],
  edges: [{ id: `${id}-completed`, source: node.id, target: { terminal: "completed" } }]
});

export const testAutomationConfig = (loop = testLoop()): ProjectAutomationConfig => ({
  version: 11,
  orchestrator: testOrchestrator(),
  graph: { loopEdges: [] },
  loops: [loop]
});

export const testProjectConfiguration = (loop = testLoop()): ProjectConfiguration => ({
  ...testAutomationConfig(loop),
  executionProfiles: [testExecutionProfile]
});
