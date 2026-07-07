import { useCallback, useEffect, useMemo, useState } from "react";
import { Position, ReactFlow, type EdgeMouseHandler, type EdgeTypes, type NodeTypes, useUpdateNodeInternals } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { WorkflowReactFlowNodeComponent } from "./WorkflowReactFlowNode";
import { WorkflowSmartEdge } from "./WorkflowSmartEdge";
import type { WorkflowCanvasProps, WorkflowNodeContext, WorkflowReactFlowEdge, WorkflowReactFlowNode } from "./WorkflowCanvasTypes";
import { workflowCanvasNodeAnchorY } from "./workflowLayout";

const workflowNodeTypes = {
  workflow: WorkflowReactFlowNodeComponent
} satisfies NodeTypes;

const workflowEdgeTypes = {
  workflowSmart: WorkflowSmartEdge
} satisfies EdgeTypes;

const workflowSolidEdgeStroke = "color-mix(in srgb, var(--primary) 70%, transparent)";
const workflowDashedEdgeStroke = "color-mix(in srgb, var(--muted-foreground) 35%, transparent)";
const workflowReturnEdgeStroke = "color-mix(in srgb, var(--tertiary) 85%, transparent)";

function workflowEdgeDomAttributes(edge: WorkflowCanvasProps["layout"]["edges"][number], isAnimated = false): WorkflowReactFlowEdge["domAttributes"] {
  return {
    "data-workflow-connector": "true",
    "data-dashed": edge.dashed && edge.tone !== "return" ? "true" : "false",
    "data-workflow-edge-tone": edge.tone ?? "flow",
    "data-workflow-edge-animated": isAnimated ? "true" : "false",
    ...(edge.label ? { "data-workflow-edge-label-value": edge.label } : {})
  } as WorkflowReactFlowEdge["domAttributes"];
}

function workflowEdgeStroke(edge: WorkflowCanvasProps["layout"]["edges"][number]) {
  if (edge.tone === "return") return workflowReturnEdgeStroke;
  return edge.dashed ? workflowDashedEdgeStroke : workflowSolidEdgeStroke;
}

function workflowEdgeStrokeDasharray(edge: WorkflowCanvasProps["layout"]["edges"][number]) {
  return edge.dashed && edge.tone !== "return" ? "6 5" : undefined;
}

export function WorkflowCanvas({
  layout,
  canvasHeight,
  isCanvasPanning,
  workflowCanvasRef,
  onCanvasMoveStart,
  onCanvasMoveEnd,
  ...nodeContextProps
}: WorkflowCanvasProps) {
  const nodeContext = useWorkflowNodeContext(nodeContextProps);
  const nodes = useWorkflowNodes(layout.nodes, layout.edges, nodeContext);
  const nodeIds = useMemo(() => layout.nodes.map((node) => node.key), [layout.nodes]);
  const [animatedEdgeId, setAnimatedEdgeId] = useState<string | null>(null);
  const edges = useWorkflowEdges(layout.edges, layout.nodes, nodeContext, animatedEdgeId);
  const handleEdgeClick = useCallback<EdgeMouseHandler<WorkflowReactFlowEdge>>((event, edge) => {
    event.stopPropagation();
    setAnimatedEdgeId((currentEdgeId) => currentEdgeId === edge.id ? null : edge.id);
  }, []);

  useEffect(() => {
    if (!animatedEdgeId || layout.edges.some((edge) => edge.key === animatedEdgeId)) return;
    setAnimatedEdgeId(null);
  }, [animatedEdgeId, layout.edges]);

  return (
    <div
      ref={workflowCanvasRef}
      data-workflow-canvas
      className={cn("relative min-h-[28rem] overflow-hidden border border-divider-strong bg-background", isCanvasPanning ? "cursor-grabbing" : "cursor-grab")}
      style={{ height: canvasHeight ? `${canvasHeight}px` : undefined }}
    >
      <div className="pointer-events-none absolute inset-0 z-0 opacity-50 bg-[image:linear-gradient(to_right,var(--divider-strong)_1px,transparent_1px),linear-gradient(to_bottom,var(--divider-strong)_1px,transparent_1px)] bg-[size:24px_24px]" />
      <ReactFlow<WorkflowReactFlowNode, WorkflowReactFlowEdge>
        className="workflow-react-flow relative z-10 h-full w-full"
        nodes={nodes}
        edges={edges}
        nodeTypes={workflowNodeTypes}
        edgeTypes={workflowEdgeTypes}
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
        <WorkflowNodeInternalsUpdater nodeIds={nodeIds} />
      </ReactFlow>
    </div>
  );
}

function WorkflowNodeInternalsUpdater({ nodeIds }: { nodeIds: string[] }) {
  const updateNodeInternals = useUpdateNodeInternals();

  useEffect(() => {
    updateNodeInternals(nodeIds);
  }, [nodeIds, updateNodeInternals]);

  return null;
}

