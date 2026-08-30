import { useEffect, useState } from "react";
import type { ActionExecutionRole, ActionRoleExecutionBinding, LocalDaemonStatus, RuntimeProvider } from "@shared/domain/runtime";
import { orchestrationApi } from "../orchestrationApi";

export function useActionRoleExecutionBinding(stateId: string, actionId: string, role: ActionExecutionRole) {
  const [runtime, setRuntime] = useState<LocalDaemonStatus>();
  const [binding, setBinding] = useState<ActionRoleExecutionBinding | null>(null);
  const [provider, setProvider] = useState<RuntimeProvider | "">("");
  const [model, setModel] = useState(""); const [reasoningEffort, setReasoningEffort] = useState("");
  const [network, setNetwork] = useState(false); const [readOnlyRoots, setReadOnlyRoots] = useState("");
  const [error, setError] = useState(""); const [pending, setPending] = useState(false); const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!stateId || !actionId) { setLoaded(true); return; }
    let active = true;
    void Promise.all([orchestrationApi.localRuntime(), orchestrationApi.actionRoleBinding(stateId, actionId, role)])
      .then(([nextRuntime, nextBinding]) => {
        if (!active) return;
        setRuntime(nextRuntime); setBinding(nextBinding); setProvider(nextBinding?.provider ?? "");
        setModel(nextBinding?.model ?? ""); setReasoningEffort(nextBinding?.reasoningEffort ?? "");
        setNetwork(nextBinding?.policy.network ?? false); setReadOnlyRoots(nextBinding?.policy.readOnlyRoots.join("\n") ?? ""); setLoaded(true);
      }).catch((reason) => { if (active) { setError(message(reason)); setLoaded(true); } });
    return () => { active = false; };
  }, [actionId, role, stateId]);
  const providers = runtime?.providers ?? [];
  const providerStatus = providers.find((candidate) => candidate.provider === provider);
  const models = providerStatus?.capabilities.models ?? [];
  const reasoningOptions = models.find(({ id }) => id === model)?.reasoningOptions ?? [];
  const readinessIssues = roleReadiness(role, loaded, binding, runtime, providers);
  const selectProvider = (value: string) => {
    const nextProvider = value === "codex" || value === "copilot" ? value : "";
    const first = providers.find(({ provider }) => provider === nextProvider)?.capabilities.models[0];
    setProvider(nextProvider); setModel(first?.id ?? "");
    setReasoningEffort(first?.defaultReasoning ?? first?.reasoningOptions[0] ?? "");
  };
  const save = async () => {
    if (!provider || !model || !reasoningEffort) return;
    setPending(true); setError("");
    try { setBinding(await orchestrationApi.saveActionRoleBinding(stateId, actionId, role, {
      provider, model, reasoningEffort,
      policy: { network, readOnlyRoots: readOnlyRoots.split("\n").map((value) => value.trim()).filter(Boolean) }
    })); } catch (reason) { setError(message(reason)); } finally { setPending(false); }
  };
  return { binding, provider, model, reasoningEffort, network, readOnlyRoots, error, pending, readinessIssues,
    providers, providerStatus, models, reasoningOptions, selectProvider, setModel, setReasoningEffort,
    setNetwork, setReadOnlyRoots, save,
    canSave: Boolean(provider && model && reasoningEffort && providerStatus?.health === "ready") };
}
export type ActionRoleExecutionState = ReturnType<typeof useActionRoleExecutionBinding>;
const message = (reason: unknown): string => reason instanceof Error ? reason.message : "Action execution operation failed.";

function roleReadiness(role: ActionExecutionRole, loaded: boolean, binding: ActionRoleExecutionBinding | null,
  runtime: LocalDaemonStatus | undefined, providers: LocalDaemonStatus["providers"]): string[] {
  if (!loaded) return [];
  if (!binding) return [`${role}: execution binding is missing.`];
  if (runtime?.status !== "online") return [`${role}: local provider runtime is ${runtime?.status ?? "unavailable"}.`];
  const provider = providers.find(({ provider: candidate }) => candidate === binding.provider);
  if (!provider || provider.health !== "ready") return [`${role}: provider ${binding.provider} is not ready.`];
  const model = provider.capabilities.models.find(({ id }) => id === binding.model);
  if (!model) return [`${role}: model ${binding.model} is not available from ${binding.provider}.`];
  if (!model.reasoningOptions.includes(binding.reasoningEffort)) return [`${role}: reasoning ${binding.reasoningEffort} is not available for ${binding.model}.`];
  if (binding.policy.network && !provider.capabilities.policy.networkControl) return [`${role}: provider cannot enforce the saved network policy.`];
  if (binding.policy.readOnlyRoots.length > 0 && !provider.capabilities.policy.readOnlyRoots) return [`${role}: provider cannot enforce the saved read-only roots.`];
  return [];
}
