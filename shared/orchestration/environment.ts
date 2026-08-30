import type { Direction } from "./direction.js";
import type { JsonValue } from "./primitives.js";
import { PROJECT_CONFIG_VERSION } from "./versions.js";

export type RuntimeProvider = "codex" | "copilot";

export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  instructionResource: string;
  skillResources: string[];
}

export interface AgentComposition {
  agentId: string;
  instructionResource: string;
  skillResources: string[];
}

export interface ActionRoleComposition {
  instructionResource: string;
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
  useCaseIds: string[];
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
  allowedRoots: [".ballet/agents", ".ballet/instructions", ".agents/skills"];
}

export interface ProjectConfigurationV22 {
  version: typeof PROJECT_CONFIG_VERSION;
  direction: Direction;
  agents: AgentDefinition[];
  environment: EnvironmentDefinition;
  critic: CriticConfiguration;
  refinement: RefinementConfiguration;
}
