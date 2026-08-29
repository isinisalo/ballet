import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OperationalStatus } from "@/components/shared/workspace-ui";
import type { Constraint, DirectionReference } from "@shared/vnext/direction";
import type { ReferenceEntry, ResourceDocument } from "../types";
import { ConfigureHeader } from "./ConfigureHeader";

type Kind = "goals" | "adrs" | "constraints";
type Item = DirectionReference | Constraint;

export function DirectionWorkspace({ direction, documents, references, locked, onSave, onDelete }: {
  direction: { goals: DirectionReference[]; adrs: DirectionReference[]; constraints: Constraint[] };
  documents: Partial<Record<Kind, ResourceDocument[]>>; references: ReferenceEntry[]; locked: boolean;
  onSave(kind: Kind, item: Item, markdown: string, creating: boolean): Promise<void>;
  onDelete(kind: Kind, item: Item): Promise<void>;
}) {
  const [selection, setSelection] = useState<{ kind: Kind; id: string }>();
  const selected = selection ? direction[selection.kind].find((item) => item.id === selection.id) : undefined;
  const source = selection ? documents[selection.kind]?.find((item) => item.id === selection.id)?.content ?? "" : "";
  const usage = useMemo(() => selected ? references.find((entry) => entry.id === selected.id)?.references ?? [] : [], [references, selected]);
  return <><ConfigureHeader title="Direction" description="Goals, architecture decisions, and required or prohibited constraints are the human-owned decision context." status={locked ? "Locked by active Run" : "Authoring available"} />
    <div className="grid min-w-0 gap-4 p-4 md:grid-cols-[minmax(16rem,0.75fr)_minmax(0,1.25fr)] md:p-6">
      <section aria-label="Direction list" className="space-y-4">{(["goals", "adrs", "constraints"] as Kind[]).map((kind) => <div key={kind} className="rounded-md border bg-card p-3"><div className="mb-2 flex items-center justify-between"><h2 className="font-semibold capitalize">{kind}</h2><Button size="sm" variant="outline" disabled={locked} onClick={() => setSelection({ kind, id: "" })}>Create</Button></div>
        <ul className="space-y-1">{direction[kind].map((item) => <li key={item.id}><button className="flex min-h-10 w-full items-center justify-between rounded-sm border px-2 text-left hover:bg-accent" onClick={() => setSelection({ kind, id: item.id })}><span><code className="text-tertiary">{item.id}</code> {item.name}</span><OperationalStatus compact label={item.status} tone={item.status === "accepted" ? "healthy" : "neutral"} /></button></li>)}</ul></div>)}</section>
      {selection ? <DirectionEditor key={`${selection.kind}:${selection.id}`} kind={selection.kind} item={selected} source={source} usage={usage} locked={locked} onSave={onSave} onDelete={onDelete} /> : <section className="rounded-md border border-dashed p-6 text-muted-foreground">Select an exact Direction ID to inspect its source, status, and blockers.</section>}
    </div></>;
}

function DirectionEditor({ kind, item, source, usage, locked, onSave, onDelete }: {
  kind: Kind; item?: Item; source: string; usage: ReferenceEntry["references"]; locked: boolean;
  onSave(kind: Kind, item: Item, markdown: string, creating: boolean): Promise<void>; onDelete(kind: Kind, item: Item): Promise<void>;
}) {
  const constraint = kind === "constraints";
  const [draft, setDraft] = useState<Item>(item ?? (constraint ? { id: "", name: "", status: "draft", kind: "required", description: "", rationale: "" } : { id: "", name: "", status: "draft" }));
  const [markdown, setMarkdown] = useState(source || "# New direction entry\n");
  const field = (key: "id" | "name") => <div><Label htmlFor={`direction-${key}`}>{key === "id" ? "Exact ID" : "Name"}</Label><Input id={`direction-${key}`} value={draft[key]} disabled={Boolean(item)} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} /></div>;
  return <form className="space-y-4 rounded-md border bg-card p-4" onSubmit={(event) => { event.preventDefault(); void onSave(kind, draft, markdown, !item); }}><div><h2 className="font-semibold">{item ? `Edit ${item.id}` : `Create ${kind.slice(0, -1)}`}</h2><p className="text-sm text-muted-foreground">Referenced by {usage.length} owner{usage.length === 1 ? "" : "s"}. Delete and rename are blocked while referenced.</p></div>{field("id")}{field("name")}
    {constraint ? <><div><Label htmlFor="constraint-kind">Constraint semantics</Label><select id="constraint-kind" className="h-10 w-full rounded-sm border bg-background px-2" value={(draft as Constraint).kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value as Constraint["kind"] } as Constraint)}><option value="required">Required</option><option value="prohibited">Prohibited</option></select></div><div><Label htmlFor="constraint-description">Description</Label><Input id="constraint-description" value={(draft as Constraint).description} onChange={(event) => setDraft({ ...draft, description: event.target.value } as Constraint)} /></div></> : null}
    <div><Label htmlFor="direction-markdown">Markdown source</Label><textarea id="direction-markdown" className="min-h-48 w-full rounded-sm border bg-background p-3 font-mono text-sm" value={markdown} onChange={(event) => setMarkdown(event.target.value)} /></div><div className="flex flex-wrap gap-2"><Button type="submit" disabled={locked || !draft.id || !draft.name}>Save</Button>{item ? <Button type="button" variant="destructive" disabled={locked || usage.length > 0} onClick={() => void onDelete(kind, item)}>Delete</Button> : null}</div>
    {usage.length ? <ul className="text-xs text-muted-foreground">{usage.map((reference) => <li key={`${reference.ownerType}:${reference.ownerId}:${reference.field}`}>{reference.ownerType} <code>{reference.ownerId}</code> · {reference.field}</li>)}</ul> : null}</form>;
}
