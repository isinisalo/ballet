import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EditorActions, TextField } from "@/components/shared/workspace-ui";
import type { EnvironmentDefinition } from "@shared/orchestration/environment";
import { orderedStates } from "@shared/orchestration/gates";
import type { ContractIssue } from "@shared/orchestration/primitives";
import { orchestrationStatePath } from "@/workspace/routing";
import { ConfigureHeader, IssueList } from "./ConfigureHeader";
import { ConfigureToolbar } from "./ConfigureToolbar";
import { SortableIdList } from "./SortableIdList";

export function EnvironmentWorkspace({ environment, issues, locked, creating = false, navigate, onSave, onCreate, onCancelCreate, onReorder }: {
  environment: EnvironmentDefinition; issues: ContractIssue[]; locked: boolean; navigate(path: string): void;
  creating?: boolean;
  onSave(environment: EnvironmentDefinition): Promise<void>;
  onCreate(id: string, name: string): Promise<void>;
  onCancelCreate?(): void;
  onReorder(ids: string[]): Promise<boolean>;
}) {
  const [draft, setDraft] = useState(environment);
  const [stateId, setStateId] = useState(""); const [stateName, setStateName] = useState("");
  const states = orderedStates(environment.states);
  const status = locked ? "Locked by active Run" : issues.length ? "Not ready" : "Ready to run";
  const formId = `environment-${environment.id}`; const dirty = JSON.stringify(draft) !== JSON.stringify(environment);
  return <><ConfigureHeader title={creating ? "Create State" : "Environment"} description={creating ? "Add the next ordered State and its starter Action." : environment.description} /><ConfigureToolbar status={status} label={environment.id}>{creating ? <><Button variant="outline" onClick={onCancelCreate}>Cancel new State</Button><Button type="submit" form="new-state" disabled={!stateId || !stateName || locked}>Create State</Button></> : <EditorActions saveLabel="Save Environment" formId={formId} dirty={dirty} valid={!locked && issues.length === 0} />}</ConfigureToolbar>
    <div className="space-y-3 p-3 md:p-4">{creating
      ? <form id="new-state" className="space-y-2 rounded-sm border border-dashed bg-card p-3" onSubmit={(event) => { event.preventDefault(); void onCreate(stateId, stateName); }}><TextField label="Exact State ID" layout="row" density="compact" value={stateId} onChange={setStateId} /><TextField label="State name" layout="row" density="compact" value={stateName} onChange={setStateName} /></form>
      : <><section className="rounded-sm border bg-card p-3"><form id={formId} className="space-y-2" onSubmit={(event) => { event.preventDefault(); void onSave(draft); }}><TextField label="Name" layout="row" density="compact" value={draft.name} onChange={(name) => setDraft({ ...draft, name })} /><TextField label="Description" layout="row" density="compact" value={draft.description} onChange={(description) => setDraft({ ...draft, description })} /><p className="text-xs text-muted-foreground">{states.length} ordered States · {states.reduce((count, state) => count + state.actions.length, 0)} Actions</p></form><div className="mt-2"><IssueList issues={issues} /></div></section><section><h2 className="mb-2 font-semibold">Ordered State lanes</h2><SortableIdList ariaLabel="Ordered State lanes" itemLabel="State" ids={states.map(({ id }) => id)} disabled={locked} onOpen={(id) => navigate(orchestrationStatePath(id))} onReorder={onReorder} /></section></>}
    </div></>;
}
