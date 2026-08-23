import { useId, type CSSProperties, type ReactNode } from "react";
import type { CanvasNodeSize, CanvasNodeStyle, ProjectJobNode } from "@shared/api/workspace-contracts";
import { useIsMobile } from "@/hooks/use-mobile";
import { jobFlowLayout, projectJobFlow, type JobFlowTone } from "./jobFlowProjection";

export type JobFlowSelection = "work" | "validation" | undefined;

export function JobFlowCanvas({ job, selected, locked, onWork, onValidation }: {
  job: ProjectJobNode;
  selected: JobFlowSelection;
  locked: boolean;
  onWork: () => void;
  onValidation: () => void;
}) {
  const narrow = useIsMobile();
  const projection = projectJobFlow(job);
  const layout = jobFlowLayout(narrow ? "narrow" : "wide", projection.retryEnabled);
  const markerPrefix = useId().replaceAll(":", "");
  const point = (key: keyof typeof layout.points) => ({ left: layout.points[key].x, top: layout.points[key].y });
  return (
    <section className="job-flow-grid job-flow-canvas min-h-0 min-w-0 flex-1 overflow-auto" aria-label={`Action flow ${job.id}`}>
      <div className="job-flow-legend">AUTHORING FLOW <span>· runtime routing remains in Graph Node settings</span></div>
      <div className="job-flow-stage" style={{ width: layout.width, height: layout.height }}>
        <FlowEdges edges={layout.edges} markerPrefix={markerPrefix} width={layout.width} height={layout.height} />
        <StaticCard label="Start" kind="start" style={point("start")} />
        <ActionCard label={job.workNode.id} ariaRole="Work Node" nodeStyle={job.workNode.nodeStyle} nodeSize={job.workNode.nodeSize}
          defined={projection.workDefined} selected={selected === "work"} locked={locked} style={point("work")} onClick={onWork} />
        <ActionCard label={job.validationNode.id} ariaRole="Validation Node" nodeStyle={job.validationNode.nodeStyle} nodeSize={job.validationNode.nodeSize}
          defined={projection.validationDefined} selected={selected === "validation"} locked={locked} style={point("validation")} onClick={onValidation} />
        <Decision label="Pass?" style={point("result")} />
        <Decision label="Retry?" muted={!projection.retryEnabled} style={point("retry")} />
        <StaticCard label={`Retry count ${projection.retryCount}`} kind="retry-count" style={point("retryCount")} />
        <StaticCard label="Escalate" kind="escalate" style={point("escalate")} />
        <StaticCard label="Continue" kind="continue" style={point("continue")} />
      </div>
    </section>
  );
}

function FlowEdges({ edges, markerPrefix, width, height }: {
  edges: ReturnType<typeof jobFlowLayout>["edges"];
  markerPrefix: string;
  width: number;
  height: number;
}) {
  const tones: JobFlowTone[] = ["flow", "retry", "fail"];
  return <svg className="pointer-events-none absolute inset-0" width={width} height={height} aria-hidden="true">
    <defs>{tones.map((tone) => <marker key={tone} id={`${markerPrefix}-${tone}`} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" className={`job-flow-marker job-flow-marker--${tone}`} /></marker>)}</defs>
    {edges.map((edge) => <g key={edge.id}>
      <path d={edge.path} className={`job-flow-edge job-flow-edge--${edge.tone}`} data-edge={edge.id} data-dashed={edge.dashed ? "true" : "false"}
        markerEnd={`url(#${markerPrefix}-${edge.tone})`} />
      {edge.label ? <text x={edge.labelX} y={edge.labelY} className={`job-flow-edge-label job-flow-edge-label--${edge.tone}`}>{edge.label}</text> : null}
    </g>)}
  </svg>;
}

function ActionCard({ label, ariaRole, nodeStyle, nodeSize, defined, selected, locked, style, onClick }: {
  label: string; ariaRole: string; nodeStyle: CanvasNodeStyle; nodeSize: CanvasNodeSize; defined: boolean;
  selected: boolean; locked: boolean; style: CSSProperties; onClick: () => void;
}) {
  return <button type="button" className="job-flow-card job-flow-card--action" style={style} data-style={nodeStyle} data-size={nodeSize}
    data-defined={defined ? "true" : "false"} data-selected={selected ? "true" : "false"} aria-pressed={selected}
    aria-label={`${ariaRole}, ${label}${defined ? "" : ", undefined"}${locked ? ", active run locked" : ""}`} onClick={onClick}>
    <span className="job-flow-emblem" aria-hidden="true" /><CardCopy label={label} />
  </button>;
}

function StaticCard({ label, detail, kind, style }: {
  label: string; detail?: string; kind: "start" | "retry-count" | "escalate" | "continue";
  style: CSSProperties;
}) {
  return <div className={`job-flow-card job-flow-card--${kind}`} style={style} aria-label={detail ? `${label}, ${detail}` : label}>
    <CardCopy label={label} detail={detail} />
  </div>;
}

function Decision({ label, detail, muted, style }: { label: string; detail?: string; muted?: boolean; style: CSSProperties }) {
  return <div className="job-flow-decision" data-muted={muted ? "true" : "false"} style={style} aria-label={detail ? `${label}, ${detail}` : label}>
    <span className="job-flow-decision-shape" aria-hidden="true" /><CardCopy label={label} detail={detail} />
  </div>;
}

function CardCopy({ label, detail }: { label: string; detail?: ReactNode }) {
  return <span className="job-flow-copy"><strong>{label}</strong>{detail ? <small title={typeof detail === "string" ? detail : undefined}>{detail}</small> : null}</span>;
}
