import { useCallback, useMemo } from "react";
import { Background, Controls, ReactFlow, ReactFlowProvider, type Edge, type EdgeTypes, type NodeTypes } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { EnvironmentDefinition } from "@shared/orchestration/environment";
import {
  orchestrationActionAgentPath, orchestrationActionPath, orchestrationCreateActionPath,
  orchestrationCreateStatePath, orchestrationStatePath,
} from "@/workspace/routing";
import { LoopEngineeringNodeView, type LoopFlowNode } from "./LoopEngineeringNodes";
import { FloatingSmoothEdge } from "./FloatingSmoothEdge";
import { projectLoopEngineering, type LoopEngineeringNode } from "./loopEngineeringProjection";
import { useCanvasSurfaceSize } from "./useCanvasSurfaceSize";
import "./LoopEngineeringCanvas.css";

const nodeTypes = { loopNode: LoopEngineeringNodeView } satisfies NodeTypes;
const edgeTypes = { "floating-smooth": FloatingSmoothEdge } satisfies EdgeTypes;

export function LoopEngineeringCanvas({ environment, selectedStateId, selectedActionId, selectedAgentRole, locked, navigate }: {
  environment: EnvironmentDefinition;
  selectedStateId?: string;
  selectedActionId?: string;
  selectedAgentRole?: "validation" | "work";
  locked?: boolean;
  navigate(path: string): void;
}) {
  const [surfaceRef, surface] = useCanvasSurfaceSize();
  const projection = useMemo(() => projectLoopEngineering(
    environment, selectedStateId, selectedActionId, surface, { locked, selectedAgentRole },
  ), [environment, locked, selectedActionId, selectedAgentRole, selectedStateId, surface]);
  const activate = useCallback((item: LoopEngineeringNode) => {
    if (item.kind === "state" && item.entityId) navigate(orchestrationStatePath(item.entityId));
    else if (item.kind === "create-state") navigate(orchestrationCreateStatePath());
    else if (item.kind === "action" && selectedStateId && item.entityId) navigate(orchestrationActionPath(selectedStateId, item.entityId));
    else if (item.kind === "create-action" && selectedStateId) navigate(orchestrationCreateActionPath(selectedStateId));
    else if (item.kind === "validation-agent" && selectedStateId && selectedActionId) navigate(orchestrationActionAgentPath(selectedStateId, selectedActionId, "validation"));
    else if (item.kind === "work-agent" && selectedStateId && selectedActionId) navigate(orchestrationActionAgentPath(selectedStateId, selectedActionId, "work"));
  }, [navigate, selectedActionId, selectedStateId]);
  const nodes = useMemo<LoopFlowNode[]>(() => projection.nodes.map((item) => ({
    id: item.id,
    type: "loopNode",
    position: { x: item.x, y: item.y },
    width: item.width,
    height: item.height,
    initialWidth: item.width,
    initialHeight: item.height,
    measured: { width: item.width, height: item.height },
    draggable: false,
    selectable: false,
    focusable: false,
    data: { item, onActivate: activate },
    style: { width: item.width, height: item.height, pointerEvents: "all" },
  })), [activate, projection.nodes]);
  const edges = useMemo<Edge[]>(() => projection.edges.map((edge) => ({
    ...edge,
    type: edge.routing,
    focusable: false,
    selectable: false,
    className: `loop-engineering-flow-edge loop-engineering-flow-edge--${edge.tone}`,
  })), [projection.edges]);
  const layoutKey = nodes.map(({ id }) => id).join("|");
  return <section className="loop-engineering-canvas" aria-label={`Loop Engineering canvas for Environment ${environment.id}`}>
    <div className="loop-engineering-legend">ENVIRONMENT <span>{environment.id} · ordered authoring projection</span></div>
    <div className="loop-engineering-levels" aria-hidden="true"><span>STATE</span><span>ACTION</span><span>AGENTS</span></div>
    <div ref={surfaceRef} className="loop-engineering-surface">
      <div className="loop-engineering-flow-frame">
        <ReactFlowProvider>
          {surface.width > 0 && surface.height > 0 ? <ReactFlow<LoopFlowNode, Edge>
          key={layoutKey}
          aria-label="STATE to ACTION to AGENTS authoring tree"
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.12, minZoom: 0.8, maxZoom: 1 }}
          minZoom={0.8}
          maxZoom={1.5}
          nodesDraggable={false}
          nodesConnectable={false}
          nodesFocusable={false}
          edgesFocusable={false}
          elementsSelectable={false}
          panOnScroll
          zoomOnScroll={false}
          zoomOnDoubleClick={false}
          deleteKeyCode={null}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={24} size={1} color="var(--border)" />
          <Controls showInteractive={false} position="bottom-left" aria-label="Loop canvas controls" />
          </ReactFlow> : null}
        </ReactFlowProvider>
      </div>
    </div>
    <p className="loop-engineering-caption">Authoring order only · runtime status remains in Run.</p>
  </section>;
}
