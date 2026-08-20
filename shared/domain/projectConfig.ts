import {
  defaultProjectAutomationConfig,
  type ProjectGraph,
  type ProjectLoop,
  type ProjectLoopOrchestrator
} from "./automation.js";
import type { RuntimeProvider } from "./runtime.js";

export interface ExecutionProfile {
  id: string;
  name: string;
  provider: RuntimeProvider;
  model: string;
  reasoningEffort: string;
  networkAccess: boolean;
}

export interface ProjectConfiguration {
  version: 12;
  executionProfiles: ExecutionProfile[];
  orchestrator: ProjectLoopOrchestrator;
  graph: ProjectGraph;
  loops: ProjectLoop[];
}

export interface ProjectConfigurationIssue {
  code: "invalid_json" | "invalid_schema";
  path: string;
  message: string;
}

export const defaultProjectConfiguration = (): ProjectConfiguration => ({
  ...defaultProjectAutomationConfig(),
  executionProfiles: []
});
