import type { EventStormingModelV1, StormBoard, StormLevel } from "@shared/orchestration/eventStorming";

export const createBoard = (id: string, level: StormLevel, title: string): StormBoard => ({
  id, level, title, description: "", placements: [], frames: [], connections: []
});
export function availableStormPosition(board: StormBoard, origin: { x: number; y: number }, size: { width: number; height: number }) {
  let point = origin;
  for (let i = 0; i <= board.placements.length; i++) {
    if (!board.placements.some((p) => point.x < p.x + p.width + 16 && point.x + size.width + 16 > p.x && point.y < p.y + p.height + 16 && point.y + size.height + 16 > p.y)) return point;
    point = { x: origin.x + ((i + 1) % 8) * (size.width + 48), y: origin.y + Math.floor((i + 1) / 8) * (size.height + 48) };
  }
  return { x: Math.max(...board.placements.map((p) => p.x + p.width)) + 48, y: origin.y };
}
export function removeStormItems(board: StormBoard, ids: string[]): void {
  const removed = new Set(ids);
  board.placements = board.placements.filter(({ id }) => !removed.has(id)).map((placement) => {
    if (!placement.frameId || !removed.has(placement.frameId)) return placement;
    const { frameId: _frameId, ...ungrouped } = placement; void _frameId; return ungrouped;
  });
  board.frames = board.frames.filter(({ id }) => !removed.has(id));
  board.connections = board.connections.filter(({ id, source, target }) => !removed.has(id) && !removed.has(source) && !removed.has(target));
}
export function deleteStormNotes(model: EventStormingModelV1, ids: string[]): void {
  model.notes = model.notes.filter(({ id }) => !ids.includes(id));
  for (const board of model.boards) removeStormItems(board, board.placements.filter(({ noteId }) => ids.includes(noteId)).map(({ id }) => id));
}
export function removeStormBoard(model: EventStormingModelV1, id: string): void {
  model.boards = model.boards.filter((board) => board.id !== id).map((board) => {
    if (board.sourceBoardId !== id) return board;
    const { sourceBoardId: _source, ...independent } = board; void _source; return independent;
  });
}
export function selectedPlacements(board: StormBoard, ids: string[]) {
  return board.placements.filter((p) => ids.includes(p.id) || (p.frameId && ids.includes(p.frameId)));
}
export function deriveStormBoard(source: StormBoard, id: string, ids: string[], allocate: () => string): StormBoard {
  const selected = selectedPlacements(source, ids);
  const result = createBoard(id, source.level === "big-picture" ? "process-modelling" : "software-design", `${source.title} · ${source.level === "big-picture" ? "Process" : "Design"}`);
  result.sourceBoardId = source.id;
  const mapping = new Map(selected.map((p) => [p.id, allocate()]));
  result.placements = selected.map(({ frameId: _frameId, ...p }) => { void _frameId; return { ...p, id: mapping.get(p.id)! }; });
  result.connections = source.connections.filter((c) => mapping.has(c.source) && mapping.has(c.target))
    .map((c) => ({ ...c, id: allocate(), source: mapping.get(c.source)!, target: mapping.get(c.target)! }));
  return result;
}
export function moveStormItems(board: StormBoard, positions: Map<string, { x: number; y: number }>): void {
  const movements = new Map(board.frames.filter((f) => positions.has(f.id)).map((f) => {
    const next = positions.get(f.id)!; return [f.id, { x: next.x - f.x, y: next.y - f.y }];
  }));
  board.placements = board.placements.map((p) => {
    const direct = positions.get(p.id); if (direct) return { ...p, ...direct };
    const delta = p.frameId ? movements.get(p.frameId) : undefined;
    return delta ? { ...p, x: p.x + delta.x, y: p.y + delta.y } : p;
  });
  board.frames = board.frames.map((f) => ({ ...f, ...(positions.get(f.id) ?? {}) }));
}
export function groupStormItems(board: StormBoard, ids: string[], id: string): void {
  const items = selectedPlacements(board, ids); if (!items.length) return;
  const x = Math.min(...items.map((p) => p.x)) - 32; const y = Math.min(...items.map((p) => p.y)) - 64;
  board.frames.push({ id, title: board.level === "software-design" ? "Bounded context" : "Process", kind: board.level === "software-design" ? "bounded-context" : "process", x, y,
    width: Math.max(...items.map((p) => p.x + p.width)) - x + 32, height: Math.max(...items.map((p) => p.y + p.height)) - y + 32 });
  const members = new Set(items.map((p) => p.id));
  board.placements = board.placements.map((p) => members.has(p.id) ? { ...p, frameId: id } : p);
}
export function duplicateStormItems(model: EventStormingModelV1, board: StormBoard, ids: string[], allocate: () => string): string[] {
  const items = selectedPlacements(board, ids); const mapping = new Map(items.map((p) => [p.id, allocate()]));
  const notes = new Map<string, string>();
  for (const item of items) if (!notes.has(item.noteId)) {
    const note = model.notes.find((n) => n.id === item.noteId)!; const id = allocate(); notes.set(note.id, id); model.notes.push({ ...note, id, sources: [...note.sources] });
  }
  board.placements.push(...items.map(({ frameId: _frameId, ...p }) => { void _frameId; return { ...p, id: mapping.get(p.id)!, noteId: notes.get(p.noteId)!, x: p.x + 32, y: p.y + 32 }; }));
  board.connections.push(...board.connections.filter((c) => mapping.has(c.source) && mapping.has(c.target)).map((c) => ({ ...c, id: allocate(), source: mapping.get(c.source)!, target: mapping.get(c.target)! })));
  return [...mapping.values()];
}
