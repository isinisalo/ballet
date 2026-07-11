import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Position, ReactFlow, type EdgeMouseHandler, type EdgeTypes, type NodeTypes, useUpdateNodeInternals } from "@xyflow/react";
import type { LoopRunDetails, ProjectAutomationConfig, ProjectLoop } from "@shared/api/workspace-contracts";
import { cn } from "@/lib/utils";
import { LoopReactFlowNodeComponent } from "./LoopReactFlowNode";
import { LoopSmartEdge } from "./LoopSmartEdge";
import type { LoopCanvasProps, LoopNodeContext, LoopReactFlowEdge, LoopReactFlowNode } from "./LoopCanvasTypes";
import { loopEdgeDomAttributes, loopEdgeStyle } from "./loopEdgeStyle";
import { calculateCompositeLoopCanvasLayout, loopCanvasNodeAnchorY } from "./loopLayout";
import type { LoopCanvasEdge } from "./loopLayoutEdges";
import { buildLoopVisualProjection } from "./loopVisualProjection";
import { useLoopCanvasInteraction } from "./useLoopCanvasInteraction";

const loopNodeTypes = { loop: LoopReactFlowNodeComponent } satisfies NodeTypes;
const loopEdgeTypes = { loopSmart: LoopSmartEdge } satisfies EdgeTypes;

export function LoopCanvas({
  config,
  loop,
  run,
  selectedStepId,
  readOnly = false,
  canvasControls,
  onStepSelect,
  onTransitionSelect,
  onInsertStep,
  onReorderStep
}: {
  config: ProjectAutomationConfig;
  loop: ProjectLoop;
  run?: LoopRunDetails | null;
  selectedStepId?: string;
  readOnly?: boolean;
  canvasControls?: ReactNode;
  onStepSelect?: (stepId: string) => void;
  onTransitionSelect?: (stepId: string, result: "approved" | "rejected") => void;
  onInsertStep?: (stepId: string, result: "approved" | "rejected") => void;
  onReorderStep?: (fromIndex: number, toIndex: number) => void;
}) {
  const projection = useMemo(() => buildLoopVisualProjection(config, loop, run), [config, loop, run]);
  const layout = useMemo(() => calculateCompositeLoopCanvasLayout({
    config: projection.config,
    selectedLoopId: loop.id,
    recordsByLoopId: projection.recordsByLoopId,
    direction: "horizontal"
  }), [loop.id, projection]);
  const interaction = useLoopCanvasInteraction({
    selectedId: loop.id,
    reorderStep: (_loopId, fromIndex, toIndex) => onReorderStep?.(fromIndex, toIndex)
  });
  const selectedIndexes = loop.steps.flatMap((step, index) => step.id === selectedStepId ? [index] : []);
  const activeEdgeId = useMemo(() => activeRunEdgeId(layout.edges, loop, run), [layout.edges, loop, run]);

  const selectTransition = (edge: LoopCanvasEdge) => {
    const index = edge.route?.sourceStepIndex;
    const result = edge.route?.outputId;
    const step = index === undefined ? undefined : loop.steps[index];
    if (step && (result === "approved" || result === "rejected")) onTransitionSelect?.(step.id, result);
  };

  return (
    <div className="relative min-w-0">
      <LoopCanvasSurface
        layout={layout}
        selectedLoopId={loop.id}
        stepByKey={projection.stepByKey}
        draggedStepIndex={interaction.draggedStepIndex}
        dragOverStepIndex={interaction.dragOverStepIndex}
        selectedStepIndexes={selectedIndexes}
        readOnly={readOnly}
        canvasHeight={interaction.canvasHeight}
        isCanvasPanning={interaction.isCanvasPanning}
        loopCanvasRef={interaction.loopCanvasRef}
        canAddFirstStep={false}
        canAddStepForEvent={() => !readOnly && Boolean(onInsertStep)}
        onStepPointerDown={interaction.handleStepPointerDown}
        onStepPointerMove={interaction.handleStepPointerMove}
        onStepPointerUp={interaction.handleStepPointerUp}
        onStepPointerCancel={interaction.resetStepDrag}
        onCanvasMoveStart={interaction.handleCanvasMoveStart}
        onCanvasMoveEnd={interaction.handleCanvasMoveEnd}
        onStepSelect={(records) => {
          const stepId = records[0]?.step?.displayId;
          if (stepId) onStepSelect?.(stepId);
        }}
        onOutputHandlerSelect={selectTransition}
        onAddStep={(outputId, sourceStep) => {
          if (!sourceStep || (outputId !== "approved" && outputId !== "rejected")) return;
          onInsertStep?.(sourceStep.displayId, outputId);
        }}
        activeEdgeId={activeEdgeId}
      />
      {canvasControls ? <div data-loop-canvas-controls className="absolute top-3 right-3 z-30">{canvasControls}</div> : null}
    </div>
  );
}

function activeRunEdgeId(edges: LoopCanvasEdge[], loop: ProjectLoop, run?: LoopRunDetails | null) {
  const latestWithResult = [...(run?.stepRuns ?? [])].reverse().find((stepRun) => stepRun.result);
  if (!latestWithResult?.result) return null;
  const sourceStepIndex = loop.steps.findIndex((step) => step.id === latestWithResult.stepId);
  return edges.find((edge) => edge.route?.sourceStepIndex === sourceStepIndex && edge.route?.outputId === latestWithResult.result)?.key ?? null;
}

