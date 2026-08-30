import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MultiSelect } from "@/components/ui/multi-select";
import { EditorActions, SelectField, TextField } from "@/components/shared/workspace-ui";
import type { ActionDefinition } from "@shared/orchestration/environment";
import type { ResourceDocument } from "../types";
import { validateActionInstruction, REQUIRED_ACTION_INSTRUCTION_SECTIONS } from "@shared/orchestration/instructionContract";
import { ConfigureHeader, IssueList } from "./ConfigureHeader";
import { ConfigureToolbar } from "./ConfigureToolbar";
import { useActionExecutionBinding } from "./useActionExecutionBinding";
import type { ActionExecutionState } from "./useActionExecutionBinding";

export function ActionWorkspace({ stateId, action, instructions, skills, locked, canvasMode, navigate, onCanvasModeChange, onDelete, onSave }: { stateId?: string; action?: ActionDefinition; instructions: ResourceDocument[]; skills: ResourceDocument[]; locked: boolean; canvasMode?: "flow"; navigate(path: string): void; onCanvasModeChange(mode: "space" | "flow"): void; onDelete?(): Promise<void>; onSave(action: ActionDefinition): Promise<void> }) {
  const [draft, setDraft] = useState(action);
  const execution = useActionExecutionBinding(stateId ?? "", action?.id ?? "");
  if (!stateId || !action || !draft) return <><ConfigureHeader title="Action not found" description="The State or Action ID in this deep link is invalid." status="Invalid ID" /><div className="p-6"><Button onClick={() => navigate("/automation/loops")}>Return to Environment</Button></div></>;
  const instructionIssues = [draft.validation, draft.work].flatMap((composition) => { const document = instructions.find((item) => item.id === composition.instructionResource); return document ? validateActionInstruction(document.content) : [{ path: composition.instructionResource, message: "Instruction resource not found" }]; });
  const executionIssues = execution.readinessIssues.map((message) => ({ path: "execution", message }));
  const readinessIssues = [...instructionIssues, ...executionIssues];
  const status = locked ? "Locked by active Run" : readinessIssues.length ? "Not ready" : "Ready"; const formId = `action-${action.id}`; const dirty = JSON.stringify(draft) !== JSON.stringify(action);
  return <><ConfigureHeader title={action.name} description="Validation is the main controller; Work is a subordinate execution role." /><ConfigureToolbar status={status} label={action.id}><Button variant="outline" onClick={() => navigate(`/automation/loops/states/${encodeURIComponent(stateId)}`)}><ArrowLeft />State</Button><Button variant="outline" onClick={() => onCanvasModeChange(canvasMode === "flow" ? "space" : "flow")}>{canvasMode === "flow" ? "Show space canvas" : "Open Action flow"}</Button><EditorActions saveLabel="Save Action" formId={formId} dirty={dirty} valid={!locked && instructionIssues.length === 0} canDelete={Boolean(onDelete)} deleteLabel="Delete Action" deleteType="Action" resourceName={action.name} onDelete={onDelete} /></ConfigureToolbar>
    <div className="min-w-0 space-y-3 p-3 md:p-4"><form id={formId} className="min-w-0 space-y-2 border bg-card p-3" onSubmit={(event) => { event.preventDefault(); void onSave(draft); }}><TextField label="Name" layout="row" density="compact" value={draft.name} onChange={(name) => setDraft({ ...draft, name })} /><TextField label="Description" layout="row" density="compact" value={draft.description} onChange={(description) => setDraft({ ...draft, description })} /><RetryBudgetField actionId={action.id} value={draft.maxRetries} onChange={(maxRetries) => setDraft({ ...draft, maxRetries })} />
      <ExecutionEditor execution={execution} /><CompositionEditor execution={execution} role="Validation" composition={draft.validation} instructions={instructions} skills={skills} onChange={(validation) => setDraft({ ...draft, validation: { ...validation } })} /><CompositionEditor execution={execution} role="Work" composition={draft.work} instructions={instructions} skills={skills} onChange={(work) => setDraft({ ...draft, work: { ...work } })} /></form><section className="rounded-md border bg-card p-4"><h2 className="font-semibold">Run readiness</h2><p className="mb-2 text-xs text-muted-foreground">Required instruction sections: {REQUIRED_ACTION_INSTRUCTION_SECTIONS.join(" · ")}</p><IssueList issues={readinessIssues} /></section></div></>;
}

