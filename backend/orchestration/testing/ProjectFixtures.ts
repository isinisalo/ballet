import { approveUseCase } from "../../../shared/orchestration/direction.js";
import type { ProjectConfigurationV24 } from "../../../shared/orchestration/environment.js";

export const TEST_AT = "2026-08-29T10:00:00.000Z";

export const validProjectConfig = (): ProjectConfigurationV24 => {
  const useCase = approveUseCase({
    id: "UC-1", name: "Use Case", status: "draft", examples: [{ given: "Context", when: "Action", then: "Outcome" }],
    successGoals: ["Succeeds"], failureGoals: ["Never skips"], expectedOutcomes: ["Completed"],
    goalIds: ["goal-1"], adrIds: ["adr-1"], constraintIds: ["constraint-1"]
  }, { approvedBy: "human", approvedAt: TEST_AT, revision: 1 });
  const actionRole = { instructionResource: "instruction", skillResources: [] };
  const critic = { agentId: "ballet-critic-agent" as const, skillResources: [] };
  const refinement = { agentId: "ballet-refinement-agent" as const, skillResources: [] };
  return {
    version: 24,
    direction: {
      goals: [{ id: "goal-1", name: "Goal", status: "accepted" }],
      adrs: [{ id: "adr-1", name: "ADR", status: "accepted" }],
      constraints: [{ id: "constraint-1", name: "Constraint", status: "accepted", kind: "required", description: "Required", rationale: "Safety" }],
      useCases: [useCase]
    },
    environment: { id: "environment-1", name: "Environment", description: "Ordered work", states: [{
      id: "state-1", name: "State", description: "First", order: 1, actions: [{
        id: "action-1", name: "Action", description: "Perform", priority: 1, maxRetries: 1,
        validation: actionRole, work: { ...actionRole }
      }]
    }] },
    critic: { version: 2, enabled: false, schedules: [], agent: critic },
    refinement: { version: 2, enabled: true, agent: refinement,
      allowedRoots: [".codex/agents", ".ballet/instructions", ".agents/skills"] }
  };
};
