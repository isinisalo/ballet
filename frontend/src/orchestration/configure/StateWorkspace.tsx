import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EditorActions, TextField } from "@/components/shared/workspace-ui";
import type { StateDefinition } from "@shared/orchestration/environment";
import { orderedActions } from "@shared/orchestration/gates";
import { orchestrationActionPath } from "@/workspace/routing";
import { ConfigureHeader } from "./ConfigureHeader";
import { ConfigureToolbar } from "./ConfigureToolbar";
import { SortableIdList } from "./SortableIdList";

export function StateWorkspace({ state, locked, navigate, onSave, onReorderActions, onCreateAction, onDelete }: {
  state?: StateDefinition; locked: boolean; navigate(path: string): void; onSave(state: StateDefinition): Promise<void>;
  onReorderActions(ids: string[]): Promise<boolean>; onCreateAction(id: string, name: string): Promise<void>; onDelete(): Promise<void>;
}) {
  const [draft, setDraft] = useState(state);
  const [creating, setCreating] = useState(false); const [actionId, setActionId] = useState(""); const [actionName, setActionName] = useState("");
  if (!state || !draft) return <InvalidState navigate={navigate} />;
  const actions = orderedActions(state.actions);
  const status = locked ? "Locked by active Run" : "Ready"; const formId = `state-${state.id}`; const dirty = JSON.stringify(draft) !== JSON.stringify(state);
  return <><ConfigureHeader title={state.name} description="State metadata and priority-sorted Actions." /><ConfigureToolbar status={status} label={state.id}><Button variant="outline" onClick={() => navigate("/automation/loops")}><ArrowLeft />Environment</Button>{creating ? <><Button variant="outline" onClick={() => setCreating(false)}>Cancel new Action</Button><Button type="submit" form="new-action" disabled={!actionId || !actionName}>Create Action</Button></> : <Button disabled={locked} onClick={() => setCreating(true)}>Create Action</Button>}<EditorActions saveLabel="Save State" formId={formId} dirty={dirty} valid={!locked} canDelete deleteLabel="Delete State" deleteType="State" resourceName={state.name} onDelete={onDelete} /></ConfigureToolbar>
    <div className="space-y-3 p-3 md:p-4"><form id={formId} className="space-y-2 rounded-sm border bg-card p-3" onSubmit={(event) => { event.preventDefault(); void onSave(draft); }}><TextField label="Name" layout="row" density="compact" value={draft.name} onChange={(name) => setDraft({ ...draft, name })} /><TextField label="Description" layout="row" density="compact" value={draft.description} onChange={(description) => setDraft({ ...draft, description })} /></form>
      <section><h2 className="mb-2 font-semibold">Actions by priority</h2>{creating ? <form id="new-action" className="mb-2 space-y-2 rounded-sm border border-dashed p-3" onSubmit={(event) => { event.preventDefault(); void onCreateAction(actionId, actionName); }}><TextField label="Exact Action ID" layout="row" density="compact" value={actionId} onChange={setActionId} /><TextField label="Action name" layout="row" density="compact" value={actionName} onChange={setActionName} /></form> : null}<SortableIdList ariaLabel="Actions by priority" itemLabel="Action" ids={actions.map(({ id }) => id)} disabled={locked} onOpen={(id) => navigate(orchestrationActionPath(state.id, id))} onReorder={onReorderActions} /></section></div></>;
}

function InvalidState({ navigate }: { navigate(path: string): void }) { return <><ConfigureHeader title="State not found" description="This deep link does not match a State in the current Environment." status="Invalid ID" /><div className="p-6"><Button onClick={() => navigate("/automation/loops")}>Return to Environment</Button></div></>; }
