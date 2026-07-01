import { useEffect, useId, useState } from "react";
import type { Agent, Runtime } from "../../../../shared/domain";
import { agentTemplate, codexModelOptions, reasoningEffortOptions } from "./agentOptions";

export type SaveAgent = (collection: "agents", item: Partial<Agent>) => Promise<Agent>;
export type RemoveAgent = (collection: "agents", id: string) => Promise<void>;

export function useAgentEditor({
  agent,
  runtimes,
  save,
  remove,
  onSaved,
  onNew,
  onDeleted
}: {
  agent?: Agent;
  runtimes: Runtime[];
  save: SaveAgent;
  remove: RemoveAgent;
  onSaved?: (agent: Agent) => void;
  onNew?: () => void;
  onDeleted?: (id: string) => void;
}) {
  const formId = useId();
  const instructionsId = useId();
  const [form, setForm] = useState<Partial<Agent>>(agent ?? agentTemplate());

  useEffect(() => {
    setForm(agent ?? agentTemplate());
  }, [agent]);

  const frontmatterRuntime = typeof form.frontmatter?.runtime === "string" ? form.frontmatter.runtime : "";
  const runtime = runtimes.find((candidate) => candidate.id === frontmatterRuntime || candidate.name === frontmatterRuntime) ?? runtimes.find((candidate) => candidate.enabled) ?? runtimes[0];
  const runtimeValue = runtime?.id ?? "";
  const runtimeOptions = runtimes.map((candidate) => ({ value: candidate.id, label: candidate.name || candidate.type }));
  const modelValue = form.model || (typeof form.frontmatter?.model === "string" ? form.frontmatter.model : "") || "gpt-5.5";
  const reasoningValue = form.modelReasoningEffort || (typeof form.frontmatter?.model_reasoning_effort === "string" ? form.frontmatter.model_reasoning_effort : "") || "medium";
  const modelOptions = codexModelOptions.some((option) => option.value === modelValue)
    ? codexModelOptions
    : [{ value: modelValue, label: modelValue }, ...codexModelOptions];
  const reasoningOptions = reasoningEffortOptions.some((option) => option.value === reasoningValue)
    ? reasoningEffortOptions
    : [{ value: reasoningValue, label: reasoningValue }, ...reasoningEffortOptions];

  const updateForm = (patch: Partial<Agent>) => {
    setForm((current) => ({ ...current, ...patch }));
  };

  const updateRuntime = (runtimeId: string) => {
    updateForm({ frontmatter: { ...form.frontmatter, runtime: runtimeId } });
  };

  const newAgent = () => {
    setForm(agentTemplate());
    onNew?.();
  };

  const submit = async () => {
    try {
      const name = form.name?.trim();
      if (!name) throw new Error("Agent name is required.");
      const saved = await save("agents", {
        ...form,
        name,
        description: form.description ?? "",
        instructions: form.instructions ?? "",
        skills: form.skills ?? [],
        enabled: form.enabled ?? true,
        status: form.status ?? "offline",
        model: modelValue,
        modelReasoningEffort: reasoningValue
      });
      setForm(saved);
      onSaved?.(saved);
    } catch {
      // Save failures are surfaced by the shared mutation notification layer.
    }
  };

  const deleteAgent = async () => {
    if (!form.id) return;
    const deletedId = form.id;
    try {
      await remove("agents", deletedId);
      setForm(agentTemplate());
      onDeleted?.(deletedId);
    } catch {
      // Delete failures are surfaced by the shared mutation notification layer.
    }
  };

  return {
    form,
    formId,
    instructionsId,
    runtimeValue,
    runtimeOptions,
    modelValue,
    modelOptions,
    reasoningValue,
    reasoningOptions,
    saveDisabled: !form.name?.trim(),
    updateForm,
    updateRuntime,
    newAgent,
    submit,
    deleteAgent
  };
}

export type AgentEditorState = ReturnType<typeof useAgentEditor>;
