import { toErrorMessage } from "@/lib/errors";
import type { AgentRuntimeConfiguration } from "@shared/api/workspace-contracts";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRuntimeStream } from "@/app/useRuntimeStream";
import type { RuntimeDevice } from "../../runtimes/types";
import { agentExecutionApi } from "./agentExecutionApi";
import { emptyExecutionForm, executionFormError, formFromRuntimeConfiguration } from "./executionOptions";
import type { AgentExecutionFormValue } from "./types";

export function useAgentRuntimeConfiguration(agentId: string) {
  const [devices, setDevices] = useState<RuntimeDevice[]>([]);
  const [configuration, setConfiguration] = useState<AgentRuntimeConfiguration>();
  const [form, setForm] = useState<AgentExecutionFormValue>(emptyExecutionForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const formRef = useRef(form);
  const revisionRef = useRef(0);
  const requestRef = useRef(0);
  const queueRef = useRef(Promise.resolve());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextDevices, nextConfiguration] = await Promise.all([agentExecutionApi.listDevices(), agentExecutionApi.getRuntime(agentId)]);
      const nextForm = formFromRuntimeConfiguration(nextConfiguration, nextDevices);
      setDevices(nextDevices); setConfiguration(nextConfiguration); setForm(nextForm); formRef.current = nextForm;
      revisionRef.current += 1; setError("");
    } catch (caught) { setError(toErrorMessage(caught, "Unable to load agent runtime configuration.")); }
    finally { setLoading(false); }
  }, [agentId]);

  useEffect(() => { void load(); }, [load]);
  useRuntimeStream(load);
  const replaceForm = (next: AgentExecutionFormValue) => { const revision = ++revisionRef.current; formRef.current = next; setForm(next); return revision; };
  const updateForm = (patch: Partial<AgentExecutionFormValue>) => replaceForm({ ...formRef.current, ...patch });
  const save = (next = formRef.current, revision = revisionRef.current) => {
    const requestId = ++requestRef.current; setSaving(true); setError("");
    const task = async () => {
      try {
        const saved = await agentExecutionApi.saveRuntime(agentId, { runtimeBackendId: next.runtimeBackendId, model: next.model, reasoning: next.reasoning, policy: next.policy });
        setConfiguration(saved);
        if (revision === revisionRef.current) { const savedForm = formFromRuntimeConfiguration(saved, devices); formRef.current = savedForm; setForm(savedForm); }
        return true;
      } catch (caught) { if (revision === revisionRef.current) setError(toErrorMessage(caught, "Unable to save agent runtime configuration.")); return false; }
      finally { if (requestId === requestRef.current) setSaving(false); }
    };
    const pending = queueRef.current.then(task, task); queueRef.current = pending.then(() => undefined, () => undefined); return pending;
  };
  const updateAndSave = (patch: Partial<AgentExecutionFormValue>) => { const next = { ...formRef.current, ...patch }; const revision = replaceForm(next); return executionFormError(next, devices) ? Promise.resolve(false) : save(next, revision); };
  const selectDevice = (deviceId: string) => {
    const device = devices.find((candidate) => candidate.id === deviceId);
    const portableProvider = configuration?.intent?.provider;
    const compatible = portableProvider ? device?.backends.find((backend) => backend.provider === portableProvider) : undefined;
    const switchingDevice = formRef.current.deviceId !== deviceId;
    return updateAndSave({
      deviceId,
      runtimeBackendId: compatible?.id ?? "",
      model: compatible ? formRef.current.model : "",
      reasoning: compatible ? formRef.current.reasoning : "",
      policy: {
        network: compatible ? formRef.current.policy.network : false,
        readOnlyRoots: switchingDevice ? [] : formRef.current.policy.readOnlyRoots
      }
    });
  };
  const selectBackend = (runtimeBackendId: string) => {
    const backend = devices.flatMap((device) => device.backends).find((candidate) => candidate.id === runtimeBackendId);
    const preservesIntent = Boolean(backend && backend.provider === configuration?.intent?.provider);
    return updateAndSave({
      runtimeBackendId,
      model: preservesIntent ? formRef.current.model : "",
      reasoning: preservesIntent ? formRef.current.reasoning : "",
      policy: preservesIntent ? formRef.current.policy : { network: false, readOnlyRoots: [] }
    });
  };
  return { devices, configuration, form, loading, saving, error, updateForm, updateAndSave, selectDevice, selectBackend, saveIfValid: () => executionFormError(formRef.current, devices) ? Promise.resolve(false) : save(), reload: load };
}
