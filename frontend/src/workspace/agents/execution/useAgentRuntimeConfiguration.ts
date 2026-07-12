import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentRuntimeConfiguration, LocalRuntime } from "@shared/api/workspace-contracts";
import { toErrorMessage } from "@/lib/errors";
import { agentExecutionApi } from "./agentExecutionApi";
import { executionFormError, formFromRuntimeConfiguration } from "./executionOptions";
import type { AgentExecutionFormValue } from "./types";

export function useAgentRuntimeConfiguration(agentId: string, runtime: LocalRuntime, initial?: AgentRuntimeConfiguration) {
  const [configuration, setConfiguration] = useState<AgentRuntimeConfiguration | undefined>(initial);
  const [form, setForm] = useState(() => formFromRuntimeConfiguration(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const formRef = useRef(form);
  const revisionRef = useRef(0);
  const requestRef = useRef(0);
  const queueRef = useRef(Promise.resolve());
  const generationRef = useRef(0);
  const agentIdRef = useRef(agentId);
  const initialRef = useRef(initial);
  const receivedFormFingerprintRef = useRef(JSON.stringify(formFromRuntimeConfiguration(initial)));
  initialRef.current = initial;
  const initialFingerprint = JSON.stringify(initial);

  const applyConfiguration = useCallback((next?: AgentRuntimeConfiguration) => {
    const nextForm = formFromRuntimeConfiguration(next);
    setConfiguration(next);
    setForm(nextForm);
    formRef.current = nextForm;
    receivedFormFingerprintRef.current = JSON.stringify(nextForm);
    revisionRef.current += 1;
  }, []);

  useEffect(() => {
    const next = initialRef.current;
    const nextFormFingerprint = JSON.stringify(formFromRuntimeConfiguration(next));
    const previousFormFingerprint = receivedFormFingerprintRef.current;
    const agentChanged = agentIdRef.current !== agentId;
    receivedFormFingerprintRef.current = nextFormFingerprint;
    setConfiguration(next);
    if (agentChanged) {
      agentIdRef.current = agentId;
      generationRef.current += 1;
      requestRef.current += 1;
      queueRef.current = Promise.resolve();
      setSaving(false);
      setError("");
    }
    if (agentChanged || JSON.stringify(formRef.current) === previousFormFingerprint) applyConfiguration(next);
  }, [agentId, applyConfiguration, initialFingerprint]);

  const replaceForm = (next: AgentExecutionFormValue) => {
    const revision = ++revisionRef.current;
    formRef.current = next;
    setForm(next);
    return revision;
  };
  const updateForm = (patch: Partial<AgentExecutionFormValue>) => replaceForm({ ...formRef.current, ...patch });
  const save = (next = formRef.current, revision = revisionRef.current) => {
    const requestId = ++requestRef.current;
    const generation = generationRef.current;
    setSaving(true);
    setError("");
    const task = async () => {
      try {
        if (!next.provider) return false;
        const saved = await agentExecutionApi.saveRuntime(agentId, { provider: next.provider, model: next.model, reasoning: next.reasoning, policy: next.policy });
        if (generation === generationRef.current && revision === revisionRef.current) applyConfiguration(saved);
        return true;
      } catch (cause) {
        if (generation === generationRef.current && revision === revisionRef.current) setError(toErrorMessage(cause, "Unable to save agent execution configuration."));
        return false;
      } finally {
        if (generation === generationRef.current && requestId === requestRef.current) setSaving(false);
      }
    };
    const pending = queueRef.current.then(task, task);
    queueRef.current = pending.then(() => undefined, () => undefined);
    return pending;
  };
  const updateAndSave = (patch: Partial<AgentExecutionFormValue>) => {
    const next = { ...formRef.current, ...patch };
    const revision = replaceForm(next);
    return executionFormError(next, runtime.providers) ? Promise.resolve(false) : save(next, revision);
  };
  const selectProvider = (provider: AgentExecutionFormValue["provider"]) => {
    const preservesIntent = provider === configuration?.intent?.provider;
    return updateAndSave({
      provider,
      model: preservesIntent ? formRef.current.model : "",
      reasoning: preservesIntent ? formRef.current.reasoning : "",
      policy: preservesIntent ? formRef.current.policy : { network: false, readOnlyRoots: [] }
    });
  };
  return { providers: runtime.providers, configuration, form, saving, error, updateForm, updateAndSave, selectProvider, saveIfValid: () => executionFormError(formRef.current, runtime.providers) ? Promise.resolve(false) : save() };
}
