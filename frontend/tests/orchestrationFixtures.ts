import { approveUseCase } from "@shared/orchestration/direction";
import type { ProjectConfigurationV22 } from "@shared/orchestration/environment";
import type { ResourceDocument } from "../src/orchestration/types";

export const instructionSource = ["Task", "Role", "Goals", "Priorities", "Method", "Output contract", "Tool policy", "Acceptance evidence"].map((section) => `## ${section}\nDefined ${section.toLowerCase()}.`).join("\n\n");

export const orchestrationConfig = (): ProjectConfigurationV22 => {
  const useCase = approveUseCase({ id: "UC-1", name: "Deliver outcome", status: "draft", examples: [{ given: "approved intent", when: "the Environment runs", then: "evidence is produced" }], successGoals: ["goal-1"], failureGoals: ["No skip"], expectedOutcomes: ["Done"], goalIds: ["goal-1"], adrIds: ["adr-1"], constraintIds: ["constraint-1"] }, { approvedBy: "human", approvedAt: "2026-08-29T10:00:00.000Z", revision: 1 });
  const actionRole = { instructionResource: "validation", skillResources: ["shared-skill"] };
  const governance = { agentId: "profile-1", ...actionRole };
  const action = { id: "action-1", name: "Implement", description: "Perform bounded work", priority: 1, maxRetries: 2, validation: actionRole, work: { ...actionRole, instructionResource: "work" } };
  return { version: 22, direction: { goals: [{ id: "goal-1", name: "Goal", status: "accepted" }], adrs: [{ id: "adr-1", name: "Decision", status: "accepted" }], constraints: [{ id: "constraint-1", name: "No skip", status: "accepted", kind: "prohibited", description: "Do not skip validation", rationale: "Integrity" }], useCases: [useCase] }, agents: [{ id: "profile-1", name: "Primary", description: "Primary test Agent", enabled: true, instructionResource: "validation", skillResources: ["shared-skill"] }], environment: { id: "environment-1", name: "Delivery", description: "Ordered delivery", states: [{ id: "state-1", name: "Build", description: "First State", order: 1, useCaseIds: ["UC-1"], actions: [action] }, { id: "state-2", name: "Verify", description: "Second State", order: 2, useCaseIds: ["UC-1"], actions: [{ ...action, id: "action-2", name: "Verify", priority: 1 }] }] }, critic: { version: 2, enabled: false, schedules: [{ id: "daily", kind: "daily", timeZone: "Europe/Helsinki", localTimes: ["09:00"] }], agent: governance }, refinement: { version: 2, enabled: true, agent: governance, allowedRoots: [".ballet/agents", ".ballet/instructions", ".agents/skills"] } };
};

export const resources = (): ResourceDocument[] => [
  { kind: "instruction", id: "validation", content: instructionSource, contentHash: "a".repeat(64) },
  { kind: "instruction", id: "work", content: instructionSource, contentHash: "b".repeat(64) },
  { kind: "skill", id: "shared-skill", content: "# Shared Skill\nSafe.", contentHash: "c".repeat(64) }
];
