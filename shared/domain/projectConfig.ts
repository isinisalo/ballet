import type { ProjectLoop } from "./automation.js";
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
  version: 9;
  executionProfiles: ExecutionProfile[];
  loops: ProjectLoop[];
}

export interface ProjectConfigurationIssue {
  code: "invalid_json" | "invalid_schema";
  path: string;
  message: string;
}

export const defaultProjectConfiguration = (): ProjectConfiguration => ({
  version: 9,
  executionProfiles: [],
  loops: []
});
