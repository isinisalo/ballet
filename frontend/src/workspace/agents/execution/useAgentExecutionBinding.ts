import { useCallback, useEffect, useState } from "react";
import { toErrorMessage } from "@/lib/errors";
import type { RuntimeDevice } from "../../runtimes/types";
import { agentExecutionApi } from "./agentExecutionApi";
import { emptyExecutionForm, formFromBinding } from "./executionOptions";
import type { AgentExecutionBinding, AgentExecutionFormValue } from "./types";

export function useAgentExecutionBinding(agentId: string) {
  const [devices, setDevices] = useState<RuntimeDevice[]>([]);
  const [binding, setBinding] = useState<AgentExecutionBinding | null>(null);
  const [form, setForm] = useState<AgentExecutionFormValue>(emptyExecutionForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextDevices, nextBinding] = await Promise.all([
        agentExecutionApi.listDevices(),
        agentExecutionApi.getBinding(agentId)
      ]);
      setDevices(nextDevices);
      setBinding(nextBinding);
      setForm(formFromBinding(nextBinding));
      setError("");
    } catch (caught) {
      setError(toErrorMessage(caught, "Unable to load agent execution settings."));
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => { void load(); }, [load]);

  const updateForm = (patch: Partial<AgentExecutionFormValue>) => setForm((current) => ({ ...current, ...patch }));
  const selectDevice = (deviceId: string) => setForm({ ...emptyExecutionForm(), deviceId });
  const selectBackend = (runtimeBackendId: string) => setForm((current) => ({
    ...current,
    runtimeBackendId,
    model: "",
    reasoning: "",
    policy: { network: false, readOnlyRoots: [] }
  }));

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const saved = await agentExecutionApi.saveBinding(agentId, {
        runtimeBackendId: form.runtimeBackendId,
        model: form.model,
        reasoning: form.reasoning,
        policy: form.policy
      });
      setBinding(saved);
      setForm(formFromBinding(saved));
      return true;
    } catch (caught) {
      setError(toErrorMessage(caught, "Unable to save agent execution settings."));
      return false;
    } finally {
      setSaving(false);
    }
  };

  return { devices, binding, form, loading, saving, error, updateForm, selectDevice, selectBackend, save, reload: load };
}
