import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { EventStormingModelV1, StormBoard } from "@shared/orchestration/eventStorming";
import { NOTE_KINDS, stormPath } from "./stormPresentation";
import { selectedPlacements } from "./stormOperations";
import type { StormActions } from "./useStormActions";

export function StormLibrary({ open, close, value, board, actions, navigate, locked }: {
  open: boolean; close(): void; value: EventStormingModelV1; board?: StormBoard; actions: StormActions; navigate(path: string): void; locked: boolean
}) {
  const [search, setSearch] = useState("");
  const notes = value.notes.filter((n) => `${n.title} ${n.details} ${NOTE_KINDS[n.kind].label}`.toLowerCase().includes(search.toLowerCase()));
  return <Dialog open={open} onOpenChange={(open) => { if (!open) close(); }}><DialogContent className="storm-dialog">
    <DialogHeader><DialogTitle>Find a note</DialogTitle><DialogDescription>Reuse a living note or jump to its place on the wall.</DialogDescription></DialogHeader>
    <input autoFocus aria-label="Search notes" placeholder="Search events, people, questions…" value={search} onChange={(event) => setSearch(event.target.value)} />
    <ul className="storm-library">{notes.map((note) => <li key={note.id}>
      <i className={`storm-color-${note.kind}`}>{NOTE_KINDS[note.kind].icon}</i><div><strong>{note.title || "Untitled"}</strong><small>{NOTE_KINDS[note.kind].label}</small>
        <div>{value.boards.flatMap((b) => b.placements.filter((p) => p.noteId === note.id).map((p, i, uses) => <Button key={`${b.id}/${p.id}`} variant="link" onClick={() => { navigate(stormPath(b.id, p.id)); close(); }}>{b.title}{uses.length > 1 ? ` · ${i + 1}` : ""}</Button>))}</div>
      </div>{board && <Button variant="outline" disabled={locked} onClick={() => { actions.addNote(note.kind, undefined, note.id); close(); }}>Add existing</Button>}
    </li>)}</ul>{!notes.length && <p>No notes found. Add one to your board to begin.</p>}
  </DialogContent></Dialog>;
}

export function StormConnectDialog({ open, close, board, value, actions, locked }: { open: boolean; close(): void; board: StormBoard; value: EventStormingModelV1; actions: StormActions; locked: boolean }) {
  const placements = board.placements; const [source, setSource] = useState(actions.selected[0] ?? placements[0]?.id ?? "");
  const [target, setTarget] = useState(actions.selected[1] ?? placements.find((p) => p.id !== source)?.id ?? ""); const [label, setLabel] = useState("");
  const options = placements.map((p, i) => <option key={p.id} value={p.id}>{value.notes.find((n) => n.id === p.noteId)?.title || "Untitled"} · {i + 1}</option>);
  return <Dialog open={open} onOpenChange={(open) => { if (!open) close(); }}><DialogContent className="storm-dialog">
    <DialogHeader><DialogTitle>Connect notes</DialogTitle><DialogDescription>You can also drag between the connection points on notes.</DialogDescription></DialogHeader>
    <label>From<select aria-label="Connection from" value={source} onChange={(event) => setSource(event.target.value)}>{options}</select></label>
    <label>To<select aria-label="Connection to" value={target} onChange={(event) => setTarget(event.target.value)}>{options}</select></label>
    <label>Label<input aria-label="Connection label" value={label} onChange={(event) => setLabel(event.target.value)} maxLength={500} /></label>
    <Button disabled={locked || !source || !target} onClick={() => { actions.mutate((b) => b.connections.push({ id: crypto.randomUUID(), source, target, label }), true); close(); }}>Connect</Button>
  </DialogContent></Dialog>;
}

export function StormDeleteDialog({ value, board, actions, locked }: { value: EventStormingModelV1; board: StormBoard; actions: StormActions; locked: boolean }) {
  const ids = selectedPlacements(board, actions.selected).map((p) => p.noteId);
  const affected = value.boards.filter((b) => b.placements.some((p) => ids.includes(p.noteId)));
  return <Dialog open={Boolean(actions.confirmation)} onOpenChange={(open) => { if (!open) actions.setConfirmation(undefined); }}><DialogContent className="storm-dialog">
    <DialogHeader><DialogTitle>{actions.confirmation === "board" ? `Delete ${board.title}?` : "Delete these notes everywhere?"}</DialogTitle>
      <DialogDescription>{actions.confirmation === "board" ? "The board layout and connections will be removed. Shared notes remain available in Find a note; linked boards remain independent." : "These notes and their connections will be removed from every listed board."}</DialogDescription></DialogHeader>
    {actions.confirmation === "notes" && <ul>{affected.map((b) => <li key={b.id}>{b.title}</li>)}</ul>}
    <Button variant="destructive" disabled={locked} onClick={actions.confirmDelete}>Confirm deletion</Button>
  </DialogContent></Dialog>;
}
