import { defaultProjectAutomationConfig, type ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import { defaultPolicyOutputIds, defaultProjectOutputs, normalizePolicyToken } from "@shared/policy-actions";

export const ensureAutomationConfig = (config: ProjectAutomationConfig | undefined): ProjectAutomationConfig => {
  const defaults = defaultProjectAutomationConfig();
  const outputs = Array.isArray(config?.outputs) && config.outputs.length > 0
    ? [...new Map(config.outputs
      .map((output) => ({ id: normalizePolicyToken(output.id) }))
      .filter((output) => output.id)
      .map((output) => [output.id, output])).values()]
    : defaultProjectOutputs();
  const outputIds = outputs.map((output) => output.id);
  const fallbackOutputIds = defaultPolicyOutputIds.filter((outputId) => outputIds.includes(outputId));
  return {
    ...defaults,
    ...config,
    triggers: Array.isArray(config?.triggers) ? config.triggers : defaults.triggers,
    actions: Array.isArray(config?.actions)
      ? config.actions.map((action) => {
        const agentIds = Array.isArray(action.agentIds) ? [...new Set(action.agentIds.filter(Boolean))].slice(0, 5) : [];
        const selectedOutputIds = Array.isArray(action.outputIds)
          ? [...new Set(action.outputIds.map(normalizePolicyToken).filter(Boolean))].slice(0, 3)
          : fallbackOutputIds;
        return {
          ...action,
          outputIds: agentIds.length === 0 ? [] : selectedOutputIds.length > 0 ? selectedOutputIds : outputIds.slice(0, 1),
          agentIds
        };
      })
      : defaults.actions,
    outputs,
    policies: Array.isArray(config?.policies) ? config.policies : defaults.policies,
    workflows: Array.isArray(config?.workflows) ? config.workflows : defaults.workflows,
    runtimes: Array.isArray(config?.runtimes) ? config.runtimes : defaults.runtimes
  };
};