function LoopCanvasSurface({
  layout,
  canvasHeight,
  isCanvasPanning,
  loopCanvasRef,
  onCanvasMoveStart,
  onCanvasMoveEnd,
  activeEdgeId,
  ...nodeContextProps
}: LoopCanvasProps & { activeEdgeId?: string | null }) {
  const nodeContext = useLoopNodeContext(nodeContextProps);
  const nodes = useLoopNodes(layout.nodes, layout.edges, nodeContext);
  const nodeIds = useMemo(() => layout.nodes.map((node) => node.key), [layout.nodes]);
  const [animatedEdgeId, setAnimatedEdgeId] = useState<string | null>(activeEdgeId ?? null);
  const edges = useLoopEdges(layout.edges, layout.nodes, nodeContext, animatedEdgeId);
  const handleEdgeClick = useCallback<EdgeMouseHandler<LoopReactFlowEdge>>((event, edge) => {
    event.stopPropagation();
    if (edge.data?.loopEdge) nodeContext.onOutputHandlerSelect(edge.data.loopEdge);
    if (!nodeContext.readOnly) setAnimatedEdgeId((current) => current === edge.id ? null : edge.id);
  }, [nodeContext]);

  useEffect(() => setAnimatedEdgeId(activeEdgeId ?? null), [activeEdgeId]);
  useEffect(() => {
    if (!animatedEdgeId || layout.edges.some((edge) => edge.key === animatedEdgeId)) return;
    setAnimatedEdgeId(null);
  }, [animatedEdgeId, layout.edges]);

  return (
    <div
      ref={loopCanvasRef}
      data-loop-canvas
      aria-label={`${nodeContext.readOnly ? "Run" : "Edit"} loop canvas`}
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
  useEffect(() => updateNodeInternals(nodeIds), [nodeIds, updateNodeInternals]);
  return null;
}

function useLoopNodeContext(props: LoopNodeContext) {
  return useMemo(() => props, [props]);
}

function useLoopNodes(layoutNodes: LoopCanvasProps["layout"]["nodes"], layoutEdges: LoopCanvasProps["layout"]["edges"], nodeContext: LoopNodeContext) {
  const activeHandleIdsByNodeKey = useMemo(() => loopActiveHandleIdsByNodeKey(layoutEdges), [layoutEdges]);
  return useMemo<LoopReactFlowNode[]>(() => layoutNodes.map((layoutNode) => ({
    id: layoutNode.key,
    type: "loop",
    position: { x: layoutNode.x, y: layoutNode.y },
    data: { layoutNode, context: nodeContext, activeHandleIds: activeHandleIdsByNodeKey.get(layoutNode.key) ?? [] },
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
    style: { width: layoutNode.width, height: layoutNode.height, pointerEvents: "all" }
  })), [activeHandleIdsByNodeKey, layoutNodes, nodeContext]);
}

function loopActiveHandleIdsByNodeKey(layoutEdges: LoopCanvasProps["layout"]["edges"]) {
  const values = new Map<string, Set<string>>();
  const add = (nodeKey: string, handleId?: string) => {
    if (!handleId) return;
    const ids = values.get(nodeKey) ?? new Set<string>();
    ids.add(handleId);
    values.set(nodeKey, ids);
  };
  layoutEdges.forEach((edge) => {
    add(edge.sourceNodeKey, edge.sourceHandleId);
    add(edge.targetNodeKey, edge.targetHandleId);
  });
  return new Map([...values].map(([key, ids]) => [key, [...ids]]));
}

function loopNodeHandles(layoutNode: LoopCanvasProps["layout"]["nodes"][number], activeHandleIds: string[]): LoopReactFlowNode["handles"] {
  const anchorTop = loopCanvasNodeAnchorY(layoutNode);
  const ids = new Set(activeHandleIds);
  const handles: NonNullable<LoopReactFlowNode["handles"]> = [];
  if (ids.has("left")) handles.push({ id: "left", type: "target", position: Position.Left, x: 0, y: anchorTop, width: 1, height: 1 });
  if (ids.has("right")) handles.push({ id: "right", type: "source", position: Position.Right, x: layoutNode.width, y: anchorTop, width: 1, height: 1 });
  if (ids.has("top")) {
    handles.push({ id: "top", type: "source", position: Position.Top, x: layoutNode.width / 2, y: 0, width: 1, height: 1 });
    handles.push({ id: "top", type: "target", position: Position.Top, x: layoutNode.width / 2, y: 0, width: 1, height: 1 });
  }
  if (ids.has("bottom")) {
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
      data: { loopEdge, context, sourceNode, targetNode },
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

function useLoopEdges(layoutEdges: LoopCanvasProps["layout"]["edges"], layoutNodes: LoopCanvasProps["layout"]["nodes"], context: LoopNodeContext, animatedEdgeId: string | null) {
  return useMemo(() => toLoopReactFlowEdges(layoutEdges, layoutNodes, context, animatedEdgeId), [animatedEdgeId, context, layoutEdges, layoutNodes]);
}
