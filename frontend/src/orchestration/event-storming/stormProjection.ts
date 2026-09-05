import { MarkerType, type Edge, type NodeChange } from "@xyflow/react";
import type { EventStormingModelV1, StormBoard } from "@shared/orchestration/eventStorming";
import type { StormFlowNode } from "./StormNodes";
import { NOTE_KINDS } from "./stormPresentation";

export function projectStormBoard(model: EventStormingModelV1, board: StormBoard, selected: string[], editingId?: string) {
  const notes = new Map(model.notes.map((n) => [n.id, n]));
  const uses = new Map<string, number>();
  for (const b of model.boards) for (const id of new Set(b.placements.map((p) => p.noteId))) uses.set(id, (uses.get(id) ?? 0) + 1);
  const frames: StormFlowNode[] = board.frames.map((frame) => ({ id: frame.id, type: "frame", data: { frame }, position: { x: frame.x, y: frame.y },
    width: frame.width, height: frame.height, style: { width: frame.width, height: frame.height, zIndex: -1 }, selected: selected.includes(frame.id), dragHandle: ".storm-note-grip", ariaLabel: `Frame: ${frame.title || "Untitled"}` }));
  const stickies: StormFlowNode[] = board.placements.map((placement) => ({
    id: placement.id, type: "sticky", position: { x: placement.x, y: placement.y }, data: { note: notes.get(placement.noteId)!, placement, uses: uses.get(placement.noteId) ?? 1, editing: editingId === placement.id },
    width: placement.width, height: placement.height, style: { width: placement.width, height: placement.height }, selected: selected.includes(placement.id), dragHandle: ".storm-note-grip",
    ariaLabel: `${NOTE_KINDS[notes.get(placement.noteId)!.kind].label}: ${notes.get(placement.noteId)!.title || "Untitled"}`
  }));
  const edges: Edge[] = board.connections.map((c) => ({ ...c, type: "default", selected: selected.includes(c.id), markerEnd: { type: MarkerType.ArrowClosed },
    style: { stroke: "var(--ballet-on-surface-variant)", strokeWidth: 1.5 }, labelStyle: { fill: "var(--foreground)" }, labelBgStyle: { fill: "var(--background)" } }));
  return { nodes: [...frames, ...stickies], edges };
}

export type StormGeometry = Map<string, { position?: { x: number; y: number }; width?: number; height?: number }>;
/** Only transient geometry is cached: note text always comes from the shared model. */
export function changeStormGeometry(current: StormGeometry, nodes: StormFlowNode[], changes: NodeChange<StormFlowNode>[]): StormGeometry {
  const next = new Map(current);
  const moved = new Set(changes.filter((c) => c.type === "position").map((c) => c.id));
  for (const change of changes) {
    if (change.type === "dimensions" && change.resizing && change.dimensions) next.set(change.id, { ...next.get(change.id), ...change.dimensions });
    if (change.type !== "position" || !change.position) continue;
    const before = nodes.find((n) => n.id === change.id);
    next.set(change.id, { ...next.get(change.id), position: change.position });
    if (before?.type !== "frame") continue;
    for (const node of nodes.filter((n) => n.type === "sticky" && n.data.placement.frameId === change.id && !moved.has(n.id))) {
      next.set(node.id, { ...next.get(node.id), position: { x: node.position.x + change.position.x - before.position.x, y: node.position.y + change.position.y - before.position.y } });
    }
  }
  return next;
}
