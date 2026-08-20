import { getSmartEdge } from "@tisoap/react-flow-smart-edge";
import {
  BaseEdge,
  EdgeLabelRenderer,
  Handle,
  Position,
  getSmoothStepPath,
  useNodes,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps
} from "@xyflow/react";
import { ArrowRight, LockKeyhole, PackageCheck, Wrench } from "lucide-react";
import type { MarkerType } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { LoopNodeArtwork } from "./LoopNodeArtwork";
import { LoopRouteArtwork } from "./LoopRouteArtwork";
import type {
  GraphEngineeringEdge,
  GraphEngineeringLiveStatus,
  GraphEngineeringNode,
  GraphEngineeringOrchestratorNode
} from "./engineeringProjections";
import { loopSmartEdgeRoutingOptions } from "./loopSmartEdgeRouting";

export type GraphLoopNodeData = Record<string, unknown> & {
  node: GraphEngineeringNode;
  selected: boolean;
  repairCount: number;
  onSelect: (loopId: string) => void;
  onOpen: (loopId: string) => void;
};
export type GraphOrchestratorNodeData = Record<string, unknown> & {
  node: GraphEngineeringOrchestratorNode;
  selected: boolean;
  policyCount: number;
  onSelect: () => void;
};
export type GraphLoopFlowNode = Node<GraphLoopNodeData, "graphLoop">;
export type GraphOrchestratorFlowNode = Node<GraphOrchestratorNodeData, "graphOrchestrator">;
export type GraphFlowNode = GraphLoopFlowNode | GraphOrchestratorFlowNode;

export type GraphRouteSegmentData = Record<string, unknown> & {
  edge: GraphEngineeringEdge;
  segment: "request" | "dispatch";
  onSelect: (edge: GraphEngineeringEdge) => void;
};
export type GraphRouteSegmentEdge = Edge<GraphRouteSegmentData, "graphRouteSegment"> & {
  markerEnd: { type: MarkerType; color: string };
};

export function GraphEngineeringLoopNodeView({ data }: NodeProps<GraphLoopFlowNode>) {
  const { node } = data;
  const capabilitySummary = `${node.accepts.length} accepts · ${node.provides.length} provides`;
  return (
    <div className="relative h-full w-full">
      <GraphHandles />
      <button
        type="button"
        data-graph-loop-node={node.loopId}
        data-live-run-status={node.liveStatus}
        aria-label={`${node.kind === "installed" ? "Installed module" : "Custom Loop"} ${node.title}, Loop ID ${node.loopId}, responsibility ${node.description}, ${capabilitySummary}, ${node.jobCount} Jobs${node.liveStatus ? `, live Run status ${node.liveStatus}` : ""}${node.locked ? ", editing locked by active Run" : ""}`}
        title={node.loopId}
        className={cn(
          "nodrag nopan grid h-full w-full grid-cols-[2.5rem_minmax(0,1fr)] gap-x-2.5 overflow-hidden rounded-lg border bg-card px-3 py-2.5 text-left outline-none transition-colors hover:border-primary/50 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30",
          data.selected ? "border-primary ring-2 ring-primary/20" : statusBorder(node.liveStatus)
        )}
        onClick={() => data.onSelect(node.loopId)}
        onDoubleClick={() => data.onOpen(node.loopId)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            data.onOpen(node.loopId);
          }
        }}
      >
        <span aria-hidden="true" className="loop-artwork-node relative mt-0.5 size-10 shrink-0 rounded-full" data-loop-node-size="small"><LoopNodeArtwork nodeStyle={node.artworkStyle} /></span>
        <span className="min-w-0">
          <span className="flex min-w-0 items-center gap-1.5">
            {node.kind === "installed" ? <PackageCheck className="size-3.5 shrink-0 text-primary" aria-hidden="true" /> : null}
            <span className="truncate font-mono text-[0.72rem] font-semibold">{node.title}</span>
            {node.locked ? <LockKeyhole className="ml-auto size-3.5 shrink-0 text-tertiary" aria-hidden="true" /> : null}
          </span>
          <span className="mt-1 line-clamp-1 text-[0.68rem] leading-4 text-muted-foreground">{node.description}</span>
        </span>
        <span className="col-span-2 mt-1.5 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 border-t border-divider-strong pt-1.5 font-mono text-[0.6rem] leading-4 text-muted-foreground">
          <span className="min-w-0 truncate">{capabilitySummary}</span>
          <span>{node.jobCount} Jobs</span>
          <span className="min-w-0 truncate">{node.kind === "installed" ? `module ${node.moduleVersion ?? ""} · ${node.provenanceStatus ?? "unknown"}` : "Custom Loop"}</span>
          <LiveStatus status={node.liveStatus} />
        </span>
        {data.repairCount > 0 ? <span aria-hidden="true" title={`${data.repairCount} repair policies`} className="absolute top-1.5 right-1.5 inline-flex items-center gap-0.5 rounded-full border border-tertiary/40 bg-background px-1 py-0.5 font-mono text-[0.55rem] text-tertiary"><Wrench className="size-2.5" />{data.repairCount}</span> : null}
      </button>
    </div>
  );
}

