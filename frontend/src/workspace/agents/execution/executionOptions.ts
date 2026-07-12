import type { AgentRuntimeConfiguration, LocalProviderStatus } from "@shared/api/workspace-contracts";
import type { AgentExecutionFormValue } from "./types";

export const PROVIDER_DEFAULT = "provider-default";

export const emptyExecutionForm = (): AgentExecutionFormValue => ({
  provider: "",
  model: "",
  reasoning: "",
  policy: { network: false, readOnlyRoots: [] }
});

export const formFromRuntimeConfiguration = (configuration?: AgentRuntimeConfiguration): AgentExecutionFormValue => {
  const source = configuration?.intent ?? configuration?.resolved;
  return source ? {
    provider: source.provider,
    model: source.model,
    reasoning: source.reasoning,
    policy: {
      network: source.policy.network,
      readOnlyRoots: [...(configuration?.localPolicy.readOnlyRoots ?? [])]
    }
  } : emptyExecutionForm();
};

export const selectedExecutionProvider = (providers: LocalProviderStatus[], provider: string) =>
  providers.find((candidate) => candidate.provider === provider);

export const modelOptions = (provider?: LocalProviderStatus) =>
  (provider?.capabilities.models ?? []).map((model) => ({ value: model.id, label: model.label || model.id }));

export const reasoningOptions = (provider: LocalProviderStatus | undefined, modelId: string) => {
  const selectedModel = provider?.capabilities.models.find((model) => model.id === modelId);
  const options = selectedModel?.reasoningOptions ?? [];
  if (selectedModel && options.length === 0) return [{ value: PROVIDER_DEFAULT, label: "Provider default" }];
  return options.map((reasoning) => ({ value: reasoning, label: reasoning === PROVIDER_DEFAULT ? "Provider default" : reasoning }));
};

export const executionFormError = (form: AgentExecutionFormValue, providers?: LocalProviderStatus[]) => {
  if (!form.provider) return "Select a CLI provider.";
  if (!form.model) return "Select a model.";
  if (!form.reasoning) return "Select a reasoning level.";
  if (providers) {
    const provider = selectedExecutionProvider(providers, form.provider);
    if (!provider) return "The selected CLI provider is unavailable.";
    const model = provider.capabilities.models.find((candidate) => candidate.id === form.model);
    if (!model) return "The selected model is no longer available.";
    if (model.reasoningOptions.length > 0 && !model.reasoningOptions.includes(form.reasoning)) return "The selected reasoning level is no longer available.";
    if (model.reasoningOptions.length === 0 && form.reasoning !== PROVIDER_DEFAULT) return "Use Provider default reasoning for this model.";
    if (!provider.capabilities.policy.workspaceWrite) return "This provider cannot enforce project-only writes.";
    if (form.policy.network && !provider.capabilities.policy.networkControl) return "This provider cannot control network access.";
    if (form.policy.readOnlyRoots.length > 0 && !provider.capabilities.policy.readOnlyRoots) return "This provider does not support additional read-only roots.";
  }
  if (form.policy.readOnlyRoots.length > 32) return "Use at most 32 additional read-only roots.";
  if (form.policy.readOnlyRoots.some((root) => !root.startsWith("/"))) return "Read-only roots must be absolute paths.";
  return undefined;
};
