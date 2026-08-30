import { useEffect, useState } from "react";
import type { ActionExecutionBinding, ActionExecutionRole, ActionRoleModelSelection, ExecutionPolicy,
  LocalDaemonStatus, RuntimeProvider } from "@shared/domain/runtime";
import { orchestrationApi } from "../orchestrationApi";

const emptyRole = (): ActionRoleModelSelection => ({ model: "", reasoningEffort: "" });

export function useActionExecutionBinding(stateId: string, actionId: string) {
  const [runtime, setRuntime] = useState<LocalDaemonStatus>();
  const [binding, setBinding] = useState<ActionExecutionBinding | null>(null);
  const [provider, setProvider] = useState<RuntimeProvider | "">("");
  const [policy, setPolicy] = useState<ExecutionPolicy>({ network: false, readOnlyRoots: [] });
  const [validation, setValidation] = useState<ActionRoleModelSelection>(emptyRole);
  const [work, setWork] = useState<ActionRoleModelSelection>(emptyRole);
  const [error, setError] = useState(""); const [pending, setPending] = useState(false); const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!stateId || !actionId) { setLoaded(true); return; }
    let active = true;
    void Promise.all([orchestrationApi.localRuntime(), orchestrationApi.actionBinding(stateId, actionId)])
      .then(([nextRuntime, nextBinding]) => {
        if (!active) return;
        setRuntime(nextRuntime); setBinding(nextBinding); setProvider(nextBinding?.provider ?? "");
        setPolicy(nextBinding?.policy ?? { network: false, readOnlyRoots: [] });
        setValidation(nextBinding?.validation ?? emptyRole()); setWork(nextBinding?.work ?? emptyRole()); setLoaded(true);
      }).catch((reason) => { if (active) { setError(message(reason)); setLoaded(true); } });
    return () => { active = false; };
  }, [actionId, stateId]);
  const providers = runtime?.providers ?? [];
  const providerStatus = providers.find((candidate) => candidate.provider === provider);
  const models = providerStatus?.capabilities.models ?? [];
  const selectProvider = (value: string) => {
    const nextProvider = value === "codex" || value === "copilot" ? value : "";
    const first = providers.find(({ provider: candidate }) => candidate === nextProvider)?.capabilities.models[0];
    const initial = { model: first?.id ?? "", reasoningEffort: first?.defaultReasoning ?? first?.reasoningOptions[0] ?? "" };
    setProvider(nextProvider); setValidation(initial); setWork({ ...initial });
  };
  const setRoleModel = (role: ActionExecutionRole, model: string) => {
    const selected = models.find(({ id }) => id === model);
    setRole(role, { model, reasoningEffort: selected?.defaultReasoning ?? selected?.reasoningOptions[0] ?? "" });
  };
  const setRoleReasoning = (role: ActionExecutionRole, reasoningEffort: string) => setRole(role, {
    ...(role === "validation" ? validation : work), reasoningEffort
  });
  const setRole = (role: ActionExecutionRole, value: ActionRoleModelSelection) => {
    if (role === "validation") setValidation(value); else setWork(value);
  };
  const readinessIssues = bindingReadiness(loaded, binding, runtime, providers);
  const draftIssues = selectionIssues(provider, policy, validation, work, providerStatus);
  const save = async () => {
    if (draftIssues.length > 0 || !provider) return;
    setPending(true); setError("");
    try { setBinding(await orchestrationApi.saveActionBinding(stateId, actionId, { provider, policy, validation, work })); }
    catch (reason) { setError(message(reason)); } finally { setPending(false); }
  };
  return { binding, provider, policy, validation, work, error, pending, readinessIssues, draftIssues,
    providers, providerStatus, models, selectProvider, setRoleModel, setRoleReasoning,
    setNetwork: (network: boolean) => setPolicy((current) => ({ ...current, network })),
    setReadOnlyRoots: (value: string) => setPolicy((current) => ({ ...current,
      readOnlyRoots: value.split("\n").map((root) => root.trim()).filter(Boolean) })),
    save, canSave: draftIssues.length === 0 && Boolean(provider) };
}
export type ActionExecutionState = ReturnType<typeof useActionExecutionBinding>;

const message = (reason: unknown): string => reason instanceof Error ? reason.message : "Action execution operation failed.";
const roleIssue = (role: ActionExecutionRole, value: ActionRoleModelSelection, provider: LocalDaemonStatus["providers"][number]) => {
  const model = provider.capabilities.models.find(({ id }) => id === value.model);
  if (!model) return `${role}: model ${value.model || "is missing"} is not available from ${provider.provider}.`;
  if (!model.reasoningOptions.includes(value.reasoningEffort)) return `${role}: reasoning ${value.reasoningEffort || "is missing"} is not available for ${value.model}.`;
  return undefined;
};
function selectionIssues(provider: RuntimeProvider | "", policy: ExecutionPolicy, validation: ActionRoleModelSelection,
  work: ActionRoleModelSelection, status: LocalDaemonStatus["providers"][number] | undefined): string[] {
  if (!provider || !status || status.health !== "ready") return ["A ready provider is required."];
  const issues = [roleIssue("validation", validation, status), roleIssue("work", work, status)].filter((value): value is string => Boolean(value));
  if (!status.capabilities.policy.workspaceWrite) issues.push("Work: provider cannot provide managed workspace-write.");
  if (policy.network && !status.capabilities.policy.networkControl) issues.push("Provider cannot enforce the selected network policy.");
  if (policy.readOnlyRoots.length > 0 && !status.capabilities.policy.readOnlyRoots) issues.push("Provider cannot enforce the selected read-only roots.");
  return issues;
}
function bindingReadiness(loaded: boolean, binding: ActionExecutionBinding | null, runtime: LocalDaemonStatus | undefined,
  providers: LocalDaemonStatus["providers"]): string[] {
  if (!loaded) return [];
  if (!binding) return ["Action execution binding is missing."];
  if (runtime?.status !== "online") return [`Local provider runtime is ${runtime?.status ?? "unavailable"}.`];
  const provider = providers.find(({ provider: candidate }) => candidate === binding.provider);
  if (!provider || provider.health !== "ready") return [`Provider ${binding.provider} is not ready.`];
  return selectionIssues(binding.provider, binding.policy, binding.validation, binding.work, provider);
}
