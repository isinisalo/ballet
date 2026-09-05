import type { ActionAgentDefinition } from "@shared/orchestration/environment";
import { isAuthoringModelId, unsupportedAuthoringModelMessage } from "./agentModelPolicy";

export type AgentDraft = Omit<ActionAgentDefinition, "id" | "name">;
export type AgentPair = { validation: AgentDraft; work: AgentDraft };
export type SaveAgents = {
  validationAgent: AgentDraft & { expectedDocumentHash: string };
  workAgent: AgentDraft & { expectedDocumentHash: string };
};

export const editable = ({ description, developerInstructions, model, reasoningEffort }: ActionAgentDefinition): AgentDraft => ({
  description, developerInstructions, model, reasoningEffort
});
export const validateAgents = (agents: AgentPair | undefined, models: Array<{ id: string; reasoningOptions: string[] }>): string[] => {
  if (!agents) return [];
  const issues: string[] = [];
  for (const role of ["validation", "work"] as const) {
    const agent = agents[role]; const model = models.find(({ id }) => id === agent.model);
    if (!agent.description.trim()) issues.push(`${role}: description is required.`);
    if (!agent.developerInstructions.trim()) issues.push(`${role}: developer instructions are required.`);
    if (!isAuthoringModelId(agent.model)) issues.push(`${role}: ${lowercaseFirst(unsupportedAuthoringModelMessage(agent.model))}`);
    else if (!model) issues.push(`${role}: model ${agent.model} is unavailable.`);
    else if (!model.reasoningOptions.includes(agent.reasoningEffort)) issues.push(`${role}: reasoning ${agent.reasoningEffort || "is missing"} is unavailable.`);
  }
  if (agents.validation.developerInstructions === agents.work.developerInstructions) issues.push("Validation and Work developer instructions must be unique.");
  return issues;
};
const lowercaseFirst = (value: string): string => value.replace(/^./, (letter) => letter.toLowerCase());
