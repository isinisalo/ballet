import { useEffect, useId, useState } from "react";
import type { Agent } from "@shared/api/workspace-contracts";
import { toErrorMessage } from "@/lib/errors";
import { agentTemplate } from "./agentOptions";

export type SaveAgent = (collection: "agents", item: Partial<Agent>) => Promise<Agent>;
export type RemoveAgent = (collection: "agents", id: string) => Promise<void>;

export function useAgentEditor({ agent, save, remove, onSaved, onNew, onDeleted }: {
  agent?: Agent;
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

  const updateForm = (patch: Partial<Agent>) => setForm((current) => ({ ...current, ...patch }));
  const newAgent = () => { setForm(agentTemplate()); setValidationError(""); onNew?.(); };

  const submit = async () => {
    setValidationError("");
    const name = form.name?.trim();
    if (!name) { setValidationError("Agent name is required."); return false; }
    try {
      const saved = await save("agents", {
        ...form,
        name,
        description: form.description ?? "",
        instructions: form.instructions ?? "",
        skills: form.skills ?? [],
        enabled: form.enabled ?? true
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
    form, formId, instructionsId, validationError,
    saveDisabled: !form.name?.trim(),
    updateForm, newAgent, submit, deleteAgent
  };
}

export type AgentEditorState = ReturnType<typeof useAgentEditor>;
