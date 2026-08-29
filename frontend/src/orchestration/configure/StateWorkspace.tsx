import { ArrowDown, ArrowLeft, ArrowUp } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EditorActions, TextField } from "@/components/shared/workspace-ui";
import type { StateDefinition } from "@shared/orchestration/environment";
import { orderedActions } from "@shared/orchestration/gates";
import { orchestrationActionPath } from "@/workspace/routing";
import { ConfigureHeader } from "./ConfigureHeader";
import { ConfigureToolbar } from "./ConfigureToolbar";

export function StateWorkspace({ state, locked, canMoveEarlier, canMoveLater, navigate, onSave, onMove, onCreateAction, onDelete }: {
  state?: StateDefinition; locked: boolean; navigate(path: string): void; onSave(state: StateDefinition): Promise<void>;
  canMoveEarlier?: boolean; canMoveLater?: boolean; onMove?(delta: -1 | 1): Promise<void>; onCreateAction(id: string, name: string): Promise<void>; onDelete(): Promise<void>;
}) {
  const [draft, setDraft] = useState(state);
  const [creating, setCreating] = useState(false); const [actionId, setActionId] = useState(""); const [actionName, setActionName] = useState("");
  if (!state || !draft) return <InvalidState navigate={navigate} />;
  const actions = orderedActions(state.actions);
  const status = locked ? "Locked by active Run" : `Order ${state.order}`; const formId = `state-${state.id}`; const dirty = JSON.stringify(draft) !== JSON.stringify(state);
  return <><ConfigureHeader title={state.name} description="State metadata and priority-sorted Actions." /><ConfigureToolbar status={status} label={state.id}><Button variant="outline" onClick={() => navigate("/automation/loops")}><ArrowLeft />Environment</Button><Button variant="outline" disabled={locked || !canMoveEarlier} onClick={() => void onMove?.(-1)}><ArrowUp />Earlier</Button><Button variant="outline" disabled={locked || !canMoveLater} onClick={() => void onMove?.(1)}><ArrowDown />Later</Button>{creating ? <><Button variant="outline" onClick={() => setCreating(false)}>Cancel new Action</Button><Button type="submit" form="new-action" disabled={!actionId || !actionName}>Create Action</Button></> : <Button disabled={locked} onClick={() => setCreating(true)}>Create Action</Button>}<EditorActions saveLabel="Save State" formId={formId} dirty={dirty} valid={!locked} canDelete deleteLabel="Delete State" deleteType="State" resourceName={state.name} onDelete={onDelete} /></ConfigureToolbar>
    <div className="space-y-4 p-4 md:p-6"><form id={formId} className="space-y-3 rounded-md border bg-card p-4" onSubmit={(event) => { event.preventDefault(); void onSave(draft); }}><TextField label="Name" layout="row" density="compact" value={draft.name} onChange={(name) => setDraft({ ...draft, name })} /><TextField label="Unique order" layout="row" density="compact" type="number" value={draft.order} onChange={(value) => setDraft({ ...draft, order: Number(value) })} /><TextField label="Description" layout="row" density="compact" value={draft.description} onChange={(description) => setDraft({ ...draft, description })} /><TextField label="Use Case refs" layout="row" density="compact" value={draft.useCaseIds.join(", ")} onChange={(value) => setDraft({ ...draft, useCaseIds: value.split(",").map((item) => item.trim()).filter(Boolean) })} /></form>
      <section><h2 className="mb-3 font-semibold">Actions by priority</h2>{creating ? <form id="new-action" className="mb-3 space-y-3 rounded-md border border-dashed p-3" onSubmit={(event) => { event.preventDefault(); void onCreateAction(actionId, actionName); }}><TextField label="Exact Action ID" layout="row" density="compact" value={actionId} onChange={setActionId} /><TextField label="Action name" layout="row" density="compact" value={actionName} onChange={setActionName} /></form> : null}<ol className="space-y-2">{actions.map((action) => <li key={action.id}><button className="w-full rounded-md border bg-card p-3 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => navigate(orchestrationActionPath(state.id, action.id))}><code className="text-xs text-tertiary">PRIORITY {action.priority} · {action.id}</code><h3 className="font-semibold">{action.name}</h3><p className="text-sm text-muted-foreground">{action.description}</p></button></li>)}</ol></section></div></>;
}

function InvalidState({ navigate }: { navigate(path: string): void }) { return <><ConfigureHeader title="State not found" description="This deep link does not match a State in the current Environment." status="Invalid ID" /><div className="p-6"><Button onClick={() => navigate("/automation/loops")}>Return to Environment</Button></div></>; }
