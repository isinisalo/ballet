import { useEffect, useId, useRef, useState } from "react";
import type { Agent, AgentNodeStyle } from "@shared/api/workspace-contracts";
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
  const [nodeStyleSaving, setNodeStyleSaving] = useState(false);
  const [nodeStyleError, setNodeStyleError] = useState("");
  const formRef = useRef(form);

  useEffect(() => {
    const nextForm = agent ?? agentTemplate();
    formRef.current = nextForm;
    setForm(nextForm);
    setValidationError("");
  }, [agent]);

  const replaceForm = (nextForm: Partial<Agent>) => {
    formRef.current = nextForm;
    setForm(nextForm);
  };
  const updateForm = (patch: Partial<Agent>) => replaceForm({ ...formRef.current, ...patch });
  const newAgent = () => { replaceForm(agentTemplate()); setValidationError(""); onNew?.(); };

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
      replaceForm(saved);
      onSaved?.(saved);
      return true;
    } catch (error) {
      setValidationError(toErrorMessage(error, "Unable to save agent."));
      return false;
    }
  };

  const saveNodeStyle = async (nodeStyle: AgentNodeStyle) => {
    const id = formRef.current.id ?? agent?.id;
    if (!id) return false;
    const pendingForm = { ...formRef.current, nodeStyle };
    replaceForm(pendingForm);
    setNodeStyleSaving(true);
    setNodeStyleError("");
    try {
      const saved = await save("agents", { id, nodeStyle });
      replaceForm({ ...pendingForm, nodeStyle: saved.nodeStyle });
      return true;
    } catch (error) {
      setNodeStyleError(toErrorMessage(error, "Unable to save node style."));
      return false;
    } finally {
      setNodeStyleSaving(false);
    }
  };

  const deleteAgent = async () => {
    if (!form.id) return;
    const deletedId = form.id;
    setValidationError("");
    try {
      await remove("agents", deletedId);
      replaceForm(agentTemplate());
      onDeleted?.(deletedId);
    } catch (error) {
      setValidationError(toErrorMessage(error, "Unable to delete agent."));
      throw error;
    }
  };

  return {
    form, formId, instructionsId, validationError, nodeStyleSaving, nodeStyleError,
    saveDisabled: !form.name?.trim(),
    updateForm, saveNodeStyle, newAgent, submit, deleteAgent
  };
}

export type AgentEditorState = ReturnType<typeof useAgentEditor>;
