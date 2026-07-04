import { defaultProjectAutomationConfig, type ProjectAutomationConfig } from "../../../../shared/api/workspace-contracts";
import { defaultPolicyOutputIds, defaultProjectOutputs, normalizePolicyToken } from "../../../../shared/policy-actions";

export const ensureAutomationConfig = (config: ProjectAutomationConfig | undefined): ProjectAutomationConfig => {
  const defaults = defaultProjectAutomationConfig();
  const outputs = Array.isArray(config?.outputs) && config.outputs.length > 0 ? config.outputs : defaultProjectOutputs();
  const outputIds = outputs.map((output) => output.id);
  const fallbackOutputIds = defaultPolicyOutputIds.filter((outputId) => outputIds.includes(outputId));
  return {
    ...defaults,
    ...config,
    triggers: Array.isArray(config?.triggers) ? config.triggers : defaults.triggers,
    gates: Array.isArray(config?.gates) ? config.gates : defaults.gates,
    actions: Array.isArray(config?.actions)
      ? config.actions.map((action) => {
        const selectedOutputIds = Array.isArray(action.outputIds)
          ? [...new Set(action.outputIds.map(normalizePolicyToken).filter(Boolean))].slice(0, 3)
          : fallbackOutputIds;
        return {
          ...action,
          outputIds: selectedOutputIds.length > 0 ? selectedOutputIds : outputIds.slice(0, 1)
        };
      })
      : defaults.actions,
    outputs,
    policies: Array.isArray(config?.policies) ? config.policies : defaults.policies,
    workflows: Array.isArray(config?.workflows) ? config.workflows : defaults.workflows,
    runtimes: Array.isArray(config?.runtimes) ? config.runtimes : defaults.runtimes
  };
};
