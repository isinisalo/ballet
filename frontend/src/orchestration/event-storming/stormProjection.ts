import { MarkerType, type Edge, type NodeChange } from "@xyflow/react";
import type { EventStormingModelV2 } from "@shared/orchestration/eventStorming";
import type { StormView } from "@shared/orchestration/eventStormingLayout";
import type { StormFlowNode } from "./StormNodes";
import { NOTE_KINDS } from "./stormPresentation";
export function projectStormView(model: EventStormingModelV2, view: StormView, selected: string[], storyId?: string) {
  const steps = model.processes.flatMap((p) => p.steps); const process = model.processes.find((p) => p.id === view.processId);
  const frames: StormFlowNode[] = view.frames.map((frame) => ({ id: frame.id, type: "frame", data: { frame }, position: { x: frame.x, y: frame.y },
    style: { width: frame.width, height: frame.height, zIndex: -1 }, width: frame.width, height: frame.height, measured: { width: frame.width, height: frame.height }, selected: selected.includes(frame.id), dragHandle: ".storm-note-grip", ariaLabel: `Frame: ${frame.title}` }));
  const stickies: StormFlowNode[] = view.placements.flatMap((placement) => {
    const step = steps.find((s) => s.id === placement.stepId), concept = model.concepts.find((c) => c.id === (step?.conceptId ?? placement.conceptId));
    if (!concept) return [];
    const stories = [...new Set([...(process?.storyIds ?? []), ...(step?.storyIds ?? [])])];
    return [{ id: placement.id, type: "sticky" as const, position: { x: placement.x, y: placement.y }, data: { concept, placement, stories: stories.length, highlight: Boolean(storyId && stories.includes(storyId)) },
      width: placement.width, height: placement.height, measured: { width: placement.width, height: placement.height }, style: { width: placement.width, height: placement.height }, selected: selected.includes(placement.id), dragHandle: ".storm-note-grip", ariaLabel: `${NOTE_KINDS[concept.kind].label}: ${concept.title || "Untitled"}` }];
  });
  const connections = model.processes.flatMap((p) => p.connections);
  const edges: Edge[] = view.connections.flatMap((v) => {
    const c = connections.find((c) => c.id === v.connectionId); if (!c) return [];
    return [{ ...v, label: c.label || c.kind, selected: selected.includes(v.id), markerEnd: { type: MarkerType.ArrowClosed },
      ariaLabel: `${c.kind}: ${c.label} ${c.condition}`, style: { stroke: "var(--ballet-on-surface-variant)", strokeWidth: 1.5, strokeDasharray: c.kind === "support" ? "5 4" : c.kind === "responsibility" ? "2 4" : undefined },
      labelStyle: { fill: "var(--foreground)", fontSize: 12 }, labelBgStyle: { fill: "var(--background)" } }];
  });
  return { nodes: [...frames, ...stickies], edges };
}
export type StormGeometry = Map<string, { position?: { x: number; y: number }; width?: number; height?: number }>;
export function changeStormGeometry(current: StormGeometry, nodes: StormFlowNode[], changes: NodeChange<StormFlowNode>[]): StormGeometry {
  const next = new Map(current), moved = new Set(changes.filter((c) => c.type === "position").map((c) => c.id));
  for (const change of changes) {
    if (change.type !== "position" || !change.position) continue;
    const before = nodes.find((n) => n.id === change.id); next.set(change.id, { ...next.get(change.id), position: change.position });
    if (before?.type !== "frame") continue;
    for (const node of nodes.filter((n) => n.data.placement?.frameId === change.id && !moved.has(n.id))) next.set(node.id, { position: { x: node.position.x + change.position.x - before.position.x, y: node.position.y + change.position.y - before.position.y } });
  }
  return next;
}
