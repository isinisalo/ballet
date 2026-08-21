import {
  BaseEdge,
  EdgeLabelRenderer,
  Handle,
  Position,
  getSmoothStepPath,
  getStraightPath,
  type Edge,
  type EdgeProps,
  type MarkerType,
  type Node,
  type NodeProps
} from "@xyflow/react";
import { Check, LockKeyhole, PackageCheck, Route, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  GraphEngineeringEdge,
  GraphEngineeringLiveStatus,
  GraphEngineeringNode,
  GraphEngineeringOrchestratorNode
} from "./engineeringProjections";

export type GraphLoopNodeData = Record<string, unknown> & {
  node: GraphEngineeringNode;
  selected: boolean;
  transitionCount: number;
  repairCount: number;
  onSelect: (loopId: string) => void;
  onOpen: (loopId: string) => void;
};
export type GraphOrchestratorNodeData = Record<string, unknown> & {
  node: GraphEngineeringOrchestratorNode;
  selected: boolean;
  transitionCount: number;
  repairCount: number;
  graphName: string;
  onSelect: () => void;
};
export type GraphDoneNodeData = Record<string, unknown> & { label: "DONE" };
export type GraphLoopFlowNode = Node<GraphLoopNodeData, "graphLoop">;
export type GraphOrchestratorFlowNode = Node<GraphOrchestratorNodeData, "graphOrchestrator">;
export type GraphDoneFlowNode = Node<GraphDoneNodeData, "graphDone">;
export type GraphFlowNode = GraphLoopFlowNode | GraphOrchestratorFlowNode | GraphDoneFlowNode;

export type GraphRouteData = Record<string, unknown> & {
  edge: GraphEngineeringEdge;
  pathKind: "straight" | "smoothstep";
  lane?: { side: "negative" | "positive"; depth: number };
  onSelect: (edge: GraphEngineeringEdge) => void;
};
export type GraphRouteEdge = Edge<GraphRouteData, "graphRoute"> & {
  markerEnd: { type: MarkerType; color: string };
};

