import { useEffect, useState } from "react";
import type { ActionExecutionBinding, ActionExecutionRole, ActionRoleModelSelection, LocalDaemonStatus } from "@shared/domain/runtime";
import { orchestrationApi } from "../orchestrationApi";

const emptyRole = (): ActionRoleModelSelection => ({ model: "", reasoningEffort: "" });

export function useActionExecutionBinding(stateId: string, actionId: string) {
  const [runtime, setRuntime] = useState<LocalDaemonStatus>(); const [binding, setBinding] = useState<ActionExecutionBinding | null>(null);
  const [validation, setValidation] = useState<ActionRoleModelSelection>(emptyRole); const [work, setWork] = useState<ActionRoleModelSelection>(emptyRole);
  const [error, setError] = useState(""); const [pending, setPending] = useState(false); const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!stateId || !actionId) { setLoaded(true); return; }
    let active = true;
    void Promise.all([orchestrationApi.localRuntime(), orchestrationApi.actionBinding(stateId, actionId)])
      .then(([nextRuntime, nextBinding]) => { if (!active) return; setRuntime(nextRuntime); setBinding(nextBinding);
        setValidation(nextBinding?.validation ?? emptyRole()); setWork(nextBinding?.work ?? emptyRole()); setLoaded(true); })
      .catch((reason) => { if (active) { setError(message(reason)); setLoaded(true); } });
    return () => { active = false; };
  }, [actionId, stateId]);
  const providerStatus = runtime?.providers[0]; const models = providerStatus?.capabilities.models ?? [];
  const setRoleModel = (role: ActionExecutionRole, model: string) => { const selected = models.find(({ id }) => id === model);
    setRole(role, { model, reasoningEffort: selected?.defaultReasoning ?? selected?.reasoningOptions[0] ?? "" }); };
  const setRoleReasoning = (role: ActionExecutionRole, reasoningEffort: string) => setRole(role, { ...(role === "validation" ? validation : work), reasoningEffort });
  const setRole = (role: ActionExecutionRole, value: ActionRoleModelSelection) => { if (role === "validation") setValidation(value); else setWork(value); };
  const readinessIssues = bindingReadiness(loaded, binding, runtime, providerStatus); const draftIssues = selectionIssues(validation, work, providerStatus);
  const save = async () => { if (draftIssues.length > 0) return; setPending(true); setError("");
    try { setBinding(await orchestrationApi.saveActionBinding(stateId, actionId, { validation, work })); }
    catch (reason) { setError(message(reason)); } finally { setPending(false); } };
  return { binding, validation, work, error, pending, readinessIssues, draftIssues, providerStatus, models,
    setRoleModel, setRoleReasoning, save, canSave: draftIssues.length === 0 };
}
export type ActionExecutionState = ReturnType<typeof useActionExecutionBinding>;

const message = (reason: unknown): string => reason instanceof Error ? reason.message : "Action execution operation failed.";
const roleIssue = (role: ActionExecutionRole, value: ActionRoleModelSelection, provider: NonNullable<LocalDaemonStatus["providers"][number]>) => {
  const model = provider.capabilities.models.find(({ id }) => id === value.model);
  if (!model) return `${role}: model ${value.model || "is missing"} is not available from Codex.`;
  if (!model.reasoningOptions.includes(value.reasoningEffort)) return `${role}: reasoning ${value.reasoningEffort || "is missing"} is not available for ${value.model}.`;
  return undefined;
};
function selectionIssues(validation: ActionRoleModelSelection, work: ActionRoleModelSelection,
  status: LocalDaemonStatus["providers"][number] | undefined): string[] {
  if (!status || status.health !== "ready") return ["A ready Codex runtime is required."];
  const issues = [roleIssue("validation", validation, status), roleIssue("work", work, status)].filter((value): value is string => Boolean(value));
  if (!status.capabilities.policy.workspaceWrite) issues.push("Work: Codex cannot provide managed workspace-write.");
  return issues;
}
function bindingReadiness(loaded: boolean, binding: ActionExecutionBinding | null, runtime: LocalDaemonStatus | undefined,
  provider: LocalDaemonStatus["providers"][number] | undefined): string[] {
  if (!loaded) return []; if (!binding) return ["Action execution binding is missing."];
  if (runtime?.status !== "online") return [`Local Codex runtime is ${runtime?.status ?? "unavailable"}.`];
  return selectionIssues(binding.validation, binding.work, provider);
}
