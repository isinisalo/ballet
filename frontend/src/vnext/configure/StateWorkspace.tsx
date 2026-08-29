import { ArrowDown, ArrowLeft, ArrowUp } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { StateDefinition } from "@shared/vnext/environment";
import { orderedActions } from "@shared/vnext/gates";
import { vNextActionPath } from "@/workspace/routing";
import { ConfigureHeader } from "./ConfigureHeader";

export function StateWorkspace({ state, locked, navigate, onSave, onMoveAction }: {
  state?: StateDefinition; locked: boolean; navigate(path: string): void; onSave(state: StateDefinition): Promise<void>; onMoveAction(id: string, delta: -1 | 1): Promise<void>;
}) {
  const [draft, setDraft] = useState(state);
  if (!state || !draft) return <InvalidState navigate={navigate} />;
  const actions = orderedActions(state.actions);
  return <><ConfigureHeader title={state.name} description="State metadata and priority-sorted Actions." status={locked ? "Locked by active Run" : `Order ${state.order}`} actions={<Button variant="outline" onClick={() => navigate("/vnext/configure/environment")}><ArrowLeft />Environment</Button>} />
    <div className="space-y-4 p-4 md:p-6"><form className="grid gap-3 rounded-md border bg-card p-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); void onSave(draft); }}><div><Label htmlFor="state-name">Name</Label><Input id="state-name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></div><div><Label htmlFor="state-order">Unique order</Label><Input id="state-order" type="number" min={0} value={draft.order} onChange={(event) => setDraft({ ...draft, order: Number(event.target.value) })} /></div><div className="sm:col-span-2"><Label htmlFor="state-description">Description</Label><Input id="state-description" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></div><div className="sm:col-span-2"><Label htmlFor="state-refs">Approved Use Case refs</Label><Input id="state-refs" value={draft.useCaseIds.join(", ")} onChange={(event) => setDraft({ ...draft, useCaseIds: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} /></div><Button className="w-fit" disabled={locked}>Save State</Button></form>
      <section><h2 className="mb-3 font-semibold">Actions by priority</h2><ol className="space-y-2">{actions.map((action, index) => <li key={action.id} className="flex flex-col gap-3 rounded-md border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"><div><code className="text-xs text-tertiary">PRIORITY {action.priority} · {action.id}</code><h3 className="font-semibold">{action.name}</h3><p className="text-sm text-muted-foreground">{action.description}</p></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={locked || index === 0} aria-label={`Move Action ${action.id} earlier`} onClick={() => void onMoveAction(action.id, -1)}><ArrowUp />Earlier</Button><Button size="sm" variant="outline" disabled={locked || index === actions.length - 1} aria-label={`Move Action ${action.id} later`} onClick={() => void onMoveAction(action.id, 1)}><ArrowDown />Later</Button><Button size="sm" onClick={() => navigate(vNextActionPath(state.id, action.id))}>Open {action.id}</Button></div></li>)}</ol></section></div></>;
}

function InvalidState({ navigate }: { navigate(path: string): void }) { return <><ConfigureHeader title="State not found" description="This deep link does not match a State in the current Environment." status="Invalid ID" /><div className="p-6"><Button onClick={() => navigate("/vnext/configure/environment")}>Return to Environment</Button></div></>; }
