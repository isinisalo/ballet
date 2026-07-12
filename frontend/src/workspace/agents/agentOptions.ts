import type { Agent } from "@shared/api/workspace-contracts";

export const agentTemplate = (): Partial<Agent> => ({
  name: "",
  description: "",
  instructions: "",
  skills: [],
  enabled: true
});
