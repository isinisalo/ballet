import type { RouteState } from "@/workspace/types";
import type { UserStoryCollection } from "@shared/orchestration/userStories";
import type { EventStormingModelV2, StormNoteKind, StormProcess } from "@shared/orchestration/eventStorming";
import type { EventStormingLayoutV1, StormPlacement, StormView } from "@shared/orchestration/eventStormingLayout";
import type { StormDraft } from "./StormDocumentStore";
import { noteSize } from "./stormPresentation";
export const createProcess = (id: string): StormProcess => ({ id, title: "New process", description: "", sources: [], storyIds: [], steps: [], connections: [], boundaries: [] });
export const createView = (process: StormProcess): StormView => ({ id: process.id, processId: process.id, kind: "process", title: process.title, description: "", placements: [], frames: [], connections: [] });
export function availableStormPosition(placements: StormPlacement[], origin: { x: number; y: number }, size: { width: number; height: number }) {
  let point = origin;
  for (let i = 0; i <= placements.length; i++) {
    if (!placements.some((p) => point.x < p.x + p.width + 16 && point.x + size.width + 16 > p.x && point.y < p.y + p.height + 16 && point.y + size.height + 16 > p.y)) return point;
    point = { x: origin.x + ((i + 1) % 8) * (size.width + 120), y: origin.y + Math.floor((i + 1) / 8) * (size.height + 48) };
  }
  return { x: Math.max(0, ...placements.map((p) => p.x + p.width)) + 120, y: origin.y };
}
/** Repair only the in-memory projection of stale layout; never rewrite an external file on read. */
export function resolveStormView(model: EventStormingModelV2, layout: EventStormingLayoutV1, process: StormProcess, viewId?: string): StormView {
  const saved = layout.views.find((v) => v.id === viewId && v.processId === process.id)
    ?? layout.views.find((v) => v.processId === process.id && v.kind === "process");
  const view = structuredClone(saved ?? createView(process));
  if (view.kind === "process") view.title = process.title;
  const steps = new Set(process.steps.map((s) => s.id));
  view.placements = view.placements.filter((p) => p.stepId && steps.has(p.stepId));
  const present = new Set(view.placements.map((p) => p.stepId));
  for (const step of process.steps) if (!present.has(step.id)) {
    const concept = model.concepts.find((c) => c.id === step.conceptId)!;
    if (view.kind === "process" && concept.kind === "aggregate") continue;
    if (view.kind === "responsibilities" && saved && layout.views.some((v) => v.placements.some((p) => p.stepId === step.id))) continue;
    const size = noteSize(concept.kind), origin = { x: Math.max(0, ...view.placements.map((p) => p.x + p.width)) + 48, y: 100 };
    view.placements.push({ id: step.id, stepId: step.id, ...availableStormPosition(view.placements, origin, size), ...size, pivotal: false });
  }
  const placementIds = new Set(view.placements.map((p) => p.id));
  const edges = new Set(process.connections.map((c) => c.id));
  view.connections = view.connections.filter((c) => edges.has(c.connectionId) && placementIds.has(c.source) && placementIds.has(c.target));
  for (const c of process.connections) if (!view.connections.some((e) => e.connectionId === c.id)) {
    const source = view.placements.find((p) => p.stepId === c.source), target = view.placements.find((p) => p.stepId === c.target);
    if (source && target) view.connections.push({ id: c.id, connectionId: c.id, source: source.id, target: target.id });
  }
  return view;
}
export function ensureView(draft: StormDraft, view: StormView): StormView {
  const value = structuredClone(view);
  draft.layout.views = [...draft.layout.views.filter((v) => v.id !== view.id), value];
  return value;
}
export function addStormStep(draft: StormDraft, processId: string, view: StormView, kind: StormNoteKind, id: string, conceptId: string, position?: { x: number; y: number }) {
  const process = draft.model.processes.find((p) => p.id === processId)!;
  if (!draft.model.concepts.some((c) => c.id === conceptId)) draft.model.concepts.push({ id: conceptId, kind, title: "", details: "", sources: [] });
  process.steps.push({ id, conceptId, storyIds: [], sources: [] });
  const layout = ensureView(draft, view), size = noteSize(kind);
  layout.placements.push({ id, stepId: id, ...position ?? availableStormPosition(layout.placements, { x: 100, y: 100 }, size), ...size, pivotal: false });
}
export function removeStormSteps(draft: StormDraft, processId: string, ids: string[]) {
  const process = draft.model.processes.find((p) => p.id === processId)!;
  process.steps = process.steps.filter((s) => !ids.includes(s.id));
  for (const p of draft.model.processes) {
    p.connections = p.connections.filter((c) => !ids.includes(c.source) && !ids.includes(c.target));
    p.boundaries = p.boundaries.map((b) => ({ ...b, stepIds: b.stepIds.filter((id) => !ids.includes(id)) }));
  }
  for (const v of draft.layout.views) {
    v.placements = v.placements.filter((p) => !p.stepId || !ids.includes(p.stepId));
    const remaining = new Set(v.placements.map((p) => p.id));
    v.connections = v.connections.filter((c) => remaining.has(c.source) && remaining.has(c.target));
  }
}

export function invalidStormSelection(model: EventStormingModelV2, layout: EventStormingLayoutV1, route: RouteState, stories?: UserStoryCollection): boolean {
  const process = model.processes.find((p) => p.id === route.entityId);
  if (route.entityId && !process) return true;
  if (route.itemId && !process?.steps.some((s) => s.id === route.itemId)) return true;
  if (route.stormViewId && route.stormViewId !== process?.id && !layout.views.some((v) => v.id === route.stormViewId && v.processId === process?.id)) return true;
  return !!(route.storyId && stories && !stories.stories.some((s) => s.value.id === route.storyId) && !stories.issues.some((s) => s.id === route.storyId));
}

export const findStormSteps = (model: EventStormingModelV2, process: StormProcess | undefined, search: string) => process && search ? process.steps.filter((s) => model.concepts.find((c) => c.id === s.conceptId)?.title.toLocaleLowerCase().includes(search.toLocaleLowerCase())) : [];
