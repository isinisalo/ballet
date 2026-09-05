import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Background, ControlButton, Controls, MiniMap, Panel, ReactFlow, ReactFlowProvider, useNodesInitialized, useReactFlow, type NodeChange, type NodeTypes } from "@xyflow/react";
import { Map as MapIcon } from "lucide-react";
import "@xyflow/react/dist/style.css";
import type { EventStormingModelV1, StormBoard, StormNoteKind } from "@shared/orchestration/eventStorming";
import { Button } from "@/components/ui/button";
import { StormFrameNode, StormInteraction, StormSticky, type StormFlowNode } from "./StormNodes";
import { changeStormGeometry, projectStormBoard, type StormGeometry } from "./stormProjection";
import { NOTE_KINDS, palette } from "./stormPresentation";
import type { StormActions } from "./useStormActions";

const nodeTypes = { sticky: StormSticky, frame: StormFrameNode } satisfies NodeTypes;
interface CanvasProps { value: EventStormingModelV1; board: StormBoard; focusId?: string; actions: StormActions; locked: boolean; undo(): void; redo(): void }
export function StormCanvas(props: CanvasProps) { return <ReactFlowProvider><CanvasSurface {...props} /></ReactFlowProvider>; }

function CanvasSurface({ value, board, focusId, actions, locked, undo, redo }: CanvasProps) {
  const flow = useReactFlow<StormFlowNode>();
  const initialized = useNodesInitialized();
  const surface = useRef<HTMLDivElement>(null);
  const latest = useRef(actions); latest.current = actions;
  const [miniMap, setMiniMap] = useState(false);
  const projection = useMemo(() => projectStormBoard(value, board, actions.selected, actions.editingId), [value, board, actions.selected, actions.editingId]);
  const [geometry, setGeometry] = useState<StormGeometry>(new Map());
  const nodes = projection.nodes.map((node) => {
    const shape = geometry.get(node.id); const size = { width: shape?.width ?? node.width!, height: shape?.height ?? node.height! };
    return { ...node, ...shape, measured: size, style: { ...node.style, ...size } };
  });
  const nodesRef = useRef(nodes); nodesRef.current = nodes;
  useEffect(() => {
    actions.center.current = () => { const bounds = surface.current?.getBoundingClientRect(); return bounds ? flow.screenToFlowPosition({ x: bounds.left + bounds.width / 2 - 92, y: bounds.top + bounds.height / 2 - 84 }) : { x: 100, y: 100 }; };
  }, [actions.center, flow]);
  useEffect(() => {
    if (actions.editingId) { const p = board.placements.find((p) => p.id === actions.editingId); if (p) void flow.setCenter(p.x + p.width / 2, p.y + p.height / 2, { zoom: Math.max(flow.getZoom(), 0.8) }); }
  }, [actions.editingId, flow]);
  useEffect(() => {
    if (!initialized || !focusId) return;
    const p = board.placements.find((p) => p.id === focusId);
    if (!p) return;
    const bounds = surface.current?.getBoundingClientRect(); const point = flow.flowToScreenPosition({ x: p.x, y: p.y }); const zoom = flow.getZoom();
    if (!bounds || zoom < 0.5 || point.x < bounds.left + 88 || point.y < bounds.top + 80 || point.x + p.width * zoom > bounds.right - 20 || point.y + p.height * zoom > bounds.bottom - 100) {
      void flow.setCenter(p.x + p.width / 2, p.y + p.height / 2, { zoom: Math.max(zoom, 0.8) });
    }
  }, [focusId, initialized, flow]);
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
  useEffect(() => setGeometry(new Map()), [board.placements, board.frames]);
  const focusItem = (id?: string) => { if (id) surface.current?.querySelector<HTMLElement>(`[data-id="${id}"] textarea, [data-id="${id}"] input`)?.focus(); };
  const interaction = { locked, singleSelection: actions.selected.length === 1, patchNote: actions.patchNote, patchFrame: actions.patchFrame, resize: actions.resize, action: actions.action, focusNote: actions.setEditingId };
  return <div ref={surface} className="storm-canvas" tabIndex={-1} aria-label={`${board.title} Event Storming board`}
    onKeyDown={(event) => {
      if (event.key === "Escape") {
        event.preventDefault(); actions.setTool("select"); actions.setEditingId(undefined);
        ((event.target as HTMLElement).closest(".react-flow__node") as HTMLElement | null)?.focus(); return;
      }
      if ((event.target as HTMLElement).closest("input, textarea, select, [contenteditable=true]")) return;
      if (!locked && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
      else if (!locked && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "d") { event.preventDefault(); actions.action("duplicate"); }
      else if (!locked && (event.key === "Delete" || event.key === "Backspace")) { event.preventDefault(); actions.action("remove"); }
      else if (!locked && event.key.toLowerCase() === "n") { event.preventDefault(); actions.addNote("event"); }
      else if (!locked && event.key === "F2") { event.preventDefault(); focusItem(actions.selected[0]); }
    }} onDoubleClick={(event) => {
      if (!locked && (event.target as HTMLElement).classList.contains("react-flow__pane")) actions.addNote("event", flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }));
    }}>
    <StormInteraction.Provider value={interaction}>
      <ReactFlow<StormFlowNode> nodes={nodes} edges={projection.edges} nodeTypes={nodeTypes} onNodesChange={changes}
        onEdgesChange={(changes) => actions.setSelected((current) => {
          const next = new Set(current); for (const c of changes) if (c.type === "select") { if (c.selected) next.add(c.id); else next.delete(c.id); } return [...next];
        })}
        onNodeClick={(event, node) => actions.selectItem(node.id, event.shiftKey || event.metaKey || event.ctrlKey)}
        onNodeDoubleClick={(_event, node) => focusItem(node.id)}
        onConnect={(c) => { if (!locked && c.source && c.target) actions.connect(c.source, c.target); }}
        onPaneClick={(event) => {
          if (actions.tool in NOTE_KINDS && !locked) actions.addNote(actions.tool as StormNoteKind, flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }));
        }}
        nodesDraggable={!locked && actions.tool !== "hand"} nodesConnectable={!locked} nodesFocusable edgesFocusable disableKeyboardA11y={false} multiSelectionKeyCode={["Meta", "Control", "Shift"]}
        panOnDrag={actions.tool === "hand" ? true : [1, 2]} selectionOnDrag={actions.tool === "select"} panOnScroll zoomOnScroll={false} zoomOnDoubleClick={false}
        deleteKeyCode={null} fitView fitViewOptions={{ padding: 0.25, maxZoom: 1 }} minZoom={0.15} maxZoom={2} proOptions={{ hideAttribution: true }}>
        <Background gap={24} size={1} color="var(--border)" />
        <Controls position="bottom-right" showInteractive={false} fitViewOptions={{ padding: 0.25, maxZoom: 1 }}>
          <ControlButton title="Toggle mini map" aria-label="Toggle mini map" aria-pressed={miniMap} onClick={() => setMiniMap(!miniMap)}><MapIcon /></ControlButton>
        </Controls>
        {miniMap && <MiniMap position="top-right" pannable zoomable nodeColor="var(--muted)" maskColor="var(--background)" />}
        <Panel position="bottom-left" className="storm-legend" aria-label="Event Storming color legend">
          {palette(board.level).map((kind) => <span key={kind}><i className={`storm-color-${kind}`} />{NOTE_KINDS[kind].label}</span>)}
        </Panel>
        {board.level === "big-picture" && <Panel position="top-center" className="storm-time" aria-hidden="true">EARLIER <span /> TIME FLOWS → <span /> LATER</Panel>}
        {!board.placements.length && <Panel position="top-center" className="storm-empty-board">
          <span className="storm-empty-symbol" aria-hidden="true">◆</span><h2>Every story starts with an event.</h2>
          <p>Think of something that happened. Put it on the wall.</p>
          <Button disabled={locked} onClick={() => actions.addNote("event")}>+ Add your first event</Button>
          <small>Double-click anywhere · N to add · Drag the label to move</small>
        </Panel>}
      </ReactFlow>
    </StormInteraction.Provider>
  </div>;
}
