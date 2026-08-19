import type { ProjectAutomationConfig, ProjectLoop } from "@shared/api/workspace-contracts";

export const v11Loop = (id = "main-loop"): ProjectLoop => ({
  id,
  description: `Work Loop ${id}.`,
  capabilities: { accepts: ["test:loop.transfer"], provides: ["test:loop.transfer"] },
  state: { description: `State for ${id}.`, initial: {} },
  startNodeId: "work",
  nodes: [{
    id: "work",
    description: "Execute and validate work.",
    work: {
      type: "agent",
      task: "Execute work.",
      executionProfileId: "codex-test",
      primaryInstructionId: "project:worker",
      skillIds: [],
      nodeStyle: "terra",
      nodeSize: "medium"
    },
    validation: {
      type: "human",
      task: "Validate work.",
      nodeStyle: "luna",
      nodeSize: "small"
    },
    maxLocalAttempts: 3
  }],
  edges: [{ id: `${id}-completed`, source: "work", target: { terminal: "completed" } }]
});

export const v11Automation = (...loops: ProjectLoop[]): ProjectAutomationConfig => ({
  version: 11,
  orchestrator: {
    executionProfileId: "codex-test",
    primaryInstructionId: "project:architect",
    skillIds: [],
    maxRepairDepth: 4,
    maxRepairAttempts: 3
  },
  graph: { loopEdges: [] },
  loops: loops.length > 0 ? loops : [v11Loop()]
});
