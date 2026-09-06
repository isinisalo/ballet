import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { StormConcept } from "@shared/orchestration/eventStorming";
import type { StormFrame, StormPlacement } from "@shared/orchestration/eventStormingLayout";
import { NOTE_KINDS } from "./stormPresentation";
export type StormFlowNode = Node<{ concept?: StormConcept; placement?: StormPlacement; frame?: StormFrame; stories?: number; highlight?: boolean }, "sticky" | "frame">;
export function StormSticky({ data }: NodeProps<StormFlowNode>) {
  const concept = data.concept!; const type = NOTE_KINDS[concept.kind];
  return <div className={`storm-note storm-color-${concept.kind}${data.highlight ? " storm-highlight" : ""}`}>
    <Handle type="target" position={Position.Left} aria-label="Connection target" />
    <div className="storm-note-grip"><span aria-hidden="true">{type.icon}</span> {type.label}</div>
    <strong>{concept.title || "Untitled"}</strong>
    <div className="storm-note-badges">{Boolean(data.stories) && <span>{data.stories} {data.stories === 1 ? "story" : "stories"}</span>}{data.placement?.pivotal && <span>★ Pivotal</span>}</div>
    <Handle type="source" position={Position.Right} aria-label="Connection source" />
  </div>;
}
export function StormFrameNode({ data }: NodeProps<StormFlowNode>) {
  return <div className="storm-frame"><div className="storm-note-grip">{data.frame?.title}</div></div>;
}
