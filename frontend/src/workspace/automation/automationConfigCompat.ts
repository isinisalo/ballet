import { defaultProjectAutomationConfig, type ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import { defaultPolicyOutputIds, defaultProjectOutputs, normalizeActionOutputSlots, normalizePolicyToken } from "@shared/policy-actions";

export const ensureAutomationConfig = (config: ProjectAutomationConfig | undefined): ProjectAutomationConfig => {
  const defaults = defaultProjectAutomationConfig();
  const configWithoutLegacy = { ...(config ?? {}) } as ProjectAutomationConfig & {
    triggers?: unknown;
    gates?: unknown;
    gateDecisions?: unknown;
  };
  delete configWithoutLegacy.triggers;
  delete configWithoutLegacy.gates;
  delete configWithoutLegacy.gateDecisions;
  const baseOutputs = Array.isArray(config?.outputs) && config.outputs.length > 0
    ? [...new Map(config.outputs
      .map((output) => ({ id: normalizePolicyToken(output.id) }))
      .filter((output) => output.id)
      .map((output) => [output.id, output])).values()]
    : defaultProjectOutputs();
  const outputIds = baseOutputs.map((output) => output.id);
  const fallbackOutputIds = defaultPolicyOutputIds.filter((outputId) => outputIds.includes(outputId));
  const actions = Array.isArray(config?.actions)
    ? config.actions.map((action) => {
      const agentIds = Array.isArray(action.agentIds) ? [...new Set(action.agentIds.filter(Boolean))].slice(0, 5) : [];
      const selectedOutputIds = Array.isArray(action.outputIds)
        ? normalizeActionOutputSlots(action.outputIds)
        : fallbackOutputIds.length === defaultPolicyOutputIds.length ? fallbackOutputIds : [...defaultPolicyOutputIds];
      return {
        ...action,
        outputIds: agentIds.length === 0 && !action.humanGate ? [] : selectedOutputIds,
        agentIds: action.humanGate ? [] : agentIds
      };
    })
    : defaults.actions;
  const outputById = new Map(baseOutputs.map((output) => [output.id, output]));
  actions.flatMap((action) => action.outputIds).forEach((id) => {
    if (!outputById.has(id)) outputById.set(id, { id });
  });
  return {
    ...defaults,
    ...configWithoutLegacy,
    actions,
    outputs: [...outputById.values()],
    outputRoutes: Array.isArray(config?.outputRoutes) ? config.outputRoutes : defaults.outputRoutes,
    humanGateResponses: Array.isArray(config?.humanGateResponses) ? config.humanGateResponses : defaults.humanGateResponses,
    policies: Array.isArray(config?.policies) ? config.policies : defaults.policies,
    workflows: Array.isArray(config?.workflows) ? config.workflows : defaults.workflows,
    runtimes: Array.isArray(config?.runtimes) ? config.runtimes : defaults.runtimes
  };
};
