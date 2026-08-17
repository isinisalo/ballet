import { useMemo } from "react";
import { getSmartEdge } from "@tisoap/react-flow-smart-edge";
import {
  BaseEdge,
  EdgeLabelRenderer,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  getSmoothStepPath,
  useNodes,
  type Edge,
  type EdgeProps,
  type EdgeTypes,
  type Node,
  type NodeProps,
  type NodeTypes
} from "@xyflow/react";
import { ArrowRight, LockKeyhole, PackageCheck, Settings2, Wrench } from "lucide-react";
import type { LoopTheme, ProjectLoopEdge } from "@shared/api/workspace-contracts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { calculateLoopCompositionLayout, loopCompositionNodeSize } from "./loopCompositionLayout";
import { LoopNodeArtwork } from "./LoopNodeArtwork";
import { buildLoopCompositionFocus } from "./loopEngineerProjections";
import type { LoopCompositionNode, LoopCompositionProjection } from "./loopEngineerProjections";
import { loopEdgeDasharray, loopThemeCssProperties } from "./loopTheme";
import { loopSmartEdgeRoutingOptions } from "./loopSmartEdgeRouting";

type CompositionNodeData = Record<string, unknown> & {
  node: LoopCompositionNode;
  selected: boolean;
  repairCount: number;
  onSelect: (loopId: string) => void;
  onOpen: (loopId: string) => void;
};
type CompositionFlowNode = Node<CompositionNodeData, "compositionLoop">;
type CompositionEdgeData = Record<string, unknown> & { edge: ProjectLoopEdge };
type CompositionFlowEdge = Edge<CompositionEdgeData, "compositionEdge">;

const nodeTypes = { compositionLoop: LoopCompositionNodeView } satisfies NodeTypes;
const edgeTypes = { compositionEdge: LoopCompositionEdgeView } satisfies EdgeTypes;

