import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EditorActions, TextField } from "@/components/shared/workspace-ui";
import type { ActionAgentDefinition, ActionDefinition } from "@shared/orchestration/environment";
import type { ActionResponse, ResourceDocument } from "../types";
import { ConfigureHeader, IssueList } from "./ConfigureHeader";
import { ActionAgentEditor, type EditableActionAgent } from "./ActionAgentEditor";
import { isAuthoringModelId, unsupportedAuthoringModelMessage } from "./agentModelPolicy";
import { useActionAgents } from "./useActionAgents";

type AgentDraft = EditableActionAgent;
type AgentPair = { validation: AgentDraft; work: AgentDraft };
type SaveAgents = {
  validationAgent: AgentDraft & { expectedDocumentHash: string };
  workAgent: AgentDraft & { expectedDocumentHash: string };
};

export function ActionWorkspace({ stateId, action, selectedAgentRole, skills, locked, onSave }: {
  stateId?: string; action?: ActionDefinition; skills: ResourceDocument[]; locked: boolean;
  selectedAgentRole?: "validation" | "work" | "invalid";
  onSave(action: ActionDefinition, agents: SaveAgents): Promise<ActionResponse | void>;
}) {
  const [draft, setDraft] = useState(action); const [agents, setAgents] = useState<AgentPair>();
  const [pending, setPending] = useState(false); const [saveError, setSaveError] = useState("");
  const submitting = useRef(false);
  const loaded = useActionAgents(stateId ?? "", action?.id ?? "");
  useEffect(() => {
    const details = loaded.details; if (!details) return;
    setAgents({ validation: editable(details.validationAgent.agent), work: editable(details.workAgent.agent) });
  }, [loaded.details]);
  if (!stateId || !action || !draft) return <><ConfigureHeader title="Action not found" description="The State or Action ID in this deep link is invalid." status="Invalid ID" /><div className="p-6"><Button nativeButton={false} render={<a href="/automation/loops" />}>Return to Environment</Button></div></>;
  const agentIssues = validateAgents(agents, loaded.models);
  const readinessIssues = [...loaded.readinessIssues, ...agentIssues];
  const formId = `action-${action.id}`;
  const dirty = JSON.stringify(draft) !== JSON.stringify(loaded.details?.action ?? action) || Boolean(agents && loaded.details
    && JSON.stringify(agents) !== JSON.stringify({ validation: editable(loaded.details.validationAgent.agent), work: editable(loaded.details.workAgent.agent) }));
  const save = async () => {
    if (!agents || !loaded.details || submitting.current || locked) return;
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
  const valid = Boolean(agents && loaded.details) && readinessIssues.length === 0;
  if (selectedAgentRole === "invalid") return <div className="min-w-0 p-3 md:p-4">
    <section role="alert" className="rounded-sm border border-destructive bg-card p-4">
      <h1 className="font-semibold">Agent selection is invalid</h1>
      <p className="mt-2 text-sm text-muted-foreground">Choose the Validation Agent or Work Agent from the canvas.</p>
      <Button className="mt-3" nativeButton={false} render={<a href={`/automation/loops/states/${encodeURIComponent(stateId)}/actions/${encodeURIComponent(action.id)}`} />}>Return to Action</Button>
    </section>
  </div>;
  const selectedAgent = selectedAgentRole === "validation" || selectedAgentRole === "work" ? selectedAgentRole : undefined;
  return <div className="min-w-0 p-3 md:p-4">
    <h1 className="sr-only">{selectedAgent === "validation" ? "Validation Agent" : selectedAgent === "work" ? "Work Agent" : action.name}</h1>
    <form id={formId} className="min-w-0 space-y-3 border bg-card p-3" onSubmit={(event) => { event.preventDefault(); void save(); }}>
      {!selectedAgent ? <>
        <TextField label="Name" layout="row" density="compact" value={draft.name} disabled={locked || pending} onChange={(name) => setDraft({ ...draft, name })} />
        <TextField label="Description" layout="row" density="compact" value={draft.description} disabled={locked || pending} onChange={(description) => setDraft({ ...draft, description })} />
        <RetryBudgetField actionId={action.id} value={draft.maxRetries} disabled={locked || pending} onChange={(maxRetries) => setDraft({ ...draft, maxRetries })} />
      </> : null}
      {selectedAgent && agents && loaded.details ? <ActionAgentEditor role={selectedAgent} agent={agents[selectedAgent]}
        composition={draft[selectedAgent]} models={loaded.models} skills={skills} disabled={locked || pending}
        onAgentChange={(next) => setAgents({ ...agents, [selectedAgent]: next })}
        onCompositionChange={(next) => setDraft({ ...draft, [selectedAgent]: next })} /> : null}
      {!agents || !loaded.details ? <p className="p-3 text-sm text-muted-foreground">Loading Action Agent TOMLs…</p> : null}
      {saveError ? <IssueList issues={[{ path: "save", message: saveError }]} /> : null}
      {readinessIssues.length ? <IssueList issues={readinessIssues.map((message) => ({ path: "agent", message }))} /> : null}
      <div className="border-t pt-3"><EditorActions saveLabel="Save Action" formId={formId} dirty={dirty} valid={valid} locked={locked} pending={pending} /></div>
    </form>
  </div>;
}

function RetryBudgetField({ actionId, value, disabled, onChange }: { actionId: string; value: number; disabled: boolean; onChange(value: number): void }) {
  const id = `max-retries-${actionId}`;
  return <div className="grid gap-1 sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:items-center"><label htmlFor={id} className="font-mono text-[0.68rem] font-medium leading-4 text-muted-foreground">maxRetries</label><div className="flex min-h-10 items-center gap-2 md:min-h-7"><Input id={id} className="h-10 w-20 text-base md:h-7 md:text-xs" type="number" min={0} value={value} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} /><span className="text-xs text-muted-foreground">{1 + value} total Work attempts</span></div></div>;
}

const editable = ({ description, developerInstructions, model, reasoningEffort }: ActionAgentDefinition): AgentDraft => ({
  description, developerInstructions, model, reasoningEffort
});
const validateAgents = (agents: AgentPair | undefined, models: Array<{ id: string; reasoningOptions: string[] }>): string[] => {
  if (!agents) return [];
  const issues: string[] = [];
  for (const role of ["validation", "work"] as const) {
    const agent = agents[role]; const model = models.find(({ id }) => id === agent.model);
    if (!agent.description.trim()) issues.push(`${role}: description is required.`);
    if (!agent.developerInstructions.trim()) issues.push(`${role}: developer instructions are required.`);
    if (!isAuthoringModelId(agent.model)) issues.push(`${role}: ${lowercaseFirst(unsupportedAuthoringModelMessage(agent.model))}`);
    else if (!model) issues.push(`${role}: model ${agent.model} is unavailable.`);
    else if (!model.reasoningOptions.includes(agent.reasoningEffort)) issues.push(`${role}: reasoning ${agent.reasoningEffort || "is missing"} is unavailable.`);
  }
  if (agents.validation.developerInstructions === agents.work.developerInstructions) issues.push("Validation and Work developer instructions must be unique.");
  return issues;
};
const lowercaseFirst = (value: string): string => value.replace(/^./, (letter) => letter.toLowerCase());
