import { createContext, memo, useContext, useEffect, useRef, useState } from "react";
import { Handle, NodeResizer, NodeToolbar, Position, type Node, type NodeProps } from "@xyflow/react";
import type { StormFrame, StormNote, StormPlacement } from "@shared/orchestration/eventStorming";
import { Button } from "@/components/ui/button";
import { NOTE_KINDS } from "./stormPresentation";

interface Interaction {
  locked: boolean; singleSelection: boolean; patchNote(id: string, patch: Partial<StormNote>): void; patchFrame(id: string, title: string): void;
  resize(id: string, size: { x: number; y: number; width: number; height: number }): void;
  action(action: string): void; focusNote(id: string): void;
}
export const StormInteraction = createContext<Interaction>({ locked: false, singleSelection: false, patchNote() {}, patchFrame() {}, resize() {}, action() {}, focusNote() {} });
export type StickyFlowNode = Node<{ note: StormNote; placement: StormPlacement; uses: number; editing: boolean }, "sticky">;
export type FrameFlowNode = Node<{ frame: StormFrame }, "frame">;
export type StormFlowNode = StickyFlowNode | FrameFlowNode;

export const StormSticky = memo(function StormSticky({ id, data, selected }: NodeProps<StickyFlowNode>) {
  const { locked, singleSelection, patchNote, resize, action } = useContext(StormInteraction);
  const input = useRef<HTMLTextAreaElement>(null);
  const [expanded, setExpanded] = useState(false);
  const kind = NOTE_KINDS[data.note.kind];
  useEffect(() => { if (data.editing) input.current?.focus(); }, [data.editing]);
  return <article className={`storm-sticky storm-color-${data.note.kind}${data.placement.pivotal ? " storm-pivotal" : ""}`} aria-label={`${kind.label}: ${data.note.title || "Untitled"}`}>
    <NodeResizer isVisible={Boolean(selected && !locked)} minWidth={136} minHeight={112} onResizeEnd={(_event, size) => resize(id, size)} />
    <Handle type="target" position={Position.Left} isConnectable={!locked} />
    <Handle type="source" position={Position.Right} isConnectable={!locked} />
    <div className="storm-note-grip"><span aria-hidden="true">{kind.icon}</span><span>{kind.label}</span>{data.placement.pivotal && <span title="Pivotal event">★</span>}</div>
    <textarea ref={input} className="nodrag nowheel storm-note-title" aria-label={`${kind.label} title`} placeholder={kind.hint} value={data.note.title} readOnly={locked}
      onChange={(event) => patchNote(data.note.id, { title: event.target.value })} maxLength={500} />
    {expanded && <div className="storm-note-details nodrag nowheel">
      <textarea aria-label="Details and invariants" placeholder="Details, invariants, open questions…" value={data.note.details} readOnly={locked} maxLength={20_000} onChange={(event) => patchNote(data.note.id, { details: event.target.value })} />
      <label>Sources<textarea aria-label="Source references" placeholder=".ballet/adr/… or https://…" value={data.note.sources.join("\n")} readOnly={locked}
        onChange={(event) => patchNote(data.note.id, { sources: event.target.value ? event.target.value.split("\n") : [] })} /></label>
    </div>}
    <div className="storm-note-foot nodrag"><button type="button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>{expanded ? "Close details" : data.note.details || data.note.sources.length ? "Details ↗" : "+ Details"}</button>
      {data.uses > 1 && <span title="Text changes apply to every use">Used on {data.uses} boards</span>}</div>
    <NodeToolbar isVisible={Boolean(selected && singleSelection)} position={Position.Top} className="storm-context nodrag">
      <Button variant="ghost" disabled={locked} onClick={() => input.current?.focus()}>Edit</Button>
      {data.note.kind === "event" && <Button variant="ghost" disabled={locked} onClick={() => action("pivotal")}>{data.placement.pivotal ? "Unmark pivotal" : "★ Pivotal"}</Button>}
      <Button variant="ghost" disabled={locked} onClick={() => action("duplicate")}>Duplicate</Button>
      <Button variant="ghost" disabled={locked} onClick={() => action("remove")}>Remove</Button>
    </NodeToolbar>
  </article>;
});
export const StormFrameNode = memo(function StormFrameNode({ id, data, selected }: NodeProps<FrameFlowNode>) {
  const { locked, patchFrame, resize } = useContext(StormInteraction);
  return <section className={`storm-frame storm-frame-${data.frame.kind}`} aria-label={`${data.frame.kind}: ${data.frame.title}`}>
    <NodeResizer isVisible={Boolean(selected && !locked)} minWidth={240} minHeight={160} onResizeEnd={(_event, size) => resize(id, size)} />
    <div className="storm-note-grip"><span>{data.frame.kind === "bounded-context" ? "BOUNDED CONTEXT" : "PROCESS"}</span></div>
    <input className="nodrag" aria-label="Frame name" readOnly={locked} value={data.frame.title} maxLength={500} onChange={(event) => patchFrame(id, event.target.value)} />
  </section>;
});
