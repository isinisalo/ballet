import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EditorActions, TextField } from "@/components/shared/workspace-ui";
import { OperationalStatus } from "@/components/shared/workspace-ui";
import type { EnvironmentDefinition } from "@shared/orchestration/environment";
import { orderedActions, orderedStates } from "@shared/orchestration/gates";
import type { ContractIssue } from "@shared/orchestration/primitives";
import { orchestrationStatePath } from "@/workspace/routing";
import { ConfigureHeader, IssueList } from "./ConfigureHeader";
import { ConfigureToolbar } from "./ConfigureToolbar";

export function EnvironmentWorkspace({ environment, issues, locked, navigate, onSave, onCreate, panel = false }: {
  environment: EnvironmentDefinition; issues: ContractIssue[]; locked: boolean; navigate(path: string): void;
  onSave(environment: EnvironmentDefinition): Promise<void>;
  onCreate(id: string, name: string): Promise<void>;
  panel?: boolean;
}) {
  const [draft, setDraft] = useState(environment); const [creating, setCreating] = useState(false);
  const [stateId, setStateId] = useState(""); const [stateName, setStateName] = useState("");
  const states = orderedStates(environment.states);
  const status = locked ? "Locked by active Run" : issues.length ? "Not ready" : "Ready to run"; const formId = `environment-${environment.id}`; const dirty = JSON.stringify(draft) !== JSON.stringify(environment);
  return <><ConfigureHeader title="Environment" description={environment.description} /><ConfigureToolbar status={status} label={environment.id}>{creating ? <><Button variant="outline" onClick={() => setCreating(false)}>Cancel new State</Button><Button type="submit" form="new-state" disabled={!stateId || !stateName}>Create State</Button></> : <Button disabled={locked} onClick={() => setCreating(true)}>Create State</Button>}<EditorActions saveLabel="Save Environment" formId={formId} dirty={dirty} valid={!locked && issues.length === 0} /></ConfigureToolbar>
    <div className="space-y-5 p-4 md:p-6"><section className="rounded-md border bg-card p-4"><form id={formId} className="space-y-3" onSubmit={(event) => { event.preventDefault(); void onSave(draft); }}><TextField label="Name" layout="row" density="compact" value={draft.name} onChange={(name) => setDraft({ ...draft, name })} /><TextField label="Description" layout="row" density="compact" value={draft.description} onChange={(description) => setDraft({ ...draft, description })} /><p className="text-xs text-muted-foreground">{states.length} ordered States · {states.reduce((count, state) => count + state.actions.length, 0)} Actions</p></form><div className="mt-3"><IssueList issues={issues} /></div></section>
      <section aria-label="Ordered State lanes"><h2 className="mb-3 font-semibold">Ordered State lanes</h2>{creating ? <form id="new-state" className="mb-3 space-y-3 rounded-md border border-dashed p-3" onSubmit={(event) => { event.preventDefault(); void onCreate(stateId, stateName); }}><TextField label="Exact State ID" layout="row" density="compact" value={stateId} onChange={setStateId} /><TextField label="State name" layout="row" density="compact" value={stateName} onChange={setStateName} /></form> : null}<ol className={`grid min-w-0 gap-3${panel ? "" : " lg:grid-cols-2"}`}>{states.map((state) => { const stateIssues = issues.filter((issue) => issue.path.startsWith(`environment.states.${environment.states.indexOf(state)}`)); return <li key={state.id}><button className="min-w-0 w-full rounded-md border bg-card p-4 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => navigate(orchestrationStatePath(state.id))}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><span className="font-mono text-xs text-tertiary">ORDER {state.order} · {state.id}</span><h3 className="truncate font-semibold">{state.name}</h3><p className="mt-1 text-sm text-muted-foreground">{state.description}</p></div><OperationalStatus compact label={stateIssues.length ? `${stateIssues.length} issue${stateIssues.length === 1 ? "" : "s"}` : "Ready"} tone={stateIssues.length ? "danger" : "healthy"} /></div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground"><span>{state.useCaseIds.length} Use Case refs</span><span>·</span><span>{state.actions.length} Actions</span></div><ol className="mt-3 space-y-1">{orderedActions(state.actions).map((action) => <li key={action.id} className="flex min-h-9 items-center justify-between rounded-sm border px-2"><span><code className="text-tertiary">P{action.priority}</code> {action.name}</span><ChevronRight className="size-4" aria-hidden="true" /></li>)}</ol>
        </button></li>; })}</ol></section>
      <p className="text-xs text-muted-foreground">Authoring order is deterministic. Runtime status appears only in Run projections; these cards do not create execution facts.</p>
    </div></>;
}