function useWorkflowNodeContext({
  policyById,
  firstPolicy,
  noSelectionValue,
  policyOptions,
  actionOptions,
  draggedStepIndex,
  dragOverStepIndex,
  selectedActionStepIndexes,
  canAddFirstPolicy,
  canAddPolicyForEvent,
  onStepPointerDown,
  onStepPointerMove,
  onStepPointerUp,
  onStepPointerCancel,
  onPolicyChange,
  onActionStepSelect,
  onOutputHandlerSelect,
  onAddPolicyStep
}: WorkflowNodeContext) {
  return useMemo<WorkflowNodeContext>(() => ({
    policyById,
    firstPolicy,
    noSelectionValue,
    policyOptions,
    actionOptions,
    draggedStepIndex,
    dragOverStepIndex,
    selectedActionStepIndexes,
    canAddFirstPolicy,
    canAddPolicyForEvent,
    onStepPointerDown,
    onStepPointerMove,
    onStepPointerUp,
    onStepPointerCancel,
    onPolicyChange,
    onActionStepSelect,
    onOutputHandlerSelect,
    onAddPolicyStep
  }), [
    actionOptions,
    canAddFirstPolicy,
    canAddPolicyForEvent,
    dragOverStepIndex,
    draggedStepIndex,
    firstPolicy,
    noSelectionValue,
    onAddPolicyStep,
    onActionStepSelect,
    onOutputHandlerSelect,
    onPolicyChange,
    onStepPointerCancel,
    onStepPointerDown,
    onStepPointerMove,
    onStepPointerUp,
    policyById,
    policyOptions,
    selectedActionStepIndexes
  ]);
}

function useWorkflowNodes(
  layoutNodes: WorkflowCanvasProps["layout"]["nodes"],
  layoutEdges: WorkflowCanvasProps["layout"]["edges"],
  nodeContext: WorkflowNodeContext
) {
  const activeHandleIdsByNodeKey = useMemo(() => workflowActiveHandleIdsByNodeKey(layoutEdges), [layoutEdges]);

  return useMemo<WorkflowReactFlowNode[]>(() => layoutNodes.map((layoutNode) => ({
    id: layoutNode.key,
    type: "workflow",
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
    handles: workflowNodeHandles(layoutNode, activeHandleIdsByNodeKey.get(layoutNode.key) ?? []),
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

function workflowActiveHandleIdsByNodeKey(layoutEdges: WorkflowCanvasProps["layout"]["edges"]) {
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

function workflowNodeHandles(layoutNode: WorkflowCanvasProps["layout"]["nodes"][number], activeHandleIds: string[]): WorkflowReactFlowNode["handles"] {
  const anchorTop = workflowCanvasNodeAnchorY(layoutNode);
  const activeHandleIdSet = new Set(activeHandleIds);
  const handles: NonNullable<WorkflowReactFlowNode["handles"]> = [];

  if (activeHandleIdSet.has("left")) handles.push({ id: "left", type: "target", position: Position.Left, x: 0, y: anchorTop, width: 1, height: 1 });
  if (activeHandleIdSet.has("right")) handles.push({ id: "right", type: "source", position: Position.Right, x: layoutNode.width, y: anchorTop, width: 1, height: 1 });
  if (activeHandleIdSet.has("top")) {
    handles.push({ id: "top", type: "source", position: Position.Top, x: layoutNode.width / 2, y: 0, width: 1, height: 1 });
    handles.push({ id: "top", type: "target", position: Position.Top, x: layoutNode.width / 2, y: 0, width: 1, height: 1 });
  }
  if (activeHandleIdSet.has("bottom")) handles.push({ id: "bottom", type: "source", position: Position.Bottom, x: layoutNode.width / 2, y: layoutNode.height, width: 1, height: 1 });

  return handles;
}

export function toWorkflowReactFlowEdges(
  layoutEdges: WorkflowCanvasProps["layout"]["edges"],
  layoutNodes: WorkflowCanvasProps["layout"]["nodes"] = [],
  context?: WorkflowNodeContext,
  animatedEdgeId?: string | null
): WorkflowReactFlowEdge[] {
  const nodeByKey = new Map(layoutNodes.map((node) => [node.key, node]));

  return layoutEdges.map((workflowEdge) => ({
    id: workflowEdge.key,
    type: "workflowSmart",
    source: workflowEdge.sourceNodeKey,
    target: workflowEdge.targetNodeKey,
    sourceHandle: workflowEdge.sourceHandleId,
    targetHandle: workflowEdge.targetHandleId,
    data: {
      workflowEdge,
      context,
      sourceNode: nodeByKey.get(workflowEdge.sourceNodeKey),
      targetNode: nodeByKey.get(workflowEdge.targetNodeKey)
    },
    animated: workflowEdge.key === animatedEdgeId,
    className: workflowEdge.key === animatedEdgeId ? "workflow-edge-animated" : undefined,
    style: {
      stroke: workflowEdgeStroke(workflowEdge),
      strokeWidth: 2,
      strokeDasharray: workflowEdgeStrokeDasharray(workflowEdge)
    },
    interactionWidth: 16,
    selectable: false,
    focusable: false,
    reconnectable: false,
    domAttributes: workflowEdgeDomAttributes(workflowEdge, workflowEdge.key === animatedEdgeId)
  }));
}

function useWorkflowEdges(
  layoutEdges: WorkflowCanvasProps["layout"]["edges"],
  layoutNodes: WorkflowCanvasProps["layout"]["nodes"],
  context: WorkflowNodeContext,
  animatedEdgeId: string | null
) {
  return useMemo(() => toWorkflowReactFlowEdges(layoutEdges, layoutNodes, context, animatedEdgeId), [animatedEdgeId, context, layoutEdges, layoutNodes]);
}
