import { useEffect, useRef, useState } from "react";
import type { ActionDefinition } from "@shared/orchestration/environment";
import type { ActionResponse } from "../types";
import { useActionAgents } from "./useActionAgents";
import { editable, type AgentPair, type SaveAgents } from "./actionDraft";

export function useActionDraft(stateId: string | undefined, action: ActionDefinition | undefined, locked: boolean,
  onSave: (action: ActionDefinition, agents: SaveAgents) => Promise<ActionResponse | void>) {
  const [draft, setDraft] = useState(action); const [agents, setAgents] = useState<AgentPair>();
  const [pending, setPending] = useState(false); const [saveError, setSaveError] = useState("");
  const submitting = useRef(false);
  const loaded = useActionAgents(stateId ?? "", action?.id ?? "");
  useEffect(() => {
    const details = loaded.details; if (!details) return;
    setAgents({ validation: editable(details.validationAgent.agent), work: editable(details.workAgent.agent) });
  }, [loaded.details]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(loaded.details?.action ?? action) || Boolean(agents && loaded.details
    && JSON.stringify(agents) !== JSON.stringify({ validation: editable(loaded.details.validationAgent.agent), work: editable(loaded.details.workAgent.agent) }));
  const save = async () => {
    if (!draft || !agents || !loaded.details || submitting.current || locked) return;
    submitting.current = true; setPending(true); setSaveError("");
    try {
      const saved = await onSave(draft, {
        validationAgent: { ...agents.validation, expectedDocumentHash: loaded.details.validationAgent.contentHash },
        workAgent: { ...agents.work, expectedDocumentHash: loaded.details.workAgent.contentHash }
      });
      if (saved) { loaded.acceptSaved(saved); setDraft(saved.action); }
    } catch (error) { setSaveError(error instanceof Error ? error.message : "Unable to save Action."); }
    finally { submitting.current = false; setPending(false); }
  };
  return { draft, setDraft, agents, setAgents, loaded, dirty, save, pending, saveError };
}
