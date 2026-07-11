import { toErrorMessage } from "@/lib/errors";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RuntimeDevice } from "../../runtimes/types";
import { agentExecutionApi } from "./agentExecutionApi";
import { emptyExecutionForm, executionFormError, formFromBinding } from "./executionOptions";
import type { AgentExecutionBinding, AgentExecutionFormValue } from "./types";

export function useAgentExecutionBinding(agentId: string) {
  const [devices, setDevices] = useState<RuntimeDevice[]>([]);
  const [binding, setBinding] = useState<AgentExecutionBinding | null>(null);
  const [form, setForm] = useState<AgentExecutionFormValue>(emptyExecutionForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const formRef = useRef(form);
  const formRevision = useRef(0);
  const saveRequest = useRef(0);
  const saveQueue = useRef(Promise.resolve());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextDevices, nextBinding] = await Promise.all([
        agentExecutionApi.listDevices(),
        agentExecutionApi.getBinding(agentId)
      ]);
      setDevices(nextDevices);
      setBinding(nextBinding);
      const nextForm = formFromBinding(nextBinding);
      formRevision.current += 1;
      formRef.current = nextForm;
      setForm(nextForm);
      setError("");
    } catch (caught) {
      setError(toErrorMessage(caught, "Unable to load agent execution settings."));
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => { void load(); }, [load]);

  const replaceForm = (nextForm: AgentExecutionFormValue) => {
    const revision = ++formRevision.current;
    formRef.current = nextForm;
    setForm(nextForm);
    return revision;
  };
  const updateForm = (patch: Partial<AgentExecutionFormValue>) => replaceForm({ ...formRef.current, ...patch });

  const save = (nextForm = formRef.current, revision = formRevision.current) => {
    const request = ++saveRequest.current;
    setSaving(true);
    setError("");
    const saveTask = async () => {
      try {
        const saved = await agentExecutionApi.saveBinding(agentId, {
          runtimeBackendId: nextForm.runtimeBackendId,
          model: nextForm.model,
          reasoning: nextForm.reasoning,
          policy: nextForm.policy
        });
        setBinding(saved);
        if (revision === formRevision.current) {
          const savedForm = formFromBinding(saved);
          formRef.current = savedForm;
          setForm(savedForm);
        }
        return true;
      } catch (caught) {
        if (revision === formRevision.current) setError(toErrorMessage(caught, "Unable to save agent execution settings."));
        return false;
      } finally {
        if (request === saveRequest.current) setSaving(false);
      }
    };
    const pendingSave = saveQueue.current.then(saveTask, saveTask);
    saveQueue.current = pendingSave.then(() => undefined, () => undefined);
    return pendingSave;
  };

  const updateAndSave = (patch: Partial<AgentExecutionFormValue>) => {
    const nextForm = { ...formRef.current, ...patch };
    const revision = replaceForm(nextForm);
    return executionFormError(nextForm, devices) ? Promise.resolve(false) : save(nextForm, revision);
  };
  const saveIfValid = () => executionFormError(formRef.current, devices) ? Promise.resolve(false) : save();
  const selectDevice = (deviceId: string) => updateAndSave({ ...emptyExecutionForm(), deviceId });
  const selectBackend = (runtimeBackendId: string) => updateAndSave({
    runtimeBackendId,
    model: "",
    reasoning: "",
    policy: { network: false, readOnlyRoots: [] }
  });

  return { devices, binding, form, loading, saving, error, updateForm, updateAndSave, selectDevice, selectBackend, save, saveIfValid, reload: load };
}