export function GraphEngineeringOrchestratorNodeView({ data }: NodeProps<GraphOrchestratorFlowNode>) {
  const { node } = data;
  return (
    <div className="relative h-full w-full">
      <GraphHandles />
      <button
        type="button"
        data-graph-orchestrator-node
        data-live-run-status={node.liveStatus}
        aria-label={`Loop Orchestrator control node, ${data.policyCount} persisted route policies${node.liveStatus ? `, live Run status ${node.liveStatus}` : ""}, ${node.activeRootRunCount} active Root Runs`}
        className={cn(
          "nodrag nopan grid h-full w-full content-start gap-2 overflow-hidden rounded-lg border bg-card px-4 py-3 text-left outline-none transition-colors hover:border-primary focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30",
          data.selected ? "border-primary ring-2 ring-primary/20" : statusBorder(node.liveStatus)
        )}
        onClick={data.onSelect}
      >
        <span className="flex items-center gap-2.5">
          <span aria-hidden="true" className="grid size-9 place-items-center rounded border border-primary/40 bg-primary/10 text-primary"><LoopRouteArtwork size={24} /></span>
          <span><strong className="block font-mono text-xs">{node.title}</strong><span className="font-mono text-[0.6rem] uppercase tracking-[0.08em] text-primary">control node</span></span>
        </span>
        <span className="line-clamp-2 text-[0.68rem] leading-4 text-muted-foreground">{node.description}</span>
        <span className="flex items-center justify-between border-t border-divider-strong pt-1.5 font-mono text-[0.6rem] text-muted-foreground"><span>{data.policyCount} persisted policies</span><LiveStatus status={node.liveStatus} /></span>
      </button>
    </div>
  );
}

export function GraphEngineeringRouteSegmentView(props: EdgeProps<GraphRouteSegmentEdge>) {
  const nodes = useNodes();
  const [fallbackPath, fallbackLabelX, fallbackLabelY] = getSmoothStepPath({
    sourceX: props.sourceX, sourceY: props.sourceY, targetX: props.targetX, targetY: props.targetY,
    sourcePosition: props.sourcePosition, targetPosition: props.targetPosition, borderRadius: 4, offset: 32
  });
  const smartEdge = getSmartEdge({
    sourceX: props.sourceX, sourceY: props.sourceY, targetX: props.targetX, targetY: props.targetY,
    sourcePosition: props.sourcePosition, targetPosition: props.targetPosition, nodes,
    options: loopSmartEdgeRoutingOptions({ sourceY: props.sourceY, targetY: props.targetY })
  });
  const path = smartEdge instanceof Error ? fallbackPath : smartEdge.svgPathString;
  const labelX = smartEdge instanceof Error ? fallbackLabelX : smartEdge.edgeCenterX;
  const labelY = smartEdge instanceof Error ? fallbackLabelY : smartEdge.edgeCenterY;
  const edge = props.data?.edge;
  if (!edge) return null;
  const active = Boolean(edge.activeRoute);
  const request = props.data?.segment === "request";
  const label = `${edge.kind} · ${edge.capability}`;
  const Icon = edge.kind === "repair" ? Wrench : ArrowRight;
  const accessible = `${edge.kind} route ${edge.source} to ${edge.target} via Loop Orchestrator, capability ${edge.capability}, persisted policy ${edge.id}${active ? ", active canonical Run route" : ""}`;
  return (
    <>
      <BaseEdge id={props.id} path={path} markerEnd={props.markerEnd} style={props.style} interactionWidth={18} />
      {!request ? <EdgeLabelRenderer>
        <button
          type="button"
          data-graph-edge-label={edge.id}
          data-control-segment={props.data?.segment}
          data-active-canonical-route={active || undefined}
          aria-label={accessible}
          title={`${edge.description} (${edge.source} → ${edge.target})`}
          className={cn(
            "nodrag nopan absolute z-10 inline-flex max-w-52 items-center gap-1 rounded-sm border bg-background/95 px-1.5 py-0.5 font-mono text-[0.62rem] outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
            edge.kind === "repair" ? "border-tertiary/40 text-tertiary" : "border-divider-strong text-[var(--loop-theme-edge-label)]",
            active && "border-secondary text-secondary"
          )}
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          onClick={() => props.data?.onSelect(edge)}
        >
          <Icon className="size-2.5 shrink-0" aria-hidden="true" /><span className="truncate">{label}</span>
        </button>
      </EdgeLabelRenderer> : null}
    </>
  );
}

function GraphHandles() {
  return <>
    <Handle id="left-target" type="target" position={Position.Left} isConnectable={false} className="loop-react-flow-handle" />
    <Handle id="left-source" type="source" position={Position.Left} isConnectable={false} className="loop-react-flow-handle" />
    <Handle id="right-target" type="target" position={Position.Right} isConnectable={false} className="loop-react-flow-handle" />
    <Handle id="right-source" type="source" position={Position.Right} isConnectable={false} className="loop-react-flow-handle" />
    <Handle id="top-target" type="target" position={Position.Top} isConnectable={false} className="loop-react-flow-handle" />
    <Handle id="top-source" type="source" position={Position.Top} isConnectable={false} className="loop-react-flow-handle" />
    <Handle id="bottom-target" type="target" position={Position.Bottom} isConnectable={false} className="loop-react-flow-handle" />
    <Handle id="bottom-source" type="source" position={Position.Bottom} isConnectable={false} className="loop-react-flow-handle" />
  </>;
}

function LiveStatus({ status }: { status?: GraphEngineeringLiveStatus }) {
  return status ? <span className={cn("justify-self-end", statusText(status))}>{status}</span> : <span className="justify-self-end">idle</span>;
}

const statusBorder = (status?: GraphEngineeringLiveStatus) => {
  if (["failed", "blocked"].includes(status ?? "")) return "border-error/70";
  if (status === "waiting_for_input" || status === "queued") return "border-tertiary/60";
  if (status === "running") return "border-secondary/60";
  return "border-divider-strong";
};

const statusText = (status: GraphEngineeringLiveStatus) => {
  if (["failed", "blocked"].includes(status)) return "text-error";
  if (status === "waiting_for_input" || status === "queued") return "text-tertiary";
  if (status === "running" || status === "completed") return "text-secondary";
  return "text-muted-foreground";
};
