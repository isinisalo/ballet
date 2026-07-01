import type { ProjectAutomationConfig } from "../../shared/domain.js";

export const defaultProjectAutomationConfig = (): ProjectAutomationConfig => ({
  version: 1,
  triggers: [],
  actions: [],
  policies: [],
  workflows: [],
  runtimes: []
});