export function GraphEngineeringLoopNodeView({ data }: NodeProps<GraphLoopFlowNode>) {
  const { node } = data;
  return <div className="relative h-full w-full">
    <GraphHandles />
    <button
      type="button"
      data-graph-loop-node={node.loopId}
      data-live-run-status={node.liveStatus}
      aria-label={`Loop ${node.title}, ID ${node.loopId}, ${node.description}, ${node.jobCount} Jobs${node.start ? ", Graph start" : ""}${node.liveStatus ? `, status ${node.liveStatus}` : ""}${node.locked ? ", editing locked by active Run" : ""}`}
      className={cn(
        "nodrag nopan grid h-full w-full content-between overflow-hidden rounded-md border bg-card px-3 py-2.5 text-left outline-none transition-colors hover:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/30",
        data.selected ? "border-primary ring-1 ring-primary/30" : statusBorder(node.liveStatus)
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
      <span className="flex min-w-0 items-center gap-2">
        <span className={cn("grid size-7 shrink-0 place-items-center rounded border font-mono text-[0.58rem]", node.start ? "border-primary/60 bg-primary/10 text-primary" : "border-divider-strong bg-muted text-muted-foreground")}>
          {node.start ? "01" : <Route className="size-3.5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <strong className="truncate font-mono text-sm tracking-[0.04em]">{node.title}</strong>
            {node.kind === "installed" ? <PackageCheck className="size-3.5 shrink-0 text-primary" /> : null}
            {node.locked ? <LockKeyhole className="ml-auto size-3.5 shrink-0 text-tertiary" /> : null}
          </span>
          <span className="block truncate font-mono text-[0.58rem] text-muted-foreground">{node.loopId}</span>
        </span>
      </span>
      <span className="line-clamp-2 text-xs leading-4 text-muted-foreground">{node.description}</span>
      <span className="flex items-center justify-between border-t border-divider-strong pt-1.5 font-mono text-[0.58rem] text-muted-foreground">
        <span>{node.jobCount} jobs · {data.transitionCount} routes{data.repairCount ? ` · ${data.repairCount} repair` : ""}</span>
        <LiveStatus status={node.liveStatus} />
      </span>
    </button>
  </div>;
}

export function GraphEngineeringOrchestratorNodeView({ data }: NodeProps<GraphOrchestratorFlowNode>) {
  const { node } = data;
  return <button
    type="button"
    data-graph-orchestrator-node
    className={cn(
      "nodrag nopan grid h-full w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md border bg-card px-4 text-left outline-none hover:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/30",
      data.selected ? "border-primary ring-1 ring-primary/30" : statusBorder(node.liveStatus)
    )}
    aria-label={`Loop Orchestrator for ${data.graphName}; ${data.transitionCount} deterministic transitions and ${data.repairCount} repair routes`}
    onClick={data.onSelect}
  >
    <span className="grid size-10 place-items-center rounded border border-primary/50 bg-primary/10 text-primary"><Route className="size-5" /></span>
    <span className="min-w-0"><strong className="block font-mono text-sm">{node.title}</strong><span className="block truncate text-[0.68rem] text-muted-foreground">{node.description}</span></span>
    <span className="grid gap-0.5 text-right font-mono text-[0.6rem] text-muted-foreground"><span>{data.graphName}</span><span>{data.transitionCount} transitions · {data.repairCount} repairs</span></span>
  </button>;
}

export function GraphEngineeringDoneNodeView() {
  return <div className="relative h-full w-full">
    <Handle id="left-target" type="target" position={Position.Left} isConnectable={false} className="loop-react-flow-handle" />
    <div data-graph-done-node className="grid h-full w-full place-items-center rounded-full border border-secondary/60 bg-secondary/10 font-mono text-xs font-semibold tracking-[0.12em] text-secondary"><span className="inline-flex items-center gap-1"><Check className="size-3.5" />DONE</span></div>
  </div>;
}

export function GraphEngineeringRouteView(props: EdgeProps<GraphRouteEdge>) {
  const edge = props.data?.edge;
  if (!edge) return null;
  const [path, labelX, labelY] = props.data?.pathKind === "straight"
    ? getStraightPath(props)
    : detourPath(props, edge);
  const transition = edge.kind === "transition";
  const label = transition ? `${edge.decision} · ${edge.outcome}` : `REPAIR · ${edge.capability}`;
  const accessible = transition
    ? `${edge.decision} outcome ${edge.outcome}, ${edge.source} to ${edge.targetId === "graph-done" ? "DONE" : edge.targetId}`
    : `Repair capability ${edge.capability}, ${edge.source} to ${edge.target}`;
  return <>
    <BaseEdge id={props.id} path={path} markerEnd={props.markerEnd} style={props.style} interactionWidth={18} />
    <EdgeLabelRenderer>
      <button
        type="button"
        data-graph-edge-label={edge.id}
        aria-label={accessible}
        title={edge.description}
        className={cn(
          "nodrag nopan absolute z-10 max-w-52 truncate rounded-sm border bg-background/95 px-1.5 py-0.5 font-mono text-[0.6rem] outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          transition
            ? edge.decision === "PASS" ? "border-secondary/40 text-secondary" : "border-error/45 text-error"
            : "border-tertiary/50 text-tertiary"
        )}
        style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
        onClick={() => props.data?.onSelect(edge)}
      >
        {edge.kind === "repair" ? <Wrench className="mr-1 inline size-2.5" /> : null}{label}
      </button>
    </EdgeLabelRenderer>
  </>;
}

function detourPath(props: EdgeProps<GraphRouteEdge>, edge: GraphEngineeringEdge) {
  const lane = props.data?.lane ?? { side: "negative" as const, depth: 0 };
  const direction = lane.side === "negative" ? -1 : 1;
  if (edge.source === edge.targetId) return getSmoothStepPath({
    ...props,
    centerX: props.sourceX + direction * (72 + lane.depth * 40),
    centerY: props.sourceY + direction * (72 + lane.depth * 44),
    borderRadius: 6,
    offset: 32
  });
  const referenceY = direction < 0
    ? Math.min(props.sourceY, props.targetY)
    : Math.max(props.sourceY, props.targetY);
  return getSmoothStepPath({
    ...props,
    centerY: referenceY + direction * (72 + lane.depth * 44),
    borderRadius: 6,
    offset: 24
  });
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
  return <span className={status ? statusText(status) : undefined}>{status ?? "idle"}</span>;
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
