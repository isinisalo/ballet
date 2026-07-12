import { useEffect, useId, useState } from "react";
import type { Agent, AgentSaveRequest } from "@shared/api/workspace-contracts";
import { toErrorMessage } from "@/lib/errors";
import { useRefreshSafeDraft } from "../useRefreshSafeDraft";
import { agentTemplate } from "./agentOptions";

export type SaveAgent = (collection: "agents", item: AgentSaveRequest) => Promise<Agent>;
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
  const { draft: form, setDraft: setForm, accept, dirty } = useRefreshSafeDraft<Partial<Agent>>(
    agent ?? agentTemplate(),
    agent?.id ?? "new-agent"
  );
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    setValidationError("");
  }, [agent?.id]);

  const updateForm = (patch: Partial<Agent>) => setForm((current) => ({ ...current, ...patch }));
  const newAgent = () => { accept(agentTemplate()); setValidationError(""); onNew?.(); };

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
        enabled: form.enabled ?? true,
        avatar: form.avatar ?? null
      });
      accept(saved);
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
      accept(agentTemplate());
      onDeleted?.(deletedId);
    } catch (error) {
      setValidationError(toErrorMessage(error, "Unable to delete agent."));
      throw error;
    }
  };

  return {
    form, formId, instructionsId, validationError, dirty,
    saveDisabled: !form.name?.trim(),
    updateForm, newAgent, submit, deleteAgent
  };
}

export type AgentEditorState = ReturnType<typeof useAgentEditor>;
