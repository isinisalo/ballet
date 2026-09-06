import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Background, Controls, MiniMap, ReactFlow, ReactFlowProvider, useReactFlow, type NodeChange, type NodeTypes } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { EventStormingModelV2 } from "@shared/orchestration/eventStorming";
import type { StormView } from "@shared/orchestration/eventStormingLayout";
import { StormFrameNode, StormSticky, type StormFlowNode } from "./StormNodes";
import { changeStormGeometry, projectStormView, type StormGeometry } from "./stormProjection";
import type { StormActions } from "./useStormActions";
const nodeTypes = { sticky: StormSticky, frame: StormFrameNode } satisfies NodeTypes;
interface CanvasProps { model: EventStormingModelV2; view: StormView; focusId?: string; storyId?: string; actions: StormActions; locked: boolean; undo(): void; redo(): void; showDetails(): void }
export function StormCanvas(props: CanvasProps) { return <ReactFlowProvider><CanvasSurface {...props} /></ReactFlowProvider>; }
function CanvasSurface({ model, view, focusId, storyId, actions, locked, undo, redo, showDetails }: CanvasProps) {
  const flow = useReactFlow<StormFlowNode>(), surface = useRef<HTMLDivElement>(null);
  const latest = useRef(actions); latest.current = actions;
  const projection = useMemo(() => projectStormView(model, view, actions.selected, storyId), [model, view, actions.selected, storyId]);
  const [geometry, setGeometry] = useState<StormGeometry>(new Map());
  const nodes = projection.nodes.map((n) => ({ ...n, ...geometry.get(n.id) }));
  const nodesRef = useRef(nodes); nodesRef.current = nodes;
  useEffect(() => setGeometry(new Map()), [view]);
  useEffect(() => {
    actions.center.current = () => { const r = surface.current?.getBoundingClientRect(); return r ? flow.screenToFlowPosition({ x: r.left + r.width / 2, y: r.top + r.height / 2 }) : { x: 100, y: 100 }; };
  }, [actions.center, flow]);
  useEffect(() => {
    const p = view.placements.find((p) => p.stepId === focusId);
    if (p) void flow.setCenter(p.x + p.width / 2, p.y + p.height / 2, { zoom: Math.max(flow.getZoom(), 0.7), duration: 0 });
  }, [focusId, view.id, flow]); // Selection changes the camera; ordinary edits preserve it.
  const changes = useCallback((changes: NodeChange<StormFlowNode>[]) => {
    const selected = changes.filter((c) => c.type === "select");
    if (selected.length) latest.current.setSelected((current) => {
      const next = new Set(current); for (const c of selected) { if (c.selected) next.add(c.id); else next.delete(c.id); } return [...next];
    });
    setGeometry((current) => changeStormGeometry(current, nodesRef.current, changes));
    const positions = new Map<string, { x: number; y: number }>();
    for (const c of changes) if (c.type === "position" && c.position && c.dragging === false) positions.set(c.id, c.position);
    if (positions.size && !locked) latest.current.move(positions);
  }, [locked]);
  return <div ref={surface} className="storm-canvas" aria-label={`${view.title} process map`} tabIndex={-1} onKeyDown={(e) => {
    if ((e.target as HTMLElement).closest("input,textarea,select,[contenteditable=true]")) return;
    if (e.key === "Escape") actions.setTool("select");
    if (locked) return;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
    else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") { e.preventDefault(); actions.duplicate(); }
    else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); actions.remove(); }
    else if (e.key.toLowerCase() === "n") { e.preventDefault(); actions.addNote("event"); }
  }}>
    <ReactFlow<StormFlowNode> nodes={nodes} edges={projection.edges} nodeTypes={nodeTypes} onNodesChange={changes}
      onEdgesChange={(changes) => actions.setSelected((current) => { const next = new Set(current); for (const c of changes) if (c.type === "select") { if (c.selected) next.add(c.id); else next.delete(c.id); } return [...next]; })}
      onEdgeClick={(_e, edge) => { actions.setSelected([edge.id]); showDetails(); }}
      onNodeClick={(e, node) => actions.selectItem(node.id, e.shiftKey || e.metaKey || e.ctrlKey)}
      onConnect={(c) => { if (!locked && c.source && c.target) actions.connect(c.source, c.target); }}
      onPaneClick={(e) => { if (!locked && actions.tool !== "select" && actions.tool !== "hand") actions.addNote(actions.tool as Parameters<StormActions["addNote"]>[0], flow.screenToFlowPosition({ x: e.clientX, y: e.clientY })); }}
      nodesDraggable={!locked && actions.tool !== "hand"} nodesConnectable={!locked} nodesFocusable edgesFocusable multiSelectionKeyCode={["Meta", "Control", "Shift"]}
      panOnDrag={actions.tool === "hand" ? true : [1, 2]} selectionOnDrag={actions.tool === "select"} panOnScroll zoomOnScroll={false} zoomOnDoubleClick={false}
      deleteKeyCode={null} fitView fitViewOptions={{ padding: 0.2, minZoom: 0.6, maxZoom: 0.9 }} minZoom={0.1} maxZoom={2}>
      <Background gap={24} size={1} color="var(--border)" /><Controls showInteractive={false} />
      <MiniMap pannable zoomable style={{ background: "var(--card)" }} nodeColor="var(--muted)" maskColor="color-mix(in srgb,var(--background) 70%,transparent)" />
    </ReactFlow>
  </div>;
}
