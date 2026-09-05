import { useRef, useState } from "react";
import type { EventStormingModelV1, StormBoard, StormLevel, StormNote, StormNoteKind } from "@shared/orchestration/eventStorming";
import type { WorkspaceNavigation } from "@/workspace/useWorkspaceNavigation";
import type { StormEdit } from "./StormDocumentStore";
import { availableStormPosition, createBoard, deleteStormNotes, deriveStormBoard, duplicateStormItems, groupStormItems, moveStormItems, removeStormBoard, removeStormItems, selectedPlacements } from "./stormOperations";
import { LEVELS, noteSize, stormPath } from "./stormPresentation";

export function useStormActions(board: StormBoard | undefined, edit: (fn: StormEdit, immediate?: boolean) => void, navigate: WorkspaceNavigation["navigate"]) {
  const [selected, setSelected] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string>();
  const [confirmation, setConfirmation] = useState<"notes" | "board">();
  const [tool, setTool] = useState("select");
  const [connectFrom, setConnectFrom] = useState<string>();
  const center = useRef(() => ({ x: 160, y: 160 }));
  const mutate = (change: (board: StormBoard, model: EventStormingModelV1) => void, immediate = false) => {
    if (board) edit((draft) => { const target = draft.boards.find((b) => b.id === board.id); if (target) change(target, draft); }, immediate);
  };
  const addBoard = (level: StormLevel) => {
    const id = crypto.randomUUID(); edit((draft) => { draft.boards.push(createBoard(id, level, LEVELS[level].label)); }, true);
    navigate(stormPath(id), { bypassBlocker: true }); setSelected([]);
  };
  const addNote = (kind: StormNoteKind, position?: { x: number; y: number }, existingId?: string) => {
    const previous = board?.placements.find((p) => selected.includes(p.id));
    const origin = previous ? { x: previous.x + previous.width + 48, y: previous.y } : center.current();
    const point = position ?? (board ? availableStormPosition(board, origin, noteSize(kind)) : origin);
    const id = crypto.randomUUID(); const noteId = existingId ?? crypto.randomUUID();
    mutate((b, draft) => { if (!existingId) draft.notes.push({ id: noteId, kind, title: "", details: "", sources: [] });
      b.placements.push({ id, noteId, ...point, ...noteSize(kind), pivotal: false }); }, true);
    setSelected([id]); setEditingId(existingId ? undefined : id); setTool("select"); navigate(stormPath(board?.id, id), { bypassBlocker: true });
  };
  const patchNote = (id: string, patch: Partial<StormNote>) => edit((draft) => { const note = draft.notes.find((n) => n.id === id); if (note) Object.assign(note, patch); });
  const action = (name: string) => {
    if (!board) return;
    if (name === "delete-everywhere") { setConfirmation("notes"); return; }
    if (name === "delete-board") { setConfirmation("board"); return; }
    if (name === "derive") {
      const id = crypto.randomUUID(); edit((draft) => { draft.boards.push(deriveStormBoard(board, id, selected, () => crypto.randomUUID())); }, true);
      navigate(stormPath(id), { bypassBlocker: true }); setSelected([]); return;
    }
    mutate((b, draft) => {
      if (name === "remove") removeStormItems(b, selected);
      if (name === "duplicate") setSelected(duplicateStormItems(draft, b, selected, () => crypto.randomUUID()));
      if (name === "group") groupStormItems(b, selected, crypto.randomUUID());
      if (name === "align") { const items = selectedPlacements(b, selected); const y = Math.min(...items.map((p) => p.y)); for (const p of items) p.y = y; }
      if (name === "pivotal") for (const p of b.placements) if (selected.includes(p.id) && draft.notes.find((n) => n.id === p.noteId)?.kind === "event") p.pivotal = !p.pivotal;
      if (name === "grow" || name === "shrink") for (const p of [...b.placements, ...b.frames]) if (selected.includes(p.id)) {
        const step = name === "grow" ? 24 : -24; p.width = Math.max(136, Math.min(20_000, p.width + step)); p.height = Math.max(112, Math.min(20_000, p.height + step));
      }
    }, true);
    if (name === "remove") { setSelected([]); navigate(stormPath(board.id), { bypassBlocker: true }); }
  };
  const connect = (source: string, target: string) => mutate((b) => { b.connections.push({ id: crypto.randomUUID(), source, target, label: "" }); }, true);
  const selectItem = (id: string, multi = false) => {
    if (tool === "connect" && board?.placements.some((p) => p.id === id)) {
      if (connectFrom) { connect(connectFrom, id); setConnectFrom(undefined); setTool("select"); } else setConnectFrom(id);
      return;
    }
    if (multi) return; // React Flow owns additive/toggle selection; preserve the URL anchor.
    setSelected([id]);
    if (board?.placements.some((p) => p.id === id)) navigate(stormPath(board.id, id), { bypassBlocker: true });
  };
  const confirmDelete = () => {
    if (!board) return;
    if (confirmation === "board") { edit((draft) => removeStormBoard(draft, board.id), true); navigate(stormPath(), { bypassBlocker: true }); }
    else { const ids = selectedPlacements(board, selected).map((p) => p.noteId); edit((draft) => deleteStormNotes(draft, ids), true); navigate(stormPath(board.id), { bypassBlocker: true }); }
    setConfirmation(undefined); setSelected([]);
  };
  return { selected, setSelected, editingId, setEditingId, tool, setTool, connectFrom, center, confirmation, setConfirmation, confirmDelete,
    addBoard, addNote, patchNote, action, selectItem, connect,
    mutate, move: (positions: Map<string, { x: number; y: number }>) => mutate((b) => moveStormItems(b, positions), true),
    resize: (id: string, size: { x: number; y: number; width: number; height: number }) => mutate((b) => {
      const item = [...b.placements, ...b.frames].find((p) => p.id === id); if (item) Object.assign(item, size);
    }, true),
    patchFrame: (id: string, title: string) => mutate((b) => { const f = b.frames.find((f) => f.id === id); if (f) f.title = title; })
  };
}
export type StormActions = ReturnType<typeof useStormActions>;
