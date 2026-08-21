import { useMemo } from "react";
import { Controls, MarkerType, ReactFlow, type EdgeTypes, type NodeTypes } from "@xyflow/react";
import type { LoopTheme } from "@shared/api/workspace-contracts";
import {
  calculateGraphEngineeringLayout,
  graphEngineeringDoneNodeSize,
  graphEngineeringLoopNodeSize,
  graphEngineeringOrchestratorNodeSize
} from "./graphEngineeringLayout";
import {
  GraphEngineeringDoneNodeView,
  GraphEngineeringLoopNodeView,
  GraphEngineeringOrchestratorNodeView,
  GraphEngineeringRouteView,
  type GraphDoneFlowNode,
  type GraphFlowNode,
  type GraphLoopFlowNode,
  type GraphOrchestratorFlowNode,
  type GraphRouteData,
  type GraphRouteEdge
} from "./GraphEngineeringElements";
import { buildGraphEngineeringFocus } from "./engineeringProjections";
import type { GraphEngineeringEdge, GraphEngineeringProjection } from "./engineeringProjections";
import { loopThemeCssProperties } from "./loopTheme";

const nodeTypes = {
  graphLoop: GraphEngineeringLoopNodeView,
  graphOrchestrator: GraphEngineeringOrchestratorNodeView,
  graphDone: GraphEngineeringDoneNodeView
} satisfies NodeTypes;
const edgeTypes = { graphRoute: GraphEngineeringRouteView } satisfies EdgeTypes;

export function GraphEngineeringCanvas({
  projection,
  narrow,
  selectedLoopId,
  orchestratorSelected,
  theme,
  onSelectLoop,
  onOpenLoop,
  onSelectEdge,
  onSelectOrchestrator
}: {
  projection: GraphEngineeringProjection;
  narrow: boolean;
  selectedLoopId?: string;
  orchestratorSelected: boolean;
  theme: LoopTheme;
  onSelectLoop: (loopId: string) => void;
  onOpenLoop: (loopId: string) => void;
  onSelectEdge: (edge: GraphEngineeringEdge) => void;
  onSelectOrchestrator: () => void;
}) {
  const focus = useMemo(() => buildGraphEngineeringFocus(projection), [projection]);
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
          transitionCount: projection.edges.filter((edge) => edge.kind === "transition" && edge.source === node.loopId).length,
          repairCount: projection.edges.filter((edge) => edge.kind === "repair" && edge.source === node.loopId).length,
          onSelect: onSelectLoop,
          onOpen: onOpenLoop
        },
        style: { ...graphEngineeringLoopNodeSize, pointerEvents: "all" }
      };
    }),
    ...(projection.done ? [doneFlowNode(positions)] : [])
  ], [onOpenLoop, onSelectLoop, onSelectOrchestrator, orchestratorSelected, positions, projection, selectedLoopId]);
  const routeLanes = useMemo(() => graphRouteLanes(focus.edges, positions), [focus.edges, positions]);
  const edges = useMemo<GraphRouteEdge[]>(
    () => focus.edges.flatMap((edge) => routeFlowEdge(edge, positions, routeLanes.get(edge.id), onSelectEdge)),
    [focus.edges, onSelectEdge, positions, routeLanes]
  );
  const fitNodes = narrow ? narrowInitialNodes(nodes, projection) : undefined;
  return <GraphEngineeringSurface
    projection={projection} focus={focus} nodes={nodes} edges={edges} fitNodes={fitNodes}
    narrow={narrow} theme={theme} onSelectEdge={onSelectEdge}
  />;
}

function GraphEngineeringSurface({ projection, focus, nodes, edges, fitNodes, narrow, theme, onSelectEdge }: {
  projection: GraphEngineeringProjection;
  focus: ReturnType<typeof buildGraphEngineeringFocus>;
  nodes: GraphFlowNode[];
  edges: GraphRouteEdge[];
  fitNodes?: GraphFlowNode[];
  narrow: boolean;
  theme: LoopTheme;
  onSelectEdge: (edge: GraphEngineeringEdge) => void;
}) {
  return <div
    data-loop-canvas
    data-engineering-view="graph"
    aria-label={`Graph Engineering canvas; one RunBook Orchestrator control, ${projection.nodes.length} Loops, ${focus.transitionCount} named transitions, ${focus.repairCount} repair routes${projection.done ? ", and DONE terminal" : ""}`}
    className="relative h-full min-h-[34rem] min-w-0 overflow-hidden border border-divider-strong bg-background"
    style={loopThemeCssProperties(theme)}
  >
    <div className="pointer-events-none absolute inset-0 opacity-35 bg-[image:linear-gradient(to_right,var(--divider-strong)_1px,transparent_1px),linear-gradient(to_bottom,var(--divider-strong)_1px,transparent_1px)] bg-[size:24px_24px]" />
    <div className="pointer-events-none absolute top-2 left-2 z-20 rounded border border-divider-strong bg-card/95 px-2 py-1 font-mono text-[0.62rem] text-muted-foreground">
      <span className="text-foreground">{projection.graphName}</span> · start {projection.startLoopId} · {focus.transitionCount} transitions · {focus.repairCount} repairs
    </div>
    <div aria-label="Graph RunBook transitions">
      {focus.edges.map((edge) => <button
        key={edge.id}
        type="button"
        className="sr-only focus:not-sr-only focus:absolute focus:top-14 focus:left-2 focus:z-30 focus:rounded focus:border focus:border-primary focus:bg-background focus:px-2 focus:py-1 focus:font-mono focus:text-xs"
        aria-label={edge.kind === "transition"
          ? `${edge.decision} outcome ${edge.outcome}, ${edge.source} to ${edge.targetId}`
          : `Repair capability ${edge.capability}, ${edge.source} to ${edge.target}`}
        onClick={() => onSelectEdge(edge)}
      >{edge.kind === "transition" ? `${edge.decision} · ${edge.outcome}` : `REPAIR · ${edge.capability}`}</button>)}
    </div>
    <ReactFlow<GraphFlowNode, GraphRouteEdge>
      key={narrow ? "narrow" : "wide"}
      className="loop-react-flow relative z-10 h-full min-h-[34rem] w-full"
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitView
      fitViewOptions={{ padding: 0.08, minZoom: 0.7, maxZoom: 1, nodes: fitNodes }}
      minZoom={0.25}
      maxZoom={1.5}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      panOnScroll
      zoomOnScroll={false}
      zoomOnPinch
      zoomOnDoubleClick={false}
      preventScrolling
      deleteKeyCode={null}
      proOptions={{ hideAttribution: true }}
      onEdgeClick={(event, selected) => {
        event.stopPropagation();
        if (selected.data?.edge) onSelectEdge(selected.data.edge);
      }}
    >
      <Controls showInteractive={false} position="bottom-left" />
    </ReactFlow>
  </div>;
}

