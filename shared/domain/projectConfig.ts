import type { ProjectLoop } from "./automation.js";
import type { PortableAgentRuntimeIntent } from "./runtime.js";

export interface ProjectConfiguration {
  version: 6;
  agents: Record<string, PortableAgentRuntimeIntent>;
  loops: ProjectLoop[];
}

export const defaultProjectConfiguration = (): ProjectConfiguration => ({
  version: 6,
  agents: {},
  loops: []
});
