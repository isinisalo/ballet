import type { RuntimeBackend, RuntimeDevice } from "../../runtimes/types";
import type { AgentRuntimeConfiguration } from "@shared/api/workspace-contracts";
import type { AgentExecutionFormValue } from "./types";

export const PROVIDER_DEFAULT = "provider-default";

export const emptyExecutionForm = (): AgentExecutionFormValue => ({
  deviceId: "",
  runtimeBackendId: "",
  model: "",
  reasoning: "",
  policy: { network: false, readOnlyRoots: [] }
});

export const formFromRuntimeConfiguration = (configuration: AgentRuntimeConfiguration | undefined, devices: RuntimeDevice[] = []): AgentExecutionFormValue => {
  const backendId = configuration?.attachment?.runtimeBackendId ?? configuration?.resolved?.runtimeBackendId ?? "";
  const backend = devices.flatMap((device) => device.backends).find((candidate) => candidate.id === backendId);
  return configuration?.intent || configuration?.attachment || configuration?.resolved ? {
    deviceId: configuration.resolved?.deviceId ?? backend?.deviceId ?? "",
    runtimeBackendId: backendId,
    model: configuration.intent?.model ?? configuration.resolved?.model ?? "",
    reasoning: configuration.intent?.reasoning ?? configuration.resolved?.reasoning ?? "",
    policy: {
      network: configuration.intent?.policy.network ?? configuration.resolved?.policy.network ?? false,
      readOnlyRoots: [...(configuration.attachment?.readOnlyRoots ?? configuration.resolved?.policy.readOnlyRoots ?? [])]
    }
  } : emptyExecutionForm();
};

export const selectedExecutionDevice = (devices: RuntimeDevice[], deviceId: string) =>
  devices.find((device) => device.id === deviceId);

export const selectedExecutionBackend = (devices: RuntimeDevice[], backendId: string) =>
  devices.flatMap((device) => device.backends).find((backend) => backend.id === backendId);

export const backendsForDevice = (devices: RuntimeDevice[], deviceId: string) =>
  selectedExecutionDevice(devices, deviceId)?.backends ?? [];

export const modelOptions = (backend?: RuntimeBackend) =>
  (backend?.capabilities.models ?? []).map((model) => ({ value: model.id, label: model.label || model.id }));

export const reasoningOptions = (backend: RuntimeBackend | undefined, modelId: string) => {
  const selectedModel = backend?.capabilities.models.find((model) => model.id === modelId);
  const options = selectedModel?.reasoningOptions ?? [];
  if (selectedModel && options.length === 0) return [{ value: PROVIDER_DEFAULT, label: "Provider default" }];
  return options.map((reasoning) => ({ value: reasoning, label: reasoning === PROVIDER_DEFAULT ? "Provider default" : reasoning }));
};

export const executionFormError = (form: AgentExecutionFormValue, devices?: RuntimeDevice[]) => {
  if (!form.deviceId) return "Select a computer.";
  if (!form.runtimeBackendId) return "Select a CLI provider.";
  if (!form.model) return "Select a model.";
  if (!form.reasoning) return "Select a reasoning level.";
  if (devices) {
    const backend = selectedExecutionBackend(devices, form.runtimeBackendId);
    if (!backend || backend.deviceId !== form.deviceId) return "The selected CLI provider is not available on this computer.";
    const model = backend.capabilities.models.find((candidate) => candidate.id === form.model);
    if (!model) return "The selected model is no longer available.";
    if (model.reasoningOptions.length > 0 && !model.reasoningOptions.includes(form.reasoning)) return "The selected reasoning level is no longer available.";
    if (model.reasoningOptions.length === 0 && form.reasoning !== PROVIDER_DEFAULT) return "Use Provider default reasoning for this model.";
    if (!backend.capabilities.policy.workspaceWrite) return "This provider cannot enforce project-only writes.";
    if (form.policy.network && !backend.capabilities.policy.networkControl) return "This provider cannot control network access.";
    if (form.policy.readOnlyRoots.length > 0 && !backend.capabilities.policy.readOnlyRoots) return "This provider does not support additional read-only roots.";
  }
  if (form.policy.readOnlyRoots.length > 32) return "Use at most 32 additional read-only roots.";
  if (form.policy.readOnlyRoots.some((root) => !root.startsWith("/"))) return "Read-only roots must be absolute paths.";
  return undefined;
};
