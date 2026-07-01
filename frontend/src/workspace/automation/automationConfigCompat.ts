import { defaultProjectAutomationConfig, type ProjectAutomationConfig } from "../../../../shared/api/workspace-contracts";

export const ensureAutomationConfig = (config: ProjectAutomationConfig | undefined): ProjectAutomationConfig => {
  const defaults = defaultProjectAutomationConfig();
  return {
    ...defaults,
    ...config,
    triggers: Array.isArray(config?.triggers) ? config.triggers : defaults.triggers,
    actions: Array.isArray(config?.actions) ? config.actions : defaults.actions,
    outputs: Array.isArray(config?.outputs) ? config.outputs : defaults.outputs,
    policies: Array.isArray(config?.policies) ? config.policies : defaults.policies,
    workflows: Array.isArray(config?.workflows) ? config.workflows : defaults.workflows,
    runtimes: Array.isArray(config?.runtimes) ? config.runtimes : defaults.runtimes
  };
};
