import { useCallback, useEffect, useMemo, useState } from "react";
import { Position, ReactFlow, type EdgeMouseHandler, type EdgeTypes, type NodeTypes, useUpdateNodeInternals } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { LoopReactFlowNodeComponent } from "./LoopReactFlowNode";
import { LoopSmartEdge } from "./LoopSmartEdge";
import type { LoopCanvasProps, LoopNodeContext, LoopReactFlowEdge, LoopReactFlowNode } from "./LoopCanvasTypes";
import { loopEdgeDomAttributes, loopEdgeStyle } from "./loopEdgeStyle";
import { loopCanvasNodeAnchorY } from "./loopLayout";

const loopNodeTypes = {
  loop: LoopReactFlowNodeComponent
} satisfies NodeTypes;

const loopEdgeTypes = {
  loopSmart: LoopSmartEdge
} satisfies EdgeTypes;

export function LoopCanvas({
  layout,
  canvasHeight,
  isCanvasPanning,
  loopCanvasRef,
  onCanvasMoveStart,
  onCanvasMoveEnd,
  ...nodeContextProps
}: LoopCanvasProps) {
  const nodeContext = useLoopNodeContext(nodeContextProps);
  const nodes = useLoopNodes(layout.nodes, layout.edges, nodeContext);
  const nodeIds = useMemo(() => layout.nodes.map((node) => node.key), [layout.nodes]);
  const [animatedEdgeId, setAnimatedEdgeId] = useState<string | null>(null);
  const edges = useLoopEdges(layout.edges, layout.nodes, nodeContext, animatedEdgeId);
  const handleEdgeClick = useCallback<EdgeMouseHandler<LoopReactFlowEdge>>((event, edge) => {
    event.stopPropagation();
    setAnimatedEdgeId((currentEdgeId) => currentEdgeId === edge.id ? null : edge.id);
  }, []);

  useEffect(() => {
    if (!animatedEdgeId || layout.edges.some((edge) => edge.key === animatedEdgeId)) return;
    setAnimatedEdgeId(null);
  }, [animatedEdgeId, layout.edges]);

  return (
    <div
      ref={loopCanvasRef}
      data-loop-canvas
      className={cn("relative min-h-[28rem] overflow-hidden border border-divider-strong bg-background", isCanvasPanning ? "cursor-grabbing" : "cursor-grab")}
      style={{ height: canvasHeight ? `${canvasHeight}px` : undefined }}
    >
      <div className="pointer-events-none absolute inset-0 z-0 opacity-50 bg-[image:linear-gradient(to_right,var(--divider-strong)_1px,transparent_1px),linear-gradient(to_bottom,var(--divider-strong)_1px,transparent_1px)] bg-[size:24px_24px]" />
      <ReactFlow<LoopReactFlowNode, LoopReactFlowEdge>
        className="loop-react-flow relative z-10 h-full w-full"
        nodes={nodes}
        edges={edges}
        nodeTypes={loopNodeTypes}
        edgeTypes={loopEdgeTypes}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        minZoom={1}
        maxZoom={1}
        nodesDraggable={false}
        nodesConnectable={false}
        edgesReconnectable={false}
        elementsSelectable={false}
        selectNodesOnDrag={false}
        selectionOnDrag={false}
        panOnDrag
        panOnScroll={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        preventScrolling={false}
        deleteKeyCode={null}
        selectionKeyCode={null}
        multiSelectionKeyCode={null}
        proOptions={{ hideAttribution: true }}
        onEdgeClick={handleEdgeClick}
        onMoveStart={onCanvasMoveStart}
        onMoveEnd={onCanvasMoveEnd}
      >
        <LoopNodeInternalsUpdater nodeIds={nodeIds} />
      </ReactFlow>
    </div>
  );
}

function LoopNodeInternalsUpdater({ nodeIds }: { nodeIds: string[] }) {
  const updateNodeInternals = useUpdateNodeInternals();

  useEffect(() => {
    updateNodeInternals(nodeIds);
  }, [nodeIds, updateNodeInternals]);

  return null;
}

function useLoopNodeContext({
  actionById,
  selectedLoopId,
  draggedStepIndex,
  dragOverStepIndex,
  selectedActionStepIndexes,
  canAddFirstAction,
  canAddActionForEvent,
  onStepPointerDown,
  onStepPointerMove,
  onStepPointerUp,
  onStepPointerCancel,
  onActionStepSelect,
  onOutputHandlerSelect,
  onAddActionStep
}: LoopNodeContext) {
  return useMemo<LoopNodeContext>(() => ({
    actionById,
    selectedLoopId,
    draggedStepIndex,
    dragOverStepIndex,
    selectedActionStepIndexes,
    canAddFirstAction,
    canAddActionForEvent,
    onStepPointerDown,
    onStepPointerMove,
    onStepPointerUp,
    onStepPointerCancel,
    onActionStepSelect,
    onOutputHandlerSelect,
    onAddActionStep
  }), [
    actionById,
    canAddFirstAction,
    canAddActionForEvent,
    dragOverStepIndex,
    draggedStepIndex,
    onAddActionStep,
    onActionStepSelect,
    onOutputHandlerSelect,
    onStepPointerCancel,
    onStepPointerDown,
    onStepPointerMove,
    onStepPointerUp,
    selectedLoopId,
    selectedActionStepIndexes
  ]);
}

function useLoopNodes(
  layoutNodes: LoopCanvasProps["layout"]["nodes"],
  layoutEdges: LoopCanvasProps["layout"]["edges"],
  nodeContext: LoopNodeContext
) {
  const activeHandleIdsByNodeKey = useMemo(() => loopActiveHandleIdsByNodeKey(layoutEdges), [layoutEdges]);

  return useMemo<LoopReactFlowNode[]>(() => layoutNodes.map((layoutNode) => ({
    id: layoutNode.key,
    type: "loop",
    position: { x: layoutNode.x, y: layoutNode.y },
    data: {
      layoutNode,
      context: nodeContext,
      activeHandleIds: activeHandleIdsByNodeKey.get(layoutNode.key) ?? []
    },
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
      pointerEvents: "all"
    }
  })), [activeHandleIdsByNodeKey, layoutNodes, nodeContext]);
}

