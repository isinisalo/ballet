import { useRef, useState } from "react";
import type { StormConcept, StormNoteKind, StormProcess } from "@shared/orchestration/eventStorming";
import type { StormView } from "@shared/orchestration/eventStormingLayout";
import type { WorkspaceNavigation } from "@/workspace/useWorkspaceNavigation";
import type { StormEdit } from "./StormDocumentStore";
import { addStormStep, createProcess, createView, ensureView, removeStormSteps } from "./stormOperations";
import { stormPath } from "./stormPresentation";
export function useStormActions(process: StormProcess | undefined, view: StormView | undefined, edit: (fn: StormEdit, immediate?: boolean) => void,
  navigate: WorkspaceNavigation["navigate"], storyId?: string) {
  const [selected, setSelected] = useState<string[]>([]);
  const [tool, setTool] = useState("select");
  const center = useRef(() => ({ x: 100, y: 100 }));
  const addProcess = () => {
    const id = crypto.randomUUID(); edit((d) => { const p = createProcess(id); d.model.processes.push(p); d.layout.views.push(createView(p)); }, true);
    navigate(stormPath(id), { bypassBlocker: true });
  };
  const addNote = (kind: StormNoteKind, position?: { x: number; y: number }, existing?: string) => {
    if (!process || !view) return;
    const id = crypto.randomUUID(); edit((d) => addStormStep(d, process.id, view, kind, id, existing ?? crypto.randomUUID(), position), true);
    setSelected([id]); setTool("select"); navigate(stormPath(process.id, id, view.id, storyId), { bypassBlocker: true });
  };
  const patchNote = (id: string, patch: Partial<StormConcept>) => edit((d) => { const c = d.model.concepts.find((n) => n.id === id); if (c) Object.assign(c, patch); });
  const patchProcess = (patch: Partial<StormProcess>) => { if (process) edit((d) => Object.assign(d.model.processes.find((p) => p.id === process.id)!, patch)); };
  const selectItem = (id: string, multi = false) => {
    if (multi) return;
    setSelected([id]); const step = view?.placements.find((p) => p.id === id)?.stepId;
    if (step) navigate(stormPath(process?.id, step, view?.id, storyId), { bypassBlocker: true });
  };
  const connect = (source: string, target: string) => {
    const from = view?.placements.find((p) => p.id === source)?.stepId, to = view?.placements.find((p) => p.id === target)?.stepId;
    if (!process || !view || !from || !to) return;
    edit((d) => { const id = crypto.randomUUID(); d.model.processes.find((p) => p.id === process.id)!.connections.push({ id, source: from, target: to, kind: "flow", label: "Next", condition: "" });
      ensureView(d, view).connections.push({ id, connectionId: id, source, target }); }, true);
  };
  const remove = () => {
    if (!process || !view) return;
    const ids = view.placements.filter((p) => selected.includes(p.id)).flatMap((p) => p.stepId ?? []);
    edit((d) => {
      removeStormSteps(d, process.id, ids);
      const edgeIds = view.connections.filter((c) => selected.includes(c.id)).map((c) => c.connectionId);
      d.model.processes.find((p) => p.id === process.id)!.connections = d.model.processes.find((p) => p.id === process.id)!.connections.filter((c) => !edgeIds.includes(c.id));
      for (const v of d.layout.views) v.connections = v.connections.filter((c) => !edgeIds.includes(c.connectionId));
    }, true);
    setSelected([]); navigate(stormPath(process.id, undefined, view.id, storyId), { bypassBlocker: true });
  };
  const move = (positions: Map<string, { x: number; y: number }>) => { if (view) edit((d) => {
    const v = ensureView(d, view);
    for (const frame of v.frames) { const next = positions.get(frame.id); if (!next) continue;
      for (const p of v.placements) if (p.frameId === frame.id && !positions.has(p.id)) { p.x += next.x - frame.x; p.y += next.y - frame.y; }
      Object.assign(frame, next);
    }
    for (const p of v.placements) if (positions.has(p.id)) Object.assign(p, positions.get(p.id));
  }, true); };
  const duplicate = () => {
    if (!process || !view) return;
    const placements = view.placements.filter((p) => selected.includes(p.id));
    edit((d) => { const p = d.model.processes.find((p) => p.id === process.id)!; const v = ensureView(d, view);
      for (const placement of placements) { const step = p.steps.find((s) => s.id === placement.stepId); if (!step) continue;
        const id = crypto.randomUUID(); p.steps.push({ ...step, id, storyIds: [...step.storyIds], sources: [...step.sources] });
        v.placements.push({ ...placement, id, stepId: id, x: placement.x + 40, y: placement.y + 40 }); }
    }, true);
  };
  return { selected, setSelected, tool, setTool, center, addProcess, addNote, patchNote, patchProcess, selectItem, connect, remove, move, duplicate };
}
export type StormActions = ReturnType<typeof useStormActions>;
