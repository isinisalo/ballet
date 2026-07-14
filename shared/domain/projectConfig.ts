import type { ProjectLoop } from "./automation.js";
import type { PortableAgentRuntimeIntent } from "./runtime.js";

export interface ProjectConfiguration {
  version: 8;
  agents: Record<string, PortableAgentRuntimeIntent>;
  loops: ProjectLoop[];
}

export const defaultProjectConfiguration = (): ProjectConfiguration => ({
  version: 8,
  agents: {},
  loops: []
});
