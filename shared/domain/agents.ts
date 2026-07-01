import type { MarkdownBackedEntity, Skill } from "./documents.js";

export type AgentStatus = "online" | "offline";

export interface Agent extends MarkdownBackedEntity {
  id: string;
  name: string;
  description: string;
  instructions: string;
  skills: Skill[];
  enabled: boolean;
  status: AgentStatus;
  createdAt: string;
  updatedAt: string;
  model?: string;
  modelReasoningEffort?: string;
  nicknameCandidates?: string[];
}
