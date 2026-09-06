import { actionAgentId, type ProjectConfigurationV26 } from "@shared/orchestration/environment";
import type { ResourceDocument } from "../src/orchestration/types";

export const instructionSource = ["Task", "Role", "Goals", "Priorities", "Method", "Output contract", "Tool policy", "Acceptance evidence"].map((section) => `## ${section}\nDefined ${section.toLowerCase()}.`).join("\n\n");

export const orchestrationConfig = (): ProjectConfigurationV26 => {
  const critic = { agentId: "ballet-critic-agent" as const, skillResources: ["shared-skill"] };
  const refinement = { agentId: "ballet-refinement-agent" as const, skillResources: ["shared-skill"] };
  const action = { id: "action-1", name: "Implement", description: "Perform bounded work", priority: 1, maxRetries: 2, validation: { agentId: actionAgentId("action-1", "validation"), skillResources: ["shared-skill"] }, work: { agentId: actionAgentId("action-1", "work"), skillResources: ["shared-skill"] } };
  const action2 = { ...action, id: "action-2", name: "Verify", priority: 1, validation: { ...action.validation, agentId: actionAgentId("action-2", "validation") }, work: { ...action.work, agentId: actionAgentId("action-2", "work") } };
  return { version: 26, environment: { id: "environment-1", name: "Delivery", description: "Ordered delivery", states: [{ id: "state-1", name: "Build", description: "First State", order: 1, actions: [action] }, { id: "state-2", name: "Verify", description: "Second State", order: 2, actions: [action2] }] }, critic: { version: 2, enabled: false, schedules: [{ id: "daily", kind: "daily", timeZone: "Europe/Helsinki", localTimes: ["09:00"] }], agent: critic }, refinement: { version: 2, enabled: true, agent: refinement, allowedRoots: [".codex/agents", ".ballet/instructions", ".agents/skills"] } };
};

export const resources = (): ResourceDocument[] => [
  { kind: "instruction", id: "validation", content: instructionSource, contentHash: "a".repeat(64) },
  { kind: "instruction", id: "work", content: instructionSource, contentHash: "b".repeat(64) },
  { kind: "skill", id: "shared-skill", content: "# Shared Skill\nSafe.", contentHash: "c".repeat(64) }
];
