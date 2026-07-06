import { useEffect, useId, useState } from "react";
import type { Agent } from "../../../../shared/api/workspace-contracts";
import type { Runtime } from "../../../../shared/api/workspace-contracts";
import { toErrorMessage } from "@/lib/errors";
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
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    setForm(agent ?? agentTemplate());
    setValidationError("");
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
    setValidationError("");
    onNew?.();
  };

  const submit = async () => {
    setValidationError("");
    const name = form.name?.trim();
    if (!name) {
      setValidationError("Agent name is required.");
      return false;
    }

    try {
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
      return true;
    } catch (error) {
      setValidationError(toErrorMessage(error, "Unable to save agent."));
      return false;
    }
  };

  const deleteAgent = async () => {
    if (!form.id) return;
    const deletedId = form.id;
    setValidationError("");
    try {
      await remove("agents", deletedId);
      setForm(agentTemplate());
      onDeleted?.(deletedId);
    } catch (error) {
      setValidationError(toErrorMessage(error, "Unable to delete agent."));
      throw error;
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
    validationError,
    saveDisabled: !form.name?.trim(),
    updateForm,
    updateRuntime,
    newAgent,
    submit,
    deleteAgent
  };
}

export type AgentEditorState = ReturnType<typeof useAgentEditor>;
