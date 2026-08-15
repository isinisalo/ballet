import type {
  ExecutionProfile,
  LocalProviderStatus,
  LocalRuntime,
  RuntimeProvider
} from "@shared/api/workspace-contracts";

export const PROVIDER_DEFAULT_REASONING = "provider-default";

export const profileIdFromName = (name: string) => name
  .normalize("NFKD")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .slice(0, 120)
  .replace(/-+$/g, "");

export const selectedProvider = (runtime: LocalRuntime, provider: string) =>
  runtime.providers.find((candidate) => candidate.provider === provider);

export const providerOptions = (runtime: LocalRuntime, current?: string) => {
  const providers = [...new Set([
    ...runtime.providers.map((provider) => provider.provider),
    ...(current ? [current as RuntimeProvider] : [])
  ])];
  return providers.map((provider) => ({ value: provider, label: provider }));
};

export const modelOptions = (provider: LocalProviderStatus | undefined, current?: string) => {
  const models = provider?.capabilities.models.map((model) => ({ value: model.id, label: model.label || model.id })) ?? [];
  if (current && !models.some((model) => model.value === current)) models.unshift({ value: current, label: `${current} · unavailable` });
  return models;
};

export const reasoningOptions = (provider: LocalProviderStatus | undefined, modelId: string, current?: string) => {
  const model = provider?.capabilities.models.find((candidate) => candidate.id === modelId);
  const values = model?.reasoningOptions.length ? model.reasoningOptions : model ? [PROVIDER_DEFAULT_REASONING] : [];
  const options = values.map((value) => ({ value, label: value === PROVIDER_DEFAULT_REASONING ? "Provider default" : value }));
  if (current && !options.some((option) => option.value === current)) options.unshift({ value: current, label: `${current} · unavailable` });
  return options;
};

export const executionProfileBlockingReason = (profile: ExecutionProfile, runtime: LocalRuntime) => {
  const provider = selectedProvider(runtime, profile.provider);
  if (!provider) return `Provider ${profile.provider} is unavailable.`;
  if (!provider.installed) return `${profile.provider} CLI is not installed.`;
  if (!provider.compatible) return `${profile.provider} CLI version is unsupported.`;
  if (provider.authStatus !== "ready") return `${profile.provider} authentication is ${provider.authStatus.replaceAll("_", " ")}.`;
  if (provider.health !== "ready") return provider.healthMessage || `${profile.provider} is ${provider.health.replaceAll("_", " ")}.`;
  const model = provider.capabilities.models.find((candidate) => candidate.id === profile.model);
  if (!model) return `Model ${profile.model} is unavailable.`;
  if (model.reasoningOptions.length > 0 && !model.reasoningOptions.includes(profile.reasoningEffort)) return `Reasoning effort ${profile.reasoningEffort} is unavailable.`;
  if (model.reasoningOptions.length === 0 && profile.reasoningEffort !== PROVIDER_DEFAULT_REASONING) return "This model requires Provider default reasoning.";
  if (profile.networkAccess && !provider.capabilities.policy.networkControl) return "This provider cannot control network access.";
  if (!provider.capabilities.policy.workspaceWrite) return "This provider cannot enforce project-only writes.";
  return undefined;
};
