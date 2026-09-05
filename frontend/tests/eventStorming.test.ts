import { describe, expect, test, vi, afterEach } from "vitest";
import { ApiRequestError } from "../src/apiClient";
import { emptyEventStormingModel, eventStormingModelSchema, type EventStormingDocument } from "@shared/orchestration/eventStorming";
import { StormDocumentStore } from "../src/orchestration/event-storming/StormDocumentStore";
import { createBoard, deleteStormNotes, deriveStormBoard, duplicateStormItems, groupStormItems, moveStormItems, removeStormBoard, removeStormItems } from "../src/orchestration/event-storming/stormOperations";
import { routeFromPath } from "../src/workspace/routing";
import { projectStormBoard } from "../src/orchestration/event-storming/stormProjection";

const id = () => crypto.randomUUID();
const empty = (): EventStormingDocument => ({ value: emptyEventStormingModel(), contentHash: "absent", body: "\nEvidence\n" });
afterEach(() => { vi.useRealTimers(); });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((r) => { resolve = r; }); return { promise, resolve }; }

describe("Event Storming save queue", () => {
  test("debounces typing by 600 ms and saves geometry immediately", async () => {
    vi.useFakeTimers(); const base = empty(); const api = { read: vi.fn(async () => base), save: vi.fn(async (value, _hash) => { void _hash; return { ...base, value, contentHash: "a".repeat(64) }; }) };
    const store = new StormDocumentStore(api); await store.refresh();
    store.edit((v) => v.boards.push(createBoard(id(), "big-picture", "A")));
    await vi.advanceTimersByTimeAsync(599); expect(api.save).not.toHaveBeenCalled();
    store.edit((v) => { v.boards[0].title = "AB"; });
    await vi.advanceTimersByTimeAsync(600); expect(api.save).toHaveBeenCalledTimes(1); expect(store.getSnapshot().dirty).toBe(false);
    store.edit((v) => { v.boards[0].title = "Geometry gesture"; }, true);
    await vi.advanceTimersByTimeAsync(0); expect(api.save).toHaveBeenCalledTimes(2); store.dispose();
  });
  test("serializes writes and never overwrites edits made during an in-flight save", async () => {
    const base = empty(); const first = deferred<EventStormingDocument>(); const second = deferred<EventStormingDocument>();
    const api = { read: vi.fn(async () => base), save: vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise) };
    const store = new StormDocumentStore(api); await store.refresh(); store.edit((v) => v.boards.push(createBoard(id(), "big-picture", "First")));
    const saving = store.save(); const sent = structuredClone(store.getSnapshot().value);
    store.edit((v) => { v.boards[0].title = "Newer draft"; }); await store.save(); expect(api.save).toHaveBeenCalledTimes(1);
    first.resolve({ ...base, value: sent, contentHash: "a".repeat(64) }); await saving;
    expect(store.getSnapshot().value.boards[0].title).toBe("Newer draft"); expect(store.getSnapshot().dirty).toBe(true);
    const next = store.save(); expect(api.save.mock.calls[1][1]).toBe("a".repeat(64));
    second.resolve({ ...base, value: store.getSnapshot().value, contentHash: "b".repeat(64) }); await next;
    expect(store.getSnapshot().dirty).toBe(false); store.dispose();
  });
  test("preserves a conflicting draft and clears history only after explicit reload", async () => {
    const base = empty(); const api = { read: vi.fn().mockResolvedValueOnce(base).mockResolvedValue({ ...base, contentHash: "a".repeat(64) }), save: vi.fn(async () => { throw new ApiRequestError("stale", 409); }) };
    const store = new StormDocumentStore(api); await store.refresh(); store.edit((v) => v.boards.push(createBoard(id(), "big-picture", "Keep me")));
    await store.save(); expect(store.getSnapshot()).toMatchObject({ conflict: true, dirty: true });
    store.undo(); expect(store.getSnapshot().value.boards[0].title).toBe("Keep me");
    await store.refresh(); expect(store.getSnapshot().value.boards).toHaveLength(1);
    await store.refresh(true); expect(store.getSnapshot()).toMatchObject({ conflict: false, dirty: false, canUndo: false }); store.dispose();
  });
  test("a temporary lock rejection keeps the draft editable when its file hash still matches", async () => {
    const base = empty(); const api = { read: vi.fn(async () => base), save: vi.fn().mockRejectedValueOnce(new ApiRequestError("Locked by active Run", 409)).mockImplementation(async (value) => ({ ...base, value, contentHash: "a".repeat(64) })) };
    const store = new StormDocumentStore(api); await store.refresh(); store.edit((v) => v.boards.push(createBoard(id(), "big-picture", "Pending")));
    await store.save(); expect(store.getSnapshot()).toMatchObject({ dirty: true, conflict: false });
    await store.save(); expect(store.getSnapshot().dirty).toBe(false); expect(store.getSnapshot().value.boards[0].title).toBe("Pending"); store.dispose();
  });
  test("undo/redo persists inverse edits and external refresh cannot replace a newer draft", async () => {
    const base = empty(); const api = { read: vi.fn(async () => base), save: vi.fn(async (value, _hash) => { void _hash; return { ...base, value, contentHash: "a".repeat(64) }; }) };
    const store = new StormDocumentStore(api); await store.refresh(); store.edit((v) => v.boards.push(createBoard(id(), "big-picture", "Original"))); await store.save();
    store.undo(); await store.save(); expect(store.getSnapshot().value.boards).toHaveLength(0);
    store.redo(); await store.save(); expect(store.getSnapshot().value.boards).toHaveLength(1);
    const pending = deferred<EventStormingDocument>(); api.read.mockReturnValueOnce(pending.promise); const refresh = store.refresh();
    store.edit((v) => { v.boards[0].title = "Local text"; }); pending.resolve({ ...base, contentHash: "b".repeat(64) }); await refresh;
    expect(store.getSnapshot().value.boards[0].title).toBe("Local text"); expect(store.getSnapshot().conflict).toBe(true); store.dispose();
  });
  test("locks mutations during a Run and invalid sources do not become empty writable models", async () => {
    const api = { read: vi.fn(async () => { throw new Error("Invalid YAML"); }), save: vi.fn() };
    const store = new StormDocumentStore(api); await store.refresh(); store.edit((v) => v.boards.push(createBoard(id(), "big-picture", "No")));
    expect(store.getSnapshot().baseline).toBeUndefined(); expect(store.getSnapshot().value.boards).toHaveLength(0); expect(api.save).not.toHaveBeenCalled(); store.dispose();
  });
  test("keeps unfinished source references as guarded drafts and saves only after correction", async () => {
    const base = { ...empty(), value: example() };
    const api = { read: vi.fn(async () => base), save: vi.fn(async (value, _hash) => { void _hash; return { ...base, value, contentHash: "a".repeat(64) }; }) };
    const store = new StormDocumentStore(api); await store.refresh();
    store.edit((v) => { v.notes[0].sources = [".bal"]; }); await store.save();
    expect(store.getSnapshot()).toMatchObject({ dirty: true, conflict: false });
    expect(store.getSnapshot().value.notes[0].sources).toEqual([".bal"]); expect(api.save).not.toHaveBeenCalled();
    store.edit((v) => { v.notes[0].sources = [".ballet/adr/adr-046.md"]; }); await store.save();
    expect(store.getSnapshot()).toMatchObject({ dirty: false, error: undefined }); expect(api.save).toHaveBeenCalledOnce();
    store.locked = true; store.edit((v) => { v.notes[0].title = "Forbidden"; }); store.undo(); await store.save();
    expect(store.getSnapshot().value.notes[0].title).toBe("Event 0"); expect(api.save).toHaveBeenCalledOnce(); store.dispose();
  });
});