export function LoopCompositionCanvas({ projection, selectedLoopId, theme, onSelectLoop, onOpenLoop, onSelectEdge, onOpenOrchestrator }: {
  projection: LoopCompositionProjection;
  selectedLoopId?: string;
  theme: LoopTheme;
  onSelectLoop: (loopId: string) => void;
  onOpenLoop: (loopId: string) => void;
  onSelectEdge: (edge: ProjectLoopEdge) => void;
  onOpenOrchestrator: () => void;
}) {
  const focus = useMemo(() => buildLoopCompositionFocus(projection, selectedLoopId), [projection, selectedLoopId]);
  const layout = useMemo(() => calculateLoopCompositionLayout(projection), [projection]);
  const nodes = useMemo<CompositionFlowNode[]>(() => layout.map((position) => {
    const node = projection.nodes.find((candidate) => candidate.loopId === position.loopId);
    if (!node) throw new Error(`Missing composition node ${position.loopId}.`);
    return {
      id: node.loopId,
      type: "compositionLoop",
      position: { x: position.x, y: position.y },
      width: loopCompositionNodeSize.width,
      height: loopCompositionNodeSize.height,
      initialWidth: loopCompositionNodeSize.width,
      initialHeight: loopCompositionNodeSize.height,
      measured: loopCompositionNodeSize,
      draggable: false,
      selectable: false,
      focusable: false,
      data: {
        node,
        selected: node.loopId === selectedLoopId,
        repairCount: projection.edges.filter((edge) => edge.kind === "repair" && (edge.source === node.loopId || edge.target === node.loopId)).length,
        onSelect: onSelectLoop,
        onOpen: onOpenLoop
      },
      style: { width: loopCompositionNodeSize.width, height: loopCompositionNodeSize.height, pointerEvents: "all" }
    };
  }), [layout, onOpenLoop, onSelectLoop, projection.edges, projection.nodes, selectedLoopId]);
  const edges = useMemo<CompositionFlowEdge[]>(() => focus.edges.map((edge) => {
    const reverse = focus.edges.find((candidate) => candidate.source === edge.target && candidate.target === edge.source);
    const outsideCycleRoute = edge.source === edge.target || Boolean(reverse && edge.id.localeCompare(reverse.id) > 0);
    return {
      id: edge.id,
      type: "compositionEdge",
      source: edge.source,
      target: edge.target,
      sourceHandle: outsideCycleRoute ? "bottom-source" : "right-source",
      targetHandle: outsideCycleRoute ? "bottom-target" : "left-target",
      data: { edge },
      focusable: false,
      selectable: false,
      markerEnd: { type: MarkerType.ArrowClosed, color: edge.kind === "repair" ? "var(--tertiary)" : "var(--loop-theme-edge-color)" },
      style: {
        stroke: edge.kind === "repair" ? "var(--tertiary)" : "var(--loop-theme-edge-color)",
        strokeWidth: 1.5,
        strokeDasharray: loopEdgeDasharray(edge.kind === "repair" ? theme.edge.repairStyle : theme.edge.crossLoopStyle)
      }
    };
  }), [focus.edges, theme.edge.crossLoopStyle, theme.edge.repairStyle]);

  return (
    <div
      data-loop-canvas
      data-loop-engineer-level="composition"
      aria-label={`Level 1 · Loops composition canvas; ${focus.edges.filter((edge) => edge.kind === "flow").length} flow Loop Edges and ${focus.visibleRepairCount} focused repair Loop Edges visible; ${focus.hiddenRepairCount} repair Loop Edges hidden`}
      className="relative h-full min-h-[34rem] min-w-0 overflow-hidden border border-divider-strong bg-background"
      style={loopThemeCssProperties(theme)}
    >
      <div className="pointer-events-none absolute inset-0 opacity-50 bg-[image:linear-gradient(to_right,var(--divider-strong)_1px,transparent_1px),linear-gradient(to_bottom,var(--divider-strong)_1px,transparent_1px)] bg-[size:24px_24px]" />
      <div className="pointer-events-none absolute top-2 left-2 z-20 flex max-w-[calc(100%-1rem)] items-center gap-1.5 overflow-hidden rounded border border-divider-strong bg-card/95 p-1 font-mono text-[0.62rem] text-muted-foreground">
        <span className="shrink-0 rounded-sm bg-muted px-1.5 py-1 text-foreground">Flow · {focus.edges.filter((edge) => edge.kind === "flow").length}</span>
        <span data-visible-repair-count={focus.visibleRepairCount} className="shrink-0 px-1 text-tertiary">Repair focus · {focus.visibleRepairCount} shown</span>
        <span data-hidden-repair-count={focus.hiddenRepairCount} className="truncate">{focus.hiddenRepairCount} hidden</span>
        <Button type="button" size="xs" variant="ghost" className="pointer-events-auto ml-auto lg:hidden" onClick={onOpenOrchestrator}><Settings2 /> Orchestrator</Button>
      </div>
      <ReactFlow<CompositionFlowNode, CompositionFlowEdge>
        className="loop-react-flow relative z-10 h-full min-h-[34rem] w-full"
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.24, minZoom: 0.4, maxZoom: 1 }}
        minZoom={0.35}
        maxZoom={1}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnScroll={false}
        zoomOnScroll={false}
        zoomOnPinch
        zoomOnDoubleClick={false}
        preventScrolling={false}
        deleteKeyCode={null}
        proOptions={{ hideAttribution: true }}
        onEdgeClick={(event, selected) => {
          event.stopPropagation();
          if (selected.data?.edge) onSelectEdge(selected.data.edge);
        }}
      />
    </div>
  );
}