function narrowInitialNodes(
  nodes: GraphFlowNode[],
  projection: GraphEngineeringProjection
): GraphFlowNode[] {
  const visible = new Set([
    projection.orchestrator.id,
    projection.startLoopId,
    ...projection.edges.flatMap((edge) => edge.kind === "transition"
      && edge.source === projection.startLoopId
      && edge.targetId !== "graph-done" ? [edge.targetId] : [])
  ]);
  return nodes.filter((node) => visible.has(node.id));
}

function routeFlowEdge(
  edge: GraphEngineeringEdge,
  positions: Map<string, ReturnType<typeof calculateGraphEngineeringLayout>[number]>,
  lane: GraphRouteData["lane"],
  onSelect: (edge: GraphEngineeringEdge) => void
): GraphRouteEdge[] {
  const source = positions.get(edge.source);
  const target = positions.get(edge.targetId);
  if (!source || !target) return [];
  const forward = edge.kind === "transition" && source.rank < target.rank;
  const color = edge.kind === "repair"
    ? "var(--tertiary)"
    : edge.decision === "PASS" ? "var(--secondary)" : "var(--error)";
  const self = edge.source === edge.targetId;
  const negativeSelf = self && lane?.side !== "positive";
  return [{
    id: edge.id,
    type: "graphRoute",
    source: edge.source,
    target: edge.targetId,
    sourceHandle: self ? negativeSelf ? "left-source" : "right-source" : forward ? "right-source" : "left-source",
    targetHandle: self ? negativeSelf ? "top-target" : "bottom-target" : forward ? "left-target" : "right-target",
    data: { edge, pathKind: forward ? "straight" : "smoothstep", lane, onSelect },
    focusable: false,
    selectable: false,
    markerEnd: { type: MarkerType.ArrowClosed, color },
    style: {
      stroke: color,
      strokeWidth: edge.activeRoute ? 2.5 : 1.5,
      strokeDasharray: edge.kind === "repair" ? "6 5" : undefined
    }
  }];
}

function graphRouteLanes(
  edges: GraphEngineeringEdge[],
  positions: Map<string, ReturnType<typeof calculateGraphEngineeringLayout>[number]>
): Map<string, NonNullable<GraphRouteData["lane"]>> {
  const detours = edges.filter((edge) => {
    const source = positions.get(edge.source);
    const target = positions.get(edge.targetId);
    return edge.kind === "repair" || !source || !target || source.rank >= target.rank;
  }).sort((left, right) => left.id.localeCompare(right.id));
  const lanes = new Map<string, NonNullable<GraphRouteData["lane"]>>();
  assignRouteLanes(detours.filter((edge) => edge.source === edge.targetId), lanes);
  assignRouteLanes(detours.filter((edge) => edge.source !== edge.targetId), lanes);
  return lanes;
}

function assignRouteLanes(
  edges: GraphEngineeringEdge[],
  target: Map<string, NonNullable<GraphRouteData["lane"]>>
) {
  edges.forEach((edge, index) => target.set(edge.id, {
    side: index % 2 === 0 ? "negative" : "positive",
    depth: Math.floor(index / 2)
  }));
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
    data: {
      node: projection.orchestrator,
      selected,
      transitionCount: projection.edges.filter((edge) => edge.kind === "transition").length,
      repairCount: projection.edges.filter((edge) => edge.kind === "repair").length,
      graphName: projection.graphName,
      onSelect
    },
    style: { ...graphEngineeringOrchestratorNodeSize, pointerEvents: "all" }
  };
}

function doneFlowNode(
  positions: Map<string, ReturnType<typeof calculateGraphEngineeringLayout>[number]>
): GraphDoneFlowNode {
  const position = positions.get("graph-done");
  if (!position) throw new Error("Missing Graph Engineering DONE terminal.");
  return {
    id: "graph-done",
    type: "graphDone",
    position: { x: position.x, y: position.y },
    width: graphEngineeringDoneNodeSize.width,
    height: graphEngineeringDoneNodeSize.height,
    initialWidth: graphEngineeringDoneNodeSize.width,
    initialHeight: graphEngineeringDoneNodeSize.height,
    measured: graphEngineeringDoneNodeSize,
    draggable: false,
    selectable: false,
    focusable: false,
    data: { label: "DONE" },
    style: { ...graphEngineeringDoneNodeSize, pointerEvents: "none" }
  };
}