function RetryBudgetField({ actionId, value, onChange }: { actionId: string; value: number; onChange(value: number): void }) {
  const id = `max-retries-${actionId}`;
  return <div className="grid gap-1 sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:items-center"><label htmlFor={id} className="font-mono text-[0.68rem] font-medium leading-4 text-muted-foreground">maxRetries</label><div className="flex min-h-10 items-center gap-2 md:min-h-7"><Input id={id} className="h-10 w-20 text-base md:h-7 md:text-xs" type="number" min={0} value={value} onChange={(event) => onChange(Number(event.target.value))} /><span className="text-xs text-muted-foreground">{1 + value} total Work attempts</span></div></div>;
}

function ExecutionEditor({ execution }: { execution: ActionExecutionState }) {
  return <fieldset className="space-y-3 rounded-sm border p-3"><legend className="font-semibold">Action execution</legend><p className="text-xs text-muted-foreground">Codex CLI is fixed. Network access is denied and file access is limited to the Run checkout/worktree.</p>
    {execution.error ? <p role="alert" className="text-xs text-destructive">{execution.error}</p> : null}
    {execution.draftIssues.length > 0 ? <IssueList issues={execution.draftIssues.map((message) => ({ path: "execution", message }))} /> : null}
    <div className="flex items-center justify-between gap-3"><p className="text-xs text-muted-foreground">{execution.binding ? "Local Action execution binding saved" : "Action execution binding required"}</p><Button type="button" size="sm" disabled={execution.pending || !execution.canSave} onClick={() => void execution.save()}>{execution.pending ? "Saving execution…" : "Save execution"}</Button></div>
  </fieldset>;
}

function CompositionEditor({ execution, role, composition, instructions, skills, onChange }: { execution: ActionExecutionState; role: "Validation" | "Work"; composition: ActionDefinition["validation"]; instructions: ResourceDocument[]; skills: ResourceDocument[]; onChange(value: ActionDefinition["validation"]): void }) {
  const executionRole = role === "Validation" ? "validation" : "work";
  const selection = execution[executionRole];
  const labelClass = "grid gap-1 text-xs md:grid-cols-[9rem_minmax(0,1fr)] md:items-center";
  return <fieldset className="space-y-3 rounded-sm border p-3"><legend className="font-semibold">{role} Agent · {role === "Validation" ? "main/controller" : "subordinate"}</legend><p className="text-xs text-muted-foreground">Permission: {role === "Validation" ? "read-only" : "workspace-write"} · execution changes apply to future Runs.</p>
    <SelectField label="Model" layout="row" density="compact" value={selection.model} placeholder="Select…" options={execution.models.map((item) => ({ value: item.id, label: item.label }))} onChange={(model) => execution.setRoleModel(executionRole, model)} />
    <SelectField label="Reasoning" layout="row" density="compact" value={selection.reasoningEffort} placeholder="Select…" options={(execution.models.find(({ id }) => id === selection.model)?.reasoningOptions ?? []).map((value) => ({ value, label: value }))} onChange={(value) => execution.setRoleReasoning(executionRole, value)} />
    <SelectField label="Instruction" layout="row" density="compact" value={composition.instructionResource} options={instructions.map((item) => ({ value: item.id, label: item.id }))} onChange={(instructionResource) => onChange({ ...composition, instructionResource })} />
    <label className={labelClass}><span className="text-muted-foreground">Skills</span><MultiSelect ariaLabel={`${role} Skills`} values={composition.skillResources} options={skills.map(({ id }) => ({ value: id, label: id }))} onValuesChange={(skillResources) => onChange({ ...composition, skillResources: [...skillResources].sort() })} /></label>
  </fieldset>;
}
