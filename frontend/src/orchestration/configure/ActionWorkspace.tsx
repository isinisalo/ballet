import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MultiSelect } from "@/components/ui/multi-select";
import { EditorActions, SelectField, TextField } from "@/components/shared/workspace-ui";
import type { ActionAgentDefinition, ActionDefinition } from "@shared/orchestration/environment";
import type { ResourceDocument } from "../types";
import { ConfigureHeader, IssueList } from "./ConfigureHeader";
import { ConfigureToolbar } from "./ConfigureToolbar";
import { useActionAgents } from "./useActionAgents";

type AgentDraft = Omit<ActionAgentDefinition, "id" | "name">;
type AgentPair = { validation: AgentDraft; work: AgentDraft };
type SaveAgents = {
  validationAgent: AgentDraft & { expectedDocumentHash: string };
  workAgent: AgentDraft & { expectedDocumentHash: string };
};

export function ActionWorkspace({ stateId, action, skills, locked, canvasMode, navigate, onCanvasModeChange, onDelete, onSave }: {
  stateId?: string; action?: ActionDefinition; skills: ResourceDocument[]; locked: boolean; canvasMode?: "flow";
  navigate(path: string): void; onCanvasModeChange(mode: "space" | "flow"): void; onDelete?(): Promise<void>;
  onSave(action: ActionDefinition, agents: SaveAgents): Promise<void>;
}) {
  const [draft, setDraft] = useState(action); const [agents, setAgents] = useState<AgentPair>();
  const loaded = useActionAgents(stateId ?? "", action?.id ?? "");
  useEffect(() => {
    const details = loaded.details; if (!details) return;
    setAgents({ validation: editable(details.validationAgent.agent), work: editable(details.workAgent.agent) });
  }, [loaded.details]);
  if (!stateId || !action || !draft) return <><ConfigureHeader title="Action not found" description="The State or Action ID in this deep link is invalid." status="Invalid ID" /><div className="p-6"><Button onClick={() => navigate("/automation/loops")}>Return to Environment</Button></div></>;
  const agentIssues = validateAgents(agents, loaded.models);
  const readinessIssues = [...loaded.readinessIssues, ...agentIssues];
  const status = locked ? "Locked by active Run" : readinessIssues.length ? "Not ready" : "Ready";
  const formId = `action-${action.id}`;
  const dirty = JSON.stringify(draft) !== JSON.stringify(action) || Boolean(agents && loaded.details
    && JSON.stringify(agents) !== JSON.stringify({ validation: editable(loaded.details.validationAgent.agent), work: editable(loaded.details.workAgent.agent) }));
  const save = async () => {
    if (!agents || !loaded.details) return;
    await onSave(draft, {
      validationAgent: { ...agents.validation, expectedDocumentHash: loaded.details.validationAgent.contentHash },
      workAgent: { ...agents.work, expectedDocumentHash: loaded.details.workAgent.contentHash }
    });
  };
  return <><ConfigureHeader title={action.name} description="Validation is the main controller; Work is a subordinate execution role." /><ConfigureToolbar status={status} label={action.id}><Button variant="outline" onClick={() => navigate(`/automation/loops/states/${encodeURIComponent(stateId)}`)}><ArrowLeft />State</Button><Button variant="outline" onClick={() => onCanvasModeChange(canvasMode === "flow" ? "space" : "flow")}>{canvasMode === "flow" ? "Show space canvas" : "Open Action flow"}</Button><EditorActions saveLabel="Save Action" formId={formId} dirty={dirty} valid={!locked && readinessIssues.length === 0} canDelete={Boolean(onDelete)} deleteLabel="Delete Action" deleteType="Action" resourceName={action.name} onDelete={onDelete} /></ConfigureToolbar>
    <div className="min-w-0 space-y-3 p-3 md:p-4"><form id={formId} className="min-w-0 space-y-2 border bg-card p-3" onSubmit={(event) => { event.preventDefault(); void save(); }}><TextField label="Name" layout="row" density="compact" value={draft.name} onChange={(name) => setDraft({ ...draft, name })} /><TextField label="Description" layout="row" density="compact" value={draft.description} onChange={(description) => setDraft({ ...draft, description })} /><RetryBudgetField actionId={action.id} value={draft.maxRetries} onChange={(maxRetries) => setDraft({ ...draft, maxRetries })} />
      {agents && loaded.details ? <><AgentEditor role="validation" agentId={draft.validation.agentId} agent={agents.validation} composition={draft.validation} models={loaded.models} skills={skills} onAgentChange={(validation) => setAgents({ ...agents, validation })} onCompositionChange={(validation) => setDraft({ ...draft, validation })} /><AgentEditor role="work" agentId={draft.work.agentId} agent={agents.work} composition={draft.work} models={loaded.models} skills={skills} onAgentChange={(work) => setAgents({ ...agents, work })} onCompositionChange={(work) => setDraft({ ...draft, work })} /></> : <p className="p-3 text-sm text-muted-foreground">Loading Action Agent TOMLs…</p>}</form><section className="rounded-md border bg-card p-4"><h2 className="font-semibold">Run readiness</h2><p className="mb-2 text-xs text-muted-foreground">Each role uses its own canonical <code>.codex/agents/*.toml</code> definition and explicit shared Skills.</p><IssueList issues={readinessIssues.map((message) => ({ path: "agent", message }))} /></section></div></>;
}

function RetryBudgetField({ actionId, value, onChange }: { actionId: string; value: number; onChange(value: number): void }) {
  const id = `max-retries-${actionId}`;
  return <div className="grid gap-1 sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:items-center"><label htmlFor={id} className="font-mono text-[0.68rem] font-medium leading-4 text-muted-foreground">maxRetries</label><div className="flex min-h-10 items-center gap-2 md:min-h-7"><Input id={id} className="h-10 w-20 text-base md:h-7 md:text-xs" type="number" min={0} value={value} onChange={(event) => onChange(Number(event.target.value))} /><span className="text-xs text-muted-foreground">{1 + value} total Work attempts</span></div></div>;
}

function AgentEditor({ role, agentId, agent, composition, models, skills, onAgentChange, onCompositionChange }: {
  role: "validation" | "work"; agentId: string; agent: AgentDraft; composition: ActionDefinition["validation"];
  models: Array<{ id: string; label: string; reasoningOptions: string[]; defaultReasoning?: string }>;
  skills: ResourceDocument[]; onAgentChange(value: AgentDraft): void; onCompositionChange(value: ActionDefinition["validation"]): void;
}) {
  const title = role === "validation" ? "Validation Agent · main/controller" : "Work Agent · subordinate";
  const reasoning = models.find(({ id }) => id === agent.model)?.reasoningOptions ?? [];
  return <fieldset className="space-y-3 rounded-sm border p-3"><legend className="font-semibold">{title}</legend><p className="break-all font-mono text-xs text-primary">{agentId}</p><p className="text-xs text-muted-foreground">Permission: {role === "validation" ? "read-only" : "managed-worktree-write"} · TOML changes apply only to future Runs.</p>
    <TextField label="Agent description" layout="row" density="compact" value={agent.description} onChange={(description) => onAgentChange({ ...agent, description })} />
    <SelectField label="Model" layout="row" density="compact" value={agent.model} options={models.map(({ id, label }) => ({ value: id, label }))} onChange={(model) => { const selected = models.find(({ id }) => id === model); onAgentChange({ ...agent, model, reasoningEffort: selected?.defaultReasoning ?? selected?.reasoningOptions[0] ?? "" }); }} />
    <SelectField label="Reasoning" layout="row" density="compact" value={agent.reasoningEffort} options={reasoning.map((value) => ({ value, label: value }))} onChange={(reasoningEffort) => onAgentChange({ ...agent, reasoningEffort })} />
    <label className="grid gap-1 text-xs"><span className="text-muted-foreground">Developer instructions</span><textarea aria-label={`${role} developer instructions`} value={agent.developerInstructions} onChange={(event) => onAgentChange({ ...agent, developerInstructions: event.target.value })} className="min-h-64 min-w-0 resize-y rounded-sm border bg-background p-3 font-mono text-sm leading-6 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" spellCheck={false} /></label>
    <label className="grid gap-1 text-xs md:grid-cols-[9rem_minmax(0,1fr)] md:items-center"><span className="text-muted-foreground">Skills</span><MultiSelect ariaLabel={`${role} Skills`} values={composition.skillResources} options={skills.map(({ id }) => ({ value: id, label: id }))} onValuesChange={(skillResources) => onCompositionChange({ ...composition, skillResources: [...skillResources].sort() })} /></label>
  </fieldset>;
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
    if (!model) issues.push(`${role}: model ${agent.model || "is missing"} is unavailable.`);
    else if (!model.reasoningOptions.includes(agent.reasoningEffort)) issues.push(`${role}: reasoning ${agent.reasoningEffort || "is missing"} is unavailable.`);
  }
  if (agents.validation.developerInstructions === agents.work.developerInstructions) issues.push("Validation and Work developer instructions must be unique.");
  return issues;
};
