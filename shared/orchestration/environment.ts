import type { Direction } from "./direction.js";
import type { JsonValue } from "./primitives.js";
import { PROJECT_CONFIG_VERSION } from "./versions.js";

export type RuntimeProvider = "codex";

export type GovernanceAgentId = "ballet-critic-agent" | "ballet-refinement-agent";
export type ActionAgentRole = "validation" | "work";
export type ActionAgentId = string;

export const actionAgentId = (actionId: string, role: ActionAgentRole): ActionAgentId =>
  `ballet-action-${role}-${actionId}`;

export interface GovernanceAgentDefinition {
  id: GovernanceAgentId;
  name: GovernanceAgentId;
  description: string;
  developerInstructions: string;
  model: string;
  reasoningEffort: string;
  sandboxMode: "read-only";
}

export interface ActionAgentDefinition {
  id: ActionAgentId;
  name: ActionAgentId;
  description: string;
  developerInstructions: string;
  model: string;
  reasoningEffort: string;
}

export interface AgentComposition {
  agentId: GovernanceAgentId;
  skillResources: string[];
}

export interface ActionRoleComposition {
  agentId: ActionAgentId;
  skillResources: string[];
}

export interface ActionDefinition {
  id: string;
  name: string;
  description: string;
  priority: number;
  maxRetries: number;
  validation: ActionRoleComposition;
  work: ActionRoleComposition;
  input?: JsonValue;
}

export interface StateDefinition {
  id: string;
  name: string;
  description: string;
  order: number;
  actions: ActionDefinition[];
}

export interface EnvironmentDefinition {
  id: string;
  name: string;
  description: string;
  states: StateDefinition[];
}

export interface CriticConfiguration {
  version: 2;
  enabled: boolean;
  schedules: CriticScheduleDefinition[];
  agent: AgentComposition;
}

export type CriticScheduleDefinition = {
  id: string;
  timeZone: string;
  localTimes: string[];
} & (
  | { kind: "daily" }
  | { kind: "weekly"; weekdays: number[] }
);

export interface RefinementConfiguration {
  version: 2;
  enabled: boolean;
  agent: AgentComposition;
  allowedRoots: [".codex/agents", ".ballet/instructions", ".agents/skills"];
}

export interface ProjectConfigurationV25 {
  version: typeof PROJECT_CONFIG_VERSION;
  direction: Direction;
  environment: EnvironmentDefinition;
  critic: CriticConfiguration;
  refinement: RefinementConfiguration;
}
