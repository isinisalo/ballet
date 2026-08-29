import { approveUseCase } from "../../../shared/vnext/direction.js";
import type { ProjectConfigurationV20 } from "../../../shared/vnext/environment.js";

export const VNEXT_TEST_AT = "2026-08-29T10:00:00.000Z";

export const validVNextProjectConfig = (): ProjectConfigurationV20 => {
  const useCase = approveUseCase({
    id: "UC-1", name: "Use Case", status: "draft", examples: [{ given: "Context", when: "Action", then: "Outcome" }],
    successGoals: ["Succeeds"], failureGoals: ["Never skips"], expectedOutcomes: ["Completed"],
    goalIds: ["goal-1"], adrIds: ["adr-1"], constraintIds: ["constraint-1"]
  }, { approvedBy: "human", approvedAt: VNEXT_TEST_AT, revision: 1 });
  const validation = { executionProfileId: "profile", instructionResource: "instruction", skillResources: [], toolPolicy: "read_only" as const };
  return {
    version: 20,
    direction: {
      goals: [{ id: "goal-1", name: "Goal", status: "accepted" }],
      adrs: [{ id: "adr-1", name: "ADR", status: "accepted" }],
      constraints: [{ id: "constraint-1", name: "Constraint", status: "accepted", kind: "required", description: "Required", rationale: "Safety" }],
      useCases: [useCase]
    },
    executionProfiles: [{ id: "profile", name: "Profile", provider: "codex", model: "model", reasoningEffort: "high", networkAccess: false }],
    environment: { id: "environment-1", name: "Environment", description: "Ordered work", states: [{
      id: "state-1", name: "State", description: "First", order: 1, useCaseIds: ["UC-1"], actions: [{
        id: "action-1", name: "Action", description: "Perform", priority: 1, useCaseIds: ["UC-1"], maxRetries: 1,
        validation, work: { ...validation, toolPolicy: "workspace_write" }
      }]
    }] },
    critic: { version: 1, enabled: false, schedules: [], agent: validation },
    refinement: { version: 1, enabled: true, agent: validation, allowedRoots: [".ballet/instructions", ".agents/skills"] }
  };
};
