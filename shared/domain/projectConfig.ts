import {
  defaultProjectAutomationConfig,
  type ProjectGraph,
  type ProjectLoop,
  type ProjectLoopOrchestrator
} from "./automation.js";
import type { RuntimeProvider } from "./runtime.js";

export interface ProjectIssueTrackerConfig {
  kind: "tk";
  testedRevision: string;
  orchestrationDirectory: string;
  workDirectory: string;
}

export interface ExecutionProfile {
  id: string;
  name: string;
  provider: RuntimeProvider;
  model: string;
  reasoningEffort: string;
  networkAccess: boolean;
}

export interface ProjectConfiguration {
  version: 13;
  executionProfiles: ExecutionProfile[];
  issueTracker: ProjectIssueTrackerConfig;
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
  executionProfiles: [],
  issueTracker: {
    kind: "tk",
    testedRevision: "d778bb520ee526c314c26f2bb876447e0a19caa5",
    orchestrationDirectory: ".tickets/orchestration",
    workDirectory: ".tickets/work"
  }
});
