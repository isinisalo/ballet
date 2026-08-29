import type { MarkdownBackedEntity, Skill } from "./documents.js";
import type { RuntimeProvider } from "./runtime.js";

export interface Agent extends MarkdownBackedEntity {
  id: string;
  name: string;
  description: string;
  instructions: string;
  skills: Skill[];
  enabled: boolean;
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
  activeTaskId?: string;
  reason?: string;
}
