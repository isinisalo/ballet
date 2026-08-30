import { useEffect, useState } from "react";
import type { AgentExecutionBinding, LocalDaemonStatus, RuntimeProvider } from "@shared/domain/runtime";
import { orchestrationApi } from "../orchestrationApi";

export function useAgentExecutionBinding(agentId?: string) {
  const [runtime, setRuntime] = useState<LocalDaemonStatus>();
  const [binding, setBinding] = useState<AgentExecutionBinding | null>(null);
  const [provider, setProvider] = useState<RuntimeProvider | "">("");
  const [model, setModel] = useState(""); const [reasoningEffort, setReasoningEffort] = useState("");
  const [network, setNetwork] = useState(false); const [readOnlyRoots, setReadOnlyRoots] = useState("");
  const [error, setError] = useState(""); const [pending, setPending] = useState(false);
  useEffect(() => {
    if (!agentId) return;
    let active = true;
    void Promise.all([orchestrationApi.localRuntime(), orchestrationApi.agentBinding(agentId)]).then(([nextRuntime, nextBinding]) => {
      if (!active) return;
      setRuntime(nextRuntime); setBinding(nextBinding); setProvider(nextBinding?.provider ?? "");
      setModel(nextBinding?.model ?? ""); setReasoningEffort(nextBinding?.reasoningEffort ?? "");
      setNetwork(nextBinding?.policy.network ?? false);
      setReadOnlyRoots(nextBinding?.policy.readOnlyRoots.join("\n") ?? "");
    }).catch((reason) => { if (active) setError(message(reason)); });
    return () => { active = false; };
  }, [agentId]);
  const providers = runtime?.providers ?? [];
  const providerStatus = providers.find((candidate) => candidate.provider === provider);
  const models = providerStatus?.capabilities.models ?? [];
  const modelCapability = models.find(({ id }) => id === model);
  const reasoningOptions = modelCapability?.reasoningOptions ?? [];
  const selectProvider = (value: string) => {
    const nextProvider = value === "codex" || value === "copilot" ? value : "";
    const next = providers.find((candidate) => candidate.provider === nextProvider);
    const first = next?.capabilities.models[0]; setProvider(nextProvider);
    setModel(first?.id ?? ""); setReasoningEffort(first?.defaultReasoning ?? first?.reasoningOptions[0] ?? "");
  };
  const save = async () => {
    if (!agentId || !provider || !model || !reasoningEffort) return;
    setPending(true); setError("");
    try {
      setBinding(await orchestrationApi.saveAgentBinding(agentId, {
        provider, model, reasoningEffort,
        policy: { network, readOnlyRoots: readOnlyRoots.split("\n").map((value) => value.trim()).filter(Boolean) }
      }));
    } catch (reason) { setError(message(reason)); } finally { setPending(false); }
  };
  return { runtime, binding, provider, model, reasoningEffort, network, readOnlyRoots, error, pending,
    providers, providerStatus, models, reasoningOptions, selectProvider, setModel, setReasoningEffort,
    setNetwork, setReadOnlyRoots, save,
    canSave: Boolean(agentId && provider && model && reasoningEffort && providerStatus?.health === "ready") };
}
export type AgentExecutionBindingState = ReturnType<typeof useAgentExecutionBinding>;
const message = (reason: unknown): string => reason instanceof Error ? reason.message : "Agent operation failed.";
