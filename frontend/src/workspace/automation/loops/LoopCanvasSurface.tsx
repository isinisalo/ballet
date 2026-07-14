import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  type EdgeMouseHandler,
  type EdgeTypes,
  type NodeTypes,
  useUpdateNodeInternals
} from "@xyflow/react";
import { cn } from "@/lib/utils";
import { LoopReactFlowNodeComponent } from "./LoopReactFlowNode";
import { LoopSmartEdge } from "./LoopSmartEdge";
import type {
  LoopCanvasProps,
  LoopNodeContext,
  LoopReactFlowEdge,
  LoopReactFlowNode
} from "./LoopCanvasTypes";
import { loopThemeCssProperties } from "./loopTheme";
import {
  loopActiveHandleIdsByNodeKey,
  loopNodeHandles,
  toLoopReactFlowEdges
} from "./loopReactFlowElements";

const loopNodeTypes = { loop: LoopReactFlowNodeComponent } satisfies NodeTypes;
const loopEdgeTypes = { loopSmart: LoopSmartEdge } satisfies EdgeTypes;

export function LoopCanvasSurface({
  layout,
  canvasHeight,
  isCanvasPanning,
  loopCanvasRef,
  onCanvasMoveStart,
  onCanvasMoveEnd,
  activeEdgeId,
  ...nodeContextProps
}: LoopCanvasProps & { activeEdgeId?: string | null }) {
  const nodeContext = useMemo(() => nodeContextProps, [nodeContextProps]);
  const nodes = useLoopNodes(layout.nodes, layout.edges, nodeContext);
  const nodeIds = useMemo(() => layout.nodes.map((node) => node.key), [layout.nodes]);
  const [animatedEdgeId, setAnimatedEdgeId] = useState<string | null>(activeEdgeId ?? null);
  const renderedAnimatedEdgeId = nodeContext.staticPreview ? null : animatedEdgeId;
  const edges = useMemo(
    () => toLoopReactFlowEdges(layout.edges, layout.nodes, nodeContext, renderedAnimatedEdgeId),
    [layout.edges, layout.nodes, nodeContext, renderedAnimatedEdgeId]
  );
  const handleEdgeClick = useCallback<EdgeMouseHandler<LoopReactFlowEdge>>((event, edge) => {
    if (nodeContext.staticPreview) return;
    event.stopPropagation();
    if (edge.data?.loopEdge) nodeContext.onOutputHandlerSelect(edge.data.loopEdge);
    if (!nodeContext.readOnly) setAnimatedEdgeId((current) => current === edge.id ? null : edge.id);
  }, [nodeContext]);

  useEffect(() => setAnimatedEdgeId(activeEdgeId ?? null), [activeEdgeId]);
  useEffect(() => {
    if (!animatedEdgeId || layout.edges.some((edge) => edge.key === animatedEdgeId)) return;
    setAnimatedEdgeId(null);
  }, [animatedEdgeId, layout.edges]);

  const label = nodeContext.staticPreview
    ? "Theme preview loop canvas"
    : `${nodeContext.readOnly ? "Run" : "Edit"} loop canvas`;

  return (
    <div
      ref={loopCanvasRef}
      data-loop-canvas
      data-loop-theme="project"
      data-loop-canvas-preview={nodeContext.staticPreview ? "true" : undefined}
      aria-label={label}
      className={cn(
        "relative overflow-hidden border border-divider-strong bg-background",
        nodeContext.staticPreview ? "cursor-default" : "min-h-[28rem]",
        !nodeContext.staticPreview && (isCanvasPanning ? "cursor-grabbing" : "cursor-grab")
      )}
      style={{
        ...loopThemeCssProperties(nodeContext.theme),
        height: canvasHeight ? `${canvasHeight}px` : undefined
      }}
    >
      <div className="pointer-events-none absolute inset-0 z-0 opacity-50 bg-[image:linear-gradient(to_right,var(--divider-strong)_1px,transparent_1px),linear-gradient(to_bottom,var(--divider-strong)_1px,transparent_1px)] bg-[size:24px_24px]" />
      <ReactFlow<LoopReactFlowNode, LoopReactFlowEdge>
        className={cn(
          "loop-react-flow relative z-10 h-full",
          nodeContext.staticPreview ? "mx-2 w-[calc(100%-1rem)]" : "w-full"
        )}
        nodes={nodes}
        edges={edges}
        nodeTypes={loopNodeTypes}
        edgeTypes={loopEdgeTypes}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        fitView={nodeContext.staticPreview}
        fitViewOptions={nodeContext.staticPreview ? { padding: 0.3, minZoom: 0.2, maxZoom: 1 } : undefined}
        minZoom={nodeContext.staticPreview ? 0.2 : 1}
        maxZoom={1}
        nodesDraggable={false}
        nodesConnectable={false}
        edgesReconnectable={false}
        elementsSelectable={false}
        selectNodesOnDrag={false}
        selectionOnDrag={false}
        panOnDrag={!nodeContext.staticPreview}
        panOnScroll={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        preventScrolling={false}
        deleteKeyCode={null}
        selectionKeyCode={null}
        multiSelectionKeyCode={null}
        proOptions={{ hideAttribution: true }}
        onEdgeClick={nodeContext.staticPreview ? undefined : handleEdgeClick}
        onMoveStart={nodeContext.staticPreview ? undefined : onCanvasMoveStart}
        onMoveEnd={nodeContext.staticPreview ? undefined : onCanvasMoveEnd}
      >
        <LoopNodeInternalsUpdater nodeIds={nodeIds} />
      </ReactFlow>
    </div>
  );
}

function LoopNodeInternalsUpdater({ nodeIds }: { nodeIds: string[] }) {
  const updateNodeInternals = useUpdateNodeInternals();
  useEffect(() => updateNodeInternals(nodeIds), [nodeIds, updateNodeInternals]);
  return null;
}

function useLoopNodes(
  layoutNodes: LoopCanvasProps["layout"]["nodes"],
  layoutEdges: LoopCanvasProps["layout"]["edges"],
  context: LoopNodeContext
) {
  const activeHandleIdsByNodeKey = useMemo(() => loopActiveHandleIdsByNodeKey(layoutEdges), [layoutEdges]);
  return useMemo<LoopReactFlowNode[]>(() => layoutNodes.map((layoutNode) => ({
    id: layoutNode.key,
    type: "loop",
    position: { x: layoutNode.x, y: layoutNode.y },
    data: { layoutNode, context, activeHandleIds: activeHandleIdsByNodeKey.get(layoutNode.key) ?? [] },
    width: layoutNode.width,
    height: layoutNode.height,
    initialWidth: layoutNode.width,
    initialHeight: layoutNode.height,
    measured: { width: layoutNode.width, height: layoutNode.height },
    handles: loopNodeHandles(layoutNode, activeHandleIdsByNodeKey.get(layoutNode.key) ?? []),
    draggable: false,
    selectable: false,
    connectable: false,
    focusable: false,
    style: {
      width: layoutNode.width,
      height: layoutNode.height,
      pointerEvents: context.staticPreview ? "none" : "all"
    }
  })), [activeHandleIdsByNodeKey, context, layoutNodes]);
}
