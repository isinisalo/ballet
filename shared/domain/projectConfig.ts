import {
  defaultProjectAutomationConfig,
  type ProjectLoop,
  type ProjectLoopEdge,
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
  version: 10;
  executionProfiles: ExecutionProfile[];
  orchestrator: ProjectLoopOrchestrator;
  loops: ProjectLoop[];
  loopEdges: ProjectLoopEdge[];
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