describe("Event Storming shared notes and board geometry", () => {
  test("derivation preserves shared note identities, but placements and connections are independent", () => {
    const value = example(); const source = value.boards[0]; const derived = deriveStormBoard(source, id(), source.placements.map((p) => p.id), id); value.boards.push(derived);
    expect(derived.placements[0].noteId).toBe(source.placements[0].noteId); expect(derived.placements[0].id).not.toBe(source.placements[0].id);
    value.notes[0].title = "Changed everywhere"; derived.placements[0].x = 999;
    expect(projectStormBoard(value, derived, []).nodes.find((n) => n.type === "sticky")?.data).toMatchObject({ note: { title: "Changed everywhere" }, uses: 2 });
    expect(source.placements[0].x).toBe(0); expect(eventStormingModelSchema.safeParse(value).success).toBe(true);
  });
  test("frame movement includes its members once; removing a frame retains notes and removing a placement removes its edges", () => {
    const value = example(); const board = value.boards[0]; const frameId = id(); groupStormItems(board, board.placements.map((p) => p.id), frameId);
    const f = board.frames[0]; moveStormItems(board, new Map([[frameId, { x: f.x + 100, y: f.y + 200 }]]));
    expect(board.placements[0]).toMatchObject({ x: 100, y: 200 });
    removeStormItems(board, [frameId]); expect(board.placements).toHaveLength(2); expect(board.placements[0].frameId).toBeUndefined();
    removeStormItems(board, [board.placements[0].id]); expect(board.connections).toHaveLength(0); expect(value.notes).toHaveLength(2);
  });
  test("duplicate creates independent notes; global delete removes all occurrences while board deletion preserves notes", () => {
    const value = example(); const board = value.boards[0]; duplicateStormItems(value, board, board.placements.map((p) => p.id), id);
    expect(value.notes).toHaveLength(4); expect(board.connections).toHaveLength(2);
    const derived = deriveStormBoard(board, id(), board.placements.map((p) => p.id), id); value.boards.push(derived);
    const deleted = value.notes[0].id; deleteStormNotes(value, [deleted]); expect(value.boards.every((b) => b.placements.every((p) => p.noteId !== deleted))).toBe(true);
    removeStormBoard(value, board.id); expect(value.notes).toHaveLength(3); expect(value.boards[0].sourceBoardId).toBeUndefined(); expect(eventStormingModelSchema.safeParse(value).success).toBe(true);
  });
  test("routing owns board and placement identity and rejects malformed or duplicate IDs", () => {
    const boardId = id(), itemId = id();
    expect(routeFromPath(`/project/event-storming?id=${boardId}&item=${itemId}`)).toMatchObject({ workspaceView: "event-storming", entityId: boardId, itemId });
    for (const query of ["id=bad", `item=${itemId}`, `id=${boardId}&id=${boardId}`, `id=${boardId}&extra=x`]) expect(routeFromPath(`/project/event-storming?${query}`).workspaceView).toBe("invalid");
  });
});
function example() {
  const value = emptyEventStormingModel(); const board = createBoard(id(), "big-picture", "Workshop"); value.boards.push(board);
  for (let i = 0; i < 2; i++) { const noteId = id(); value.notes.push({ id: noteId, kind: "event", title: `Event ${i}`, details: "", sources: [] }); board.placements.push({ id: id(), noteId, x: i * 240, y: 0, width: 184, height: 168, pivotal: false }); }
  board.connections.push({ id: id(), source: board.placements[0].id, target: board.placements[1].id, label: "then" }); return value;
}
