import { useId, type CSSProperties, type ReactNode } from "react";
import type { ActionDefinition } from "@shared/orchestration/environment";
import { projectActionFlow, type ActionFlowTone } from "./actionFlowProjection";
import { useCanvasSurfaceSize } from "./useCanvasSurfaceSize";
import "./ActionFlow.css";

export function ActionFlow({ action }: { action: ActionDefinition }) {
  const [surfaceRef, surface] = useCanvasSurfaceSize();
  const flow = projectActionFlow(surface);
  const markerPrefix = useId().replaceAll(":", "");
  const point = (key: keyof typeof flow.points) => ({ left: flow.points[key].x, top: flow.points[key].y });
  return <section aria-label={`Validation-led flow for Action ${action.id}`} className="orchestration-flow action-flow-grid rounded-md border bg-card">
    <div className="action-flow-legend">ACTION FLOW <span>· authoring projection, not runtime control</span></div>
    <div ref={surfaceRef} className="action-flow-scroll"><div className="action-flow-stage" style={{ width: flow.width, height: flow.height }}>
      <FlowEdges edges={flow.edges} markerPrefix={markerPrefix} width={flow.width} height={flow.height} />
      <FlowCard label="START" kind="start" style={point("start")} />
      <FlowCard label="Work · subordinate" detail="agent · workspace-write" kind="work" style={point("work")} />
      <FlowCard label="Validation · main controller" detail="agent · read-only" kind="validation" style={point("validation")} />
      <Decision label="done?" style={point("done")} />
      <FlowCard label="Done" detail="continue State gate" kind="complete" style={point("complete")} />
      <Decision label="work?" detail="delegate / retry" style={point("retry")} />
      <FlowCard label="Blocked" detail="Feedback" kind="blocked" style={point("blocked")} />
      <FlowCard label={`${action.maxRetries} additional retries`} detail={`${1 + action.maxRetries} total Work attempts`} kind="retry-count" style={point("retryCount")} />
    </div></div>
    <p className="action-flow-caption">Precheck may finish, block, or delegate. Only postwork Validation retry consumes the additional retry budget.</p>
  </section>;
}

function FlowEdges({ edges, markerPrefix, width, height }: { edges: ReturnType<typeof projectActionFlow>["edges"]; markerPrefix: string; width: number; height: number }) {
  const tones: ActionFlowTone[] = ["flow", "attention", "fail", "neutral"];
  return <svg className="action-flow-edges" width={width} height={height} aria-hidden="true"><defs>{tones.map((tone) => <marker key={tone} id={`${markerPrefix}-${tone}`} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" className={`action-flow-marker action-flow-marker--${tone}`} /></marker>)}</defs>
    {edges.map((edge) => <g key={edge.id}><path d={edge.path} className={`action-flow-edge action-flow-edge--${edge.tone}`} data-dashed={edge.dashed ? "true" : "false"} markerEnd={edge.id === "retry-count" ? undefined : `url(#${markerPrefix}-${edge.tone})`} />{edge.label ? <text x={edge.labelX} y={edge.labelY} className={`action-flow-edge-label action-flow-edge-label--${edge.tone}`}>{edge.label}</text> : null}</g>)}
  </svg>;
}

function FlowCard({ label, detail, kind, style }: { label: string; detail?: ReactNode; kind: "start" | "work" | "validation" | "complete" | "blocked" | "retry-count"; style: CSSProperties }) {
  return <div className={`action-flow-card action-flow-card--${kind}`} style={style} aria-label={detail ? `${label}, ${String(detail)}` : label}><strong>{label}</strong>{detail ? <small>{detail}</small> : null}</div>;
}

function Decision({ label, detail, style }: { label: string; detail?: string; style: CSSProperties }) {
  return <div className="action-flow-decision" style={style} aria-label={detail ? `${label}, ${detail}` : label}><span aria-hidden="true" /><strong>{label}</strong>{detail ? <small>{detail}</small> : null}</div>;
}