function LoopCompositionNodeView({ data }: NodeProps<CompositionFlowNode>) {
  const { node } = data;
  return (
    <div className="relative h-full w-full">
      <Handle id="left-target" type="target" position={Position.Left} isConnectable={false} className="loop-react-flow-handle" />
      <Handle id="right-source" type="source" position={Position.Right} isConnectable={false} className="loop-react-flow-handle" />
      <Handle id="bottom-target" type="target" position={Position.Bottom} isConnectable={false} className="loop-react-flow-handle" />
      <Handle id="bottom-source" type="source" position={Position.Bottom} isConnectable={false} className="loop-react-flow-handle" />
      <button
        type="button"
        data-loop-composition-node={node.loopId}
        aria-label={`${node.kind === "installed" ? "Installed module" : "Custom Loop"} ${node.title}, Loop ID ${node.loopId}, ${node.workLoopNodeCount} Work Loop Nodes${node.locked ? ", editing locked by active Run" : ""}`}
        title={node.loopId}
        className={cn(
          "nodrag nopan flex h-full w-full items-center gap-2.5 overflow-hidden rounded-lg border bg-card px-2.5 py-2 text-left outline-none transition-colors hover:border-primary/50 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30",
          data.selected ? "border-primary ring-2 ring-primary/20" : "border-divider-strong"
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
        <span aria-hidden="true" className="loop-artwork-node relative size-9 shrink-0 rounded-full" data-loop-node-size="small"><LoopNodeArtwork nodeStyle={node.artworkStyle} /></span>
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5">
            {node.kind === "installed" ? <PackageCheck className="size-3.5 shrink-0 text-primary" aria-hidden="true" /> : null}
            <span className="truncate font-mono text-[0.68rem] font-semibold">{node.title}</span>
            {node.locked ? <LockKeyhole className="ml-auto size-3.5 shrink-0 text-tertiary" aria-hidden="true" /> : null}
          </span>
          {node.title !== node.loopId ? <span className="mt-0.5 block truncate font-mono text-[0.58rem] text-muted-foreground">{node.loopId}</span> : null}
          <span className="mt-1 flex min-w-0 items-center gap-1 font-mono text-[0.58rem] text-muted-foreground"><span>{node.workLoopNodeCount} nodes</span><span>·</span><span>{node.kind === "installed" ? "Installed module" : "Custom Loop"}</span>{node.moduleVersion ? <span>v{node.moduleVersion}</span> : null}</span>
        </span>
        {data.repairCount > 0 ? <span aria-hidden="true" title={`${data.repairCount} repair Loop Edges`} className="absolute top-1.5 right-1.5 inline-flex items-center gap-0.5 rounded-full border border-tertiary/40 bg-background px-1 py-0.5 font-mono text-[0.55rem] text-tertiary"><Wrench className="size-2.5" />{data.repairCount}</span> : null}
      </button>
    </div>
  );
}

function LoopCompositionEdgeView({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, style, data }: EdgeProps<CompositionFlowEdge>) {
  const nodes = useNodes<CompositionFlowNode>();
  const [fallbackPath, fallbackLabelX, fallbackLabelY] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 4, offset: 28 });
  const smartEdge = getSmartEdge({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    nodes,
    options: loopSmartEdgeRoutingOptions({ sourceY, targetY })
  });
  const path = smartEdge instanceof Error ? fallbackPath : smartEdge.svgPathString;
  const labelX = smartEdge instanceof Error ? fallbackLabelX : smartEdge.edgeCenterX;
  const labelY = smartEdge instanceof Error ? fallbackLabelY : smartEdge.edgeCenterY;
  const edge = data?.edge;
  const Icon = edge?.kind === "repair" ? Wrench : ArrowRight;
  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} interactionWidth={18} />
      {edge ? <EdgeLabelRenderer>
        <span
          aria-hidden="true"
          title={`${edge.kind}: ${edge.description}`}
          className={cn(
            "pointer-events-none absolute z-10 inline-flex items-center gap-1 rounded-sm border bg-background/95 px-1.5 py-0.5 font-mono text-[0.62rem]",
            edge.kind === "repair" ? "border-tertiary/40 text-tertiary" : "border-divider-strong text-[var(--loop-theme-edge-label)]"
          )}
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
        >
          <Icon className="size-2.5" /> {edge.kind}
        </span>
      </EdgeLabelRenderer> : null}
    </>
  );
}
