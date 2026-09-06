import { actionAgentId, type ProjectConfigurationV26 } from "../../../shared/orchestration/environment.js";

export const TEST_AT = "2026-08-29T10:00:00.000Z";

export const validProjectConfig = (): ProjectConfigurationV26 => {
  const critic = { agentId: "ballet-critic-agent" as const, skillResources: [] };
  const refinement = { agentId: "ballet-refinement-agent" as const, skillResources: [] };
  return {
    version: 26,
    environment: { id: "environment-1", name: "Environment", description: "Ordered work", states: [{
      id: "state-1", name: "State", description: "First", order: 1, actions: [{
        id: "action-1", name: "Action", description: "Perform", priority: 1, maxRetries: 1,
        validation: { agentId: actionAgentId("action-1", "validation"), skillResources: [] },
        work: { agentId: actionAgentId("action-1", "work"), skillResources: [] }
      }]
    }] },
    critic: { version: 2, enabled: false, schedules: [], agent: critic },
    refinement: { version: 2, enabled: true, agent: refinement,
      allowedRoots: [".codex/agents", ".ballet/instructions", ".agents/skills"] }
  };
};
