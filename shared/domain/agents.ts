import type { MarkdownBackedEntity, Skill } from "./documents.js";
import type { RuntimeProvider } from "./runtime.js";

export const agentAvatars = [
  "bot",
  "brain-circuit",
  "code-2",
  "compass",
  "hammer",
  "rocket",
  "search",
  "sparkles"
] as const;
export type AgentAvatar = (typeof agentAvatars)[number];

export const normalizeAgentAvatar = (value: unknown): AgentAvatar | undefined =>
  typeof value === "string" && agentAvatars.includes(value as AgentAvatar)
    ? value as AgentAvatar
    : undefined;

export interface Agent extends MarkdownBackedEntity {
  id: string;
  name: string;
  description: string;
  instructions: string;
  skills: Skill[];
  enabled: boolean;
  avatar?: AgentAvatar;
  createdAt: string;
  updatedAt: string;
  nicknameCandidates?: string[];
}

export type AgentLiveStatus = "running" | "idle" | "busy" | "attention" | "unbound" | "offline";

export interface AgentExecutionState {
  agentId: string;
  status: AgentLiveStatus;
  provider?: RuntimeProvider;
  reasoning?: string;
  activeTaskId?: string;
  reason?: string;
}
