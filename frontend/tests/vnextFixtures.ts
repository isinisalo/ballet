import { approveUseCase } from "@shared/vnext/direction";
import type { ProjectConfigurationV20 } from "@shared/vnext/environment";
import type { ResourceDocument } from "../src/vnext/types";

export const instructionSource = ["Task", "Role", "Goals", "Priorities", "Method", "Output contract", "Tool policy", "Acceptance evidence"].map((section) => `## ${section}\nDefined ${section.toLowerCase()}.`).join("\n\n");

export const vNextConfig = (): ProjectConfigurationV20 => {
  const useCase = approveUseCase({ id: "UC-1", name: "Deliver outcome", status: "draft", examples: [{ given: "approved intent", when: "the Environment runs", then: "evidence is produced" }], successGoals: ["goal-1"], failureGoals: ["No skip"], expectedOutcomes: ["Done"], goalIds: ["goal-1"], adrIds: ["adr-1"], constraintIds: ["constraint-1"] }, { approvedBy: "human", approvedAt: "2026-08-29T10:00:00.000Z", revision: 1 });
  const validation = { executionProfileId: "profile-1", instructionResource: "validation", skillResources: ["shared-skill"], toolPolicy: "read_only" as const };
  const action = { id: "action-1", name: "Implement", description: "Perform bounded work", priority: 1, useCaseIds: ["UC-1"], maxRetries: 2, validation, work: { ...validation, instructionResource: "work", toolPolicy: "workspace_write" as const } };
  return { version: 20, direction: { goals: [{ id: "goal-1", name: "Goal", status: "accepted" }], adrs: [{ id: "adr-1", name: "Decision", status: "accepted" }], constraints: [{ id: "constraint-1", name: "No skip", status: "accepted", kind: "prohibited", description: "Do not skip validation", rationale: "Integrity" }], useCases: [useCase] }, executionProfiles: [{ id: "profile-1", name: "Primary", provider: "codex", model: "gpt-5.6-sol", reasoningEffort: "high", networkAccess: false }], environment: { id: "environment-1", name: "Delivery", description: "Ordered delivery", states: [{ id: "state-1", name: "Build", description: "First State", order: 1, useCaseIds: ["UC-1"], actions: [action] }, { id: "state-2", name: "Verify", description: "Second State", order: 2, useCaseIds: ["UC-1"], actions: [{ ...action, id: "action-2", name: "Verify", priority: 1 }] }] }, critic: { version: 1, enabled: false, schedules: [{ id: "daily", kind: "daily", timeZone: "Europe/Helsinki", localTimes: ["09:00"] }], agent: validation }, refinement: { version: 1, enabled: true, agent: validation, allowedRoots: [".ballet/instructions", ".agents/skills"] } };
};

export const resources = (): ResourceDocument[] => [
  { kind: "instruction", id: "validation", content: instructionSource, contentHash: "a".repeat(64) },
  { kind: "instruction", id: "work", content: instructionSource, contentHash: "b".repeat(64) },
  { kind: "skill", id: "shared-skill", content: "# Shared Skill\nSafe.", contentHash: "c".repeat(64) }
];
