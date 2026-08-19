import { useMemo } from "react";
import { MarkerType, ReactFlow, type EdgeTypes, type NodeTypes } from "@xyflow/react";
import { Settings2 } from "lucide-react";
import type { LoopTheme } from "@shared/api/workspace-contracts";
import { Button } from "@/components/ui/button";
import {
  calculateGraphEngineeringLayout,
  graphEngineeringLoopNodeSize,
  graphEngineeringOrchestratorNodeSize
} from "./graphEngineeringLayout";
import {
  GraphEngineeringLoopNodeView,
  GraphEngineeringOrchestratorNodeView,
  GraphEngineeringRouteSegmentView,
  type GraphFlowNode,
  type GraphLoopFlowNode,
  type GraphOrchestratorFlowNode,
  type GraphRouteSegmentEdge
} from "./GraphEngineeringElements";
import { buildGraphEngineeringFocus } from "./engineeringProjections";
import type { GraphEngineeringEdge, GraphEngineeringProjection } from "./engineeringProjections";
import { loopEdgeDasharray, loopThemeCssProperties } from "./loopTheme";

const nodeTypes = {
  graphLoop: GraphEngineeringLoopNodeView,
  graphOrchestrator: GraphEngineeringOrchestratorNodeView
} satisfies NodeTypes;
const edgeTypes = { graphRouteSegment: GraphEngineeringRouteSegmentView } satisfies EdgeTypes;

export function GraphEngineeringCanvas({
  projection,
  selectedLoopId,
  orchestratorSelected,
  theme,
  onSelectLoop,
  onOpenLoop,
  onSelectEdge,
  onSelectOrchestrator
}: {
  projection: GraphEngineeringProjection;
  selectedLoopId?: string;
  orchestratorSelected: boolean;
  theme: LoopTheme;
  onSelectLoop: (loopId: string) => void;
  onOpenLoop: (loopId: string) => void;
  onSelectEdge: (edge: GraphEngineeringEdge) => void;
  onSelectOrchestrator: () => void;
}) {
  const focus = useMemo(() => buildGraphEngineeringFocus(projection, selectedLoopId), [projection, selectedLoopId]);
  const layout = useMemo(() => calculateGraphEngineeringLayout(projection), [projection]);
  const positions = useMemo(() => new Map(layout.map((node) => [node.id, node])), [layout]);
  const nodes = useMemo<GraphFlowNode[]>(() => [
    orchestratorFlowNode(projection, positions, orchestratorSelected, onSelectOrchestrator),
    ...projection.nodes.map((node): GraphLoopFlowNode => {
      const position = positions.get(node.loopId);
      if (!position) throw new Error(`Missing Graph Engineering node ${node.loopId}.`);
      return {
        id: node.loopId,
        type: "graphLoop",
        position: { x: position.x, y: position.y },
        width: graphEngineeringLoopNodeSize.width,
        height: graphEngineeringLoopNodeSize.height,
        initialWidth: graphEngineeringLoopNodeSize.width,
        initialHeight: graphEngineeringLoopNodeSize.height,
        measured: graphEngineeringLoopNodeSize,
        draggable: false,
        selectable: false,
        focusable: false,
        data: {
          node,
          selected: node.loopId === selectedLoopId && !orchestratorSelected,
          repairCount: projection.edges.filter((edge) => edge.kind === "repair" && (edge.source === node.loopId || edge.target === node.loopId)).length,
          onSelect: onSelectLoop,
          onOpen: onOpenLoop
        },
        style: { ...graphEngineeringLoopNodeSize, pointerEvents: "all" }
      };
    })
  ], [onOpenLoop, onSelectLoop, onSelectOrchestrator, orchestratorSelected, positions, projection, selectedLoopId]);
  const edges = useMemo<GraphRouteSegmentEdge[]>(() => focus.edges.flatMap((edge) =>
    routeSegments(edge, positions, theme, onSelectEdge)), [focus.edges, onSelectEdge, positions, theme]);
  const activeRouteCount = focus.edges.filter((edge) => edge.activeRoute).length;

  return (
    <div
      data-loop-canvas
      data-engineering-view="graph"
      aria-label={`Graph Engineering canvas; one Loop Orchestrator control node, ${projection.nodes.length} LoopNodes, ${focus.edges.filter((edge) => edge.kind === "flow").length} flow route policies and ${focus.visibleRepairCount} repair route policies visible; ${focus.hiddenRepairCount} repair route policies hidden; ${activeRouteCount} canonical Run routes active`}
      className="relative h-full min-h-[34rem] min-w-0 overflow-hidden border border-divider-strong bg-background"
      style={loopThemeCssProperties(theme)}
    >
      <div className="pointer-events-none absolute inset-0 opacity-50 bg-[image:linear-gradient(to_right,var(--divider-strong)_1px,transparent_1px),linear-gradient(to_bottom,var(--divider-strong)_1px,transparent_1px)] bg-[size:24px_24px]" />
      <div className="pointer-events-none absolute top-2 left-2 z-20 flex max-w-[calc(100%-1rem)] items-center gap-1.5 overflow-x-auto rounded border border-divider-strong bg-card/95 p-1 font-mono text-[0.62rem] text-muted-foreground">
        <span className="shrink-0 rounded-sm bg-muted px-1.5 py-1 text-foreground">Completion → Orchestrator → Dispatch · {focus.edges.filter((edge) => edge.kind === "flow").length}</span>
        <span data-visible-repair-count={focus.visibleRepairCount} className="shrink-0 px-1 text-tertiary">Escalation · {focus.visibleRepairCount} shown</span>
        <span data-hidden-repair-count={focus.hiddenRepairCount} className="shrink-0">{focus.hiddenRepairCount} hidden</span>
        {activeRouteCount ? <span className="shrink-0 text-secondary">Live route · {activeRouteCount}</span> : null}
        <Button type="button" size="sm" variant="ghost" className="pointer-events-auto ml-auto shrink-0 lg:hidden max-sm:h-10" onClick={onSelectOrchestrator}><Settings2 /> Orchestrator</Button>
      </div>
      <div aria-label="Visible Graph route policies">
        {focus.edges.map((edge) => <button
          key={edge.id}
          type="button"
          data-graph-edge-keyboard={edge.id}
          className="sr-only focus:not-sr-only focus:absolute focus:top-14 focus:left-2 focus:z-30 focus:rounded focus:border focus:border-primary focus:bg-background focus:px-2 focus:py-1 focus:font-mono focus:text-xs"
          aria-label={`${edge.kind} route ${edge.source} to ${edge.target} via Loop Orchestrator, capability ${edge.capability}, persisted policy ${edge.id}${edge.activeRoute ? ", active canonical Run route" : ""}`}
          onClick={() => onSelectEdge(edge)}
        >{edge.kind} · {edge.capability}</button>)}
      </div>
      <ReactFlow<GraphFlowNode, GraphRouteSegmentEdge>
        className="loop-react-flow relative z-10 h-full min-h-[34rem] w-full"
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.18, minZoom: 0.35, maxZoom: 1 }}
        minZoom={0.3}
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

