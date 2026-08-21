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
  version: 13,
  orchestrator: { mode: "runbook", maxTransitions: 256 },
  graph: graphFor(loops.length > 0 ? loops : [workflowLoop()]),
  loops: loops.length > 0 ? loops : [workflowLoop()]
});

const graphFor = (loops: ProjectLoop[]): ProjectAutomationConfig["graph"] => ({
  id: "test-graph",
  name: "Test Graph",
  startLoopId: loops[0]?.id ?? "",
  transitions: loops.flatMap((loop, index) => [{
    id: `${loop.id}-success`, source: loop.id, decision: "PASS" as const, outcome: "success",
    target: index < loops.length - 1 ? { loopId: loops[index + 1]!.id } : { runResult: "DONE" as const },
    description: `Continue from ${loop.id}.`
  }, {
    id: `${loop.id}-failure`, source: loop.id, decision: "FAIL" as const, outcome: "failure",
    target: { loopId: loop.id }, description: `Retry ${loop.id}.`
  }]),
  repairEdges: []
});
