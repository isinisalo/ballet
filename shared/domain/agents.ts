import type { MarkdownBackedEntity, Skill } from "./documents.js";
import type { RuntimeProvider } from "./runtime.js";

export const agentNodeStyles = ["luna", "terra", "sol"] as const;
export type AgentNodeStyle = (typeof agentNodeStyles)[number];
export const defaultAgentNodeStyle: AgentNodeStyle = "terra";

export const normalizeAgentNodeStyle = (value: unknown): AgentNodeStyle =>
  typeof value === "string" && agentNodeStyles.includes(value as AgentNodeStyle)
    ? value as AgentNodeStyle
    : defaultAgentNodeStyle;

export interface Agent extends MarkdownBackedEntity {
  id: string;
  name: string;
  description: string;
  instructions: string;
  skills: Skill[];
  enabled: boolean;
  nodeStyle: AgentNodeStyle;
  createdAt: string;
  updatedAt: string;
  nicknameCandidates?: string[];
}

export type AgentLiveStatus = "running" | "idle" | "busy" | "attention" | "unbound" | "offline";

export interface AgentExecutionState {
  agentId: string;
  status: AgentLiveStatus;
  deviceId?: string;
  runtimeBackendId?: string;
  provider?: RuntimeProvider;
  reasoning?: string;
  activeTaskId?: string;
  reason?: string;
}