function orchestratorFlowNode(
  projection: GraphEngineeringProjection,
  positions: Map<string, ReturnType<typeof calculateGraphEngineeringLayout>[number]>,
  selected: boolean,
  onSelect: () => void
): GraphOrchestratorFlowNode {
  const position = positions.get(projection.orchestrator.id);
  if (!position) throw new Error("Missing Graph Engineering Loop Orchestrator node.");
  return {
    id: projection.orchestrator.id,
    type: "graphOrchestrator",
    position: { x: position.x, y: position.y },
    width: graphEngineeringOrchestratorNodeSize.width,
    height: graphEngineeringOrchestratorNodeSize.height,
    initialWidth: graphEngineeringOrchestratorNodeSize.width,
    initialHeight: graphEngineeringOrchestratorNodeSize.height,
    measured: graphEngineeringOrchestratorNodeSize,
    draggable: false,
    selectable: false,
    focusable: false,
    data: { node: projection.orchestrator, selected, policyCount: projection.edges.length, onSelect },
    style: { ...graphEngineeringOrchestratorNodeSize, pointerEvents: "all" }
  };
}

function routeSegments(
  edge: GraphEngineeringEdge,
  positions: Map<string, ReturnType<typeof calculateGraphEngineeringLayout>[number]>,
  theme: LoopTheme,
  onSelect: (edge: GraphEngineeringEdge) => void
): GraphRouteSegmentEdge[] {
  const source = positions.get(edge.source);
  const target = positions.get(edge.target);
  const orchestrator = positions.get("loop-orchestrator");
  if (!source || !target || !orchestrator) return [];
  const requestSide = sideFromOrchestrator(source, orchestrator);
  const dispatchSide = sideFromOrchestrator(target, orchestrator);
  const color = edge.activeRoute ? "var(--secondary)" : edge.kind === "repair" ? "var(--tertiary)" : "var(--loop-theme-edge-color)";
  const style = {
    stroke: color,
    strokeWidth: edge.activeRoute ? 2.5 : 1.5,
    strokeDasharray: loopEdgeDasharray(edge.kind === "repair" ? theme.edge.repairStyle : theme.edge.crossLoopStyle)
  };
  const markerEnd = { type: MarkerType.ArrowClosed, color };
  return [{
    id: `${edge.id}:request`, type: "graphRouteSegment", source: edge.source, target: "loop-orchestrator",
    sourceHandle: `${oppositeSide(requestSide)}-source`, targetHandle: `${requestSide}-target`,
    data: { edge, segment: "request", onSelect }, focusable: false, selectable: false, markerEnd, style
  }, {
    id: `${edge.id}:dispatch`, type: "graphRouteSegment", source: "loop-orchestrator", target: edge.target,
    sourceHandle: `${dispatchSide}-source`, targetHandle: `${oppositeSide(dispatchSide)}-target`,
    data: { edge, segment: "dispatch", onSelect }, focusable: false, selectable: false, markerEnd, style
  }];
}

function sideFromOrchestrator(
  node: ReturnType<typeof calculateGraphEngineeringLayout>[number],
  orchestrator: ReturnType<typeof calculateGraphEngineeringLayout>[number]
) {
  if (node.x < orchestrator.x) return "left";
  if (node.x > orchestrator.x) return "right";
  return node.y < orchestrator.y ? "top" : "bottom";
}

const oppositeSide = (side: ReturnType<typeof sideFromOrchestrator>) => ({
  left: "right",
  right: "left",
  top: "bottom",
  bottom: "top"
} as const)[side];
