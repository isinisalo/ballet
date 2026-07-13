import { useEffect, useId, useRef, useState } from "react";
import type { Agent, AgentSaveRequest } from "@shared/api/workspace-contracts";
import { toErrorMessage } from "@/lib/errors";
import { useRefreshSafeDraft } from "../useRefreshSafeDraft";
import { agentTemplate } from "./agentOptions";

export type SaveAgent = (collection: "agents", item: AgentSaveRequest) => Promise<Agent>;
export type RemoveAgent = (collection: "agents", id: string) => Promise<void>;

export function useAgentEditor({ agent, save, remove, onSaved, onDeleted }: {
  agent?: Agent;
  save: SaveAgent;
  remove: RemoveAgent;
  onSaved?: (agent: Agent) => void;
  onDeleted?: (id: string) => void;
}) {
  const formId = useId();
  const nameId = useId();
  const descriptionId = useId();
  const instructionsId = useId();
  const { draft: form, setDraft: setForm, accept, dirty } = useRefreshSafeDraft<Partial<Agent>>(
    agent ?? agentTemplate(),
    agent?.id ?? "new-agent"
  );
  const [validationError, setValidationError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const operationRef = useRef<"save" | "delete" | null>(null);

  useEffect(() => {
    setValidationError("");
  }, [agent?.id]);

  const updateForm = (patch: Partial<Agent>) => setForm((current) => ({ ...current, ...patch }));
  const nameError = form.name?.trim() ? "" : "Agent name is required.";
  const instructionsError = form.instructions?.trim() ? "" : "Agent instructions are required.";
  const valid = !nameError && !instructionsError;
  const pending = saving || deleting;

  const submit = async () => {
    if (operationRef.current || !valid) return false;
    const submittedForm = form;
    operationRef.current = "save";
    setSaving(true);
    setValidationError("");
    const name = form.name?.trim();
    try {
      const saved = await save("agents", {
        ...form,
        name: name ?? "",
        description: form.description ?? "",
        instructions: form.instructions ?? "",
        skills: form.skills ?? [],
        enabled: form.enabled ?? true,
        avatar: form.avatar ?? null
      });
      accept(saved, submittedForm);
      onSaved?.(saved);
      return true;
    } catch (error) {
      setValidationError(toErrorMessage(error, "Unable to save agent."));
      return false;
    } finally {
      operationRef.current = null;
      setSaving(false);
    }
  };

  const deleteAgent = async () => {
    if (!form.id || operationRef.current) return;
    operationRef.current = "delete";
    setDeleting(true);
    const deletedId = form.id;
    setValidationError("");
    try {
      await remove("agents", deletedId);
      accept(agentTemplate());
      onDeleted?.(deletedId);
    } catch (error) {
      setValidationError(toErrorMessage(error, "Unable to delete agent."));
      throw error;
    } finally {
      operationRef.current = null;
      setDeleting(false);
    }
  };

  return {
    form, formId, nameId, descriptionId, instructionsId, validationError, dirty,
    nameError, instructionsError, valid, pending,
    updateForm, submit, deleteAgent
  };
}

export type AgentEditorState = ReturnType<typeof useAgentEditor>;
