import type { Direction } from "./direction.js";
import type { JsonValue } from "./primitives.js";
import { VNEXT_PROJECT_CONFIG_VERSION } from "./versions.js";

export type RuntimeProvider = "codex" | "copilot";

export interface ExecutionProfile {
  id: string;
  name: string;
  provider: RuntimeProvider;
  model: string;
  reasoningEffort: string;
  networkAccess: boolean;
}

export interface AgentComposition {
  executionProfileId: string;
  instructionResource: string;
  skillResources: string[];
  toolPolicy: "read_only" | "workspace_write";
}

export interface ActionDefinition {
  id: string;
  name: string;
  description: string;
  priority: number;
  useCaseIds: string[];
  maxRetries: number;
  validation: AgentComposition;
  work: AgentComposition;
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
  version: 1;
  enabled: boolean;
  schedule: { kind: "interval"; intervalMinutes: number };
  agent: AgentComposition;
}

export interface RefinementConfiguration {
  version: 1;
  enabled: boolean;
  agent: AgentComposition;
  allowedRoots: [".ballet/instructions", ".agents/skills"];
}

export interface ProjectConfigurationV20 {
  version: typeof VNEXT_PROJECT_CONFIG_VERSION;
  direction: Direction;
  executionProfiles: ExecutionProfile[];
  environment: EnvironmentDefinition;
  critic: CriticConfiguration;
  refinement: RefinementConfiguration;
}