function loopActiveHandleIdsByNodeKey(layoutEdges: LoopCanvasProps["layout"]["edges"]) {
  const activeHandleIdsByNodeKey = new Map<string, Set<string>>();
  const addActiveHandleId = (nodeKey: string, handleId?: string) => {
    if (!handleId) return;
    const activeHandleIds = activeHandleIdsByNodeKey.get(nodeKey) ?? new Set<string>();
    activeHandleIds.add(handleId);
    activeHandleIdsByNodeKey.set(nodeKey, activeHandleIds);
  };

  layoutEdges.forEach((edge) => {
    addActiveHandleId(edge.sourceNodeKey, edge.sourceHandleId);
    addActiveHandleId(edge.targetNodeKey, edge.targetHandleId);
  });

  return new Map([...activeHandleIdsByNodeKey].map(([nodeKey, activeHandleIds]) => [nodeKey, [...activeHandleIds]]));
}

function loopNodeHandles(layoutNode: LoopCanvasProps["layout"]["nodes"][number], activeHandleIds: string[]): LoopReactFlowNode["handles"] {
  const anchorTop = loopCanvasNodeAnchorY(layoutNode);
  const activeHandleIdSet = new Set(activeHandleIds);
  const handles: NonNullable<LoopReactFlowNode["handles"]> = [];

  if (activeHandleIdSet.has("left")) handles.push({ id: "left", type: "target", position: Position.Left, x: 0, y: anchorTop, width: 1, height: 1 });
  if (activeHandleIdSet.has("right")) handles.push({ id: "right", type: "source", position: Position.Right, x: layoutNode.width, y: anchorTop, width: 1, height: 1 });
  if (activeHandleIdSet.has("top")) {
    handles.push({ id: "top", type: "source", position: Position.Top, x: layoutNode.width / 2, y: 0, width: 1, height: 1 });
    handles.push({ id: "top", type: "target", position: Position.Top, x: layoutNode.width / 2, y: 0, width: 1, height: 1 });
  }
  if (activeHandleIdSet.has("bottom")) {
    handles.push({ id: "bottom", type: "source", position: Position.Bottom, x: layoutNode.width / 2, y: layoutNode.height, width: 1, height: 1 });
    handles.push({ id: "bottom", type: "target", position: Position.Bottom, x: layoutNode.width / 2, y: layoutNode.height, width: 1, height: 1 });
  }

  return handles;
}

export function toLoopReactFlowEdges(
  layoutEdges: LoopCanvasProps["layout"]["edges"],
  layoutNodes: LoopCanvasProps["layout"]["nodes"] = [],
  context?: LoopNodeContext,
  animatedEdgeId?: string | null
): LoopReactFlowEdge[] {
  const nodeByKey = new Map(layoutNodes.map((node) => [node.key, node]));

  return layoutEdges.map((loopEdge) => {
    const sourceNode = nodeByKey.get(loopEdge.sourceNodeKey);
    const targetNode = nodeByKey.get(loopEdge.targetNodeKey);
    const isAnimated = loopEdge.key === animatedEdgeId;

    return {
      id: loopEdge.key,
      type: "loopSmart",
      source: loopEdge.sourceNodeKey,
      target: loopEdge.targetNodeKey,
      sourceHandle: loopEdge.sourceHandleId,
      targetHandle: loopEdge.targetHandleId,
      data: {
        loopEdge,
        context,
        sourceNode,
        targetNode
      },
      animated: isAnimated,
      className: isAnimated ? "loop-edge-animated" : undefined,
      style: loopEdgeStyle(loopEdge, targetNode, isAnimated),
      interactionWidth: 16,
      selectable: false,
      focusable: false,
      reconnectable: false,
      domAttributes: loopEdgeDomAttributes(loopEdge, isAnimated)
    };
  });
}

function useLoopEdges(
  layoutEdges: LoopCanvasProps["layout"]["edges"],
  layoutNodes: LoopCanvasProps["layout"]["nodes"],
  context: LoopNodeContext,
  animatedEdgeId: string | null
) {
  return useMemo(() => toLoopReactFlowEdges(layoutEdges, layoutNodes, context, animatedEdgeId), [animatedEdgeId, context, layoutEdges, layoutNodes]);
}
