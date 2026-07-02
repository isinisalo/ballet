import { useEffect, useMemo } from "react";
import { MarkerType, Position, ReactFlow, type EdgeTypes, type NodeTypes, useUpdateNodeInternals } from "@xyflow/react";
import { SmartStepEdge } from "@tisoap/react-flow-smart-edge";
import { cn } from "@/lib/utils";
import { WorkflowReactFlowNodeComponent } from "./WorkflowReactFlowNode";
import type { WorkflowCanvasProps, WorkflowNodeContext, WorkflowReactFlowEdge, WorkflowReactFlowNode } from "./WorkflowCanvasTypes";
import { workflowCanvasLayoutConfig } from "./workflowLayout";

const workflowNodeTypes = {
  workflow: WorkflowReactFlowNodeComponent
} satisfies NodeTypes;

const workflowEdgeTypes = {
  workflowSmart: SmartStepEdge
} satisfies EdgeTypes;

const workflowSolidEdgeStroke = "color-mix(in srgb, var(--primary) 70%, transparent)";
const workflowDashedEdgeStroke = "color-mix(in srgb, var(--muted-foreground) 70%, transparent)";

const workflowSolidEdgeMarker = {
  type: MarkerType.ArrowClosed,
  width: 8,
  height: 8,
  color: workflowSolidEdgeStroke
} as const;

const workflowDashedEdgeMarker = {
  type: MarkerType.ArrowClosed,
  width: 8,
  height: 8,
  color: workflowDashedEdgeStroke
} as const;

function workflowEdgeDomAttributes(dashed?: boolean): WorkflowReactFlowEdge["domAttributes"] {
  return {
    "data-workflow-connector": "true",
    "data-dashed": dashed ? "true" : "false"
  } as WorkflowReactFlowEdge["domAttributes"];
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
  const nodes = useWorkflowNodes(layout.nodes, nodeContext);
  const nodeIds = useMemo(() => layout.nodes.map((node) => node.key), [layout.nodes]);
  const edges = useWorkflowEdges(layout.edges, nodeContext);

  return (
    <div
      ref={workflowCanvasRef}
      data-workflow-canvas
      className={cn("relative min-h-[28rem] overflow-hidden rounded-lg border border-divider-strong bg-background", isCanvasPanning ? "cursor-grabbing" : "cursor-grab")}
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
  agentOptions,
  actionOptions,
  draggedStepIndex,
  dragOverStepIndex,
  canAddFirstPolicy,
  canAddPolicyForEvent,
  onStepPointerDown,
  onStepPointerMove,
  onStepPointerUp,
  onStepPointerCancel,
  onPolicyChange,
  onAgentChange,
  onActionChange,
  onSavePolicy,
  onEditPolicy,
  onDeleteStep,
  onAddPolicyStep
}: WorkflowNodeContext) {
  return useMemo<WorkflowNodeContext>(() => ({
    policyById,
    firstPolicy,
    noSelectionValue,
    policyOptions,
    agentOptions,
    actionOptions,
    draggedStepIndex,
    dragOverStepIndex,
    canAddFirstPolicy,
    canAddPolicyForEvent,
    onStepPointerDown,
    onStepPointerMove,
    onStepPointerUp,
    onStepPointerCancel,
    onPolicyChange,
    onAgentChange,
    onActionChange,
    onSavePolicy,
    onEditPolicy,
    onDeleteStep,
    onAddPolicyStep
  }), [
    actionOptions,
    agentOptions,
    canAddFirstPolicy,
    canAddPolicyForEvent,
    dragOverStepIndex,
    draggedStepIndex,
    firstPolicy,
    noSelectionValue,
    onActionChange,
    onAddPolicyStep,
    onAgentChange,
    onDeleteStep,
    onEditPolicy,
    onPolicyChange,
    onSavePolicy,
    onStepPointerCancel,
    onStepPointerDown,
    onStepPointerMove,
    onStepPointerUp,
    policyById,
    policyOptions
  ]);
}

function useWorkflowNodes(layoutNodes: WorkflowCanvasProps["layout"]["nodes"], nodeContext: WorkflowNodeContext) {
  return useMemo<WorkflowReactFlowNode[]>(() => layoutNodes.map((layoutNode) => ({
    id: layoutNode.key,
    type: "workflow",
    position: { x: layoutNode.x, y: layoutNode.y },
    data: { layoutNode, context: nodeContext },
    width: layoutNode.width,
    height: layoutNode.height,
    initialWidth: layoutNode.width,
    initialHeight: layoutNode.height,
    measured: { width: layoutNode.width, height: layoutNode.height },
    handles: workflowNodeHandles(layoutNode),
    draggable: false,
    selectable: false,
    connectable: false,
    focusable: false,
    style: {
      width: layoutNode.width,
      height: layoutNode.height,
      pointerEvents: "all"
    }
  })), [layoutNodes, nodeContext]);
}

function workflowNodeHandles(layoutNode: WorkflowCanvasProps["layout"]["nodes"][number]): WorkflowReactFlowNode["handles"] {
  const anchorTop = layoutNode.kind === "policy" || layoutNode.kind === "output-events"
    ? workflowCanvasLayoutConfig.policyAnchorY
    : layoutNode.height / 2;
  const anchorLeft = layoutNode.width / 2;

  return [
    { id: "left", type: "target", position: Position.Left, x: 0, y: anchorTop, width: 1, height: 1 },
    { id: "right", type: "source", position: Position.Right, x: layoutNode.width, y: anchorTop, width: 1, height: 1 },
    { id: "top", type: "target", position: Position.Top, x: anchorLeft, y: 0, width: 1, height: 1 },
    { id: "bottom", type: "source", position: Position.Bottom, x: anchorLeft, y: layoutNode.height, width: 1, height: 1 }
  ];
}

export function toWorkflowReactFlowEdges(layoutEdges: WorkflowCanvasProps["layout"]["edges"], context?: WorkflowNodeContext): WorkflowReactFlowEdge[] {
  return layoutEdges.map((workflowEdge) => ({
    id: workflowEdge.key,
    type: "workflowSmart",
    source: workflowEdge.sourceNodeKey,
    target: workflowEdge.targetNodeKey,
    sourceHandle: workflowEdge.sourceHandleId,
    targetHandle: workflowEdge.targetHandleId,
    data: { workflowEdge, context },
    markerEnd: workflowEdge.dashed ? workflowDashedEdgeMarker : workflowSolidEdgeMarker,
    style: {
      stroke: workflowEdge.dashed ? workflowDashedEdgeStroke : workflowSolidEdgeStroke,
      strokeWidth: 2,
      strokeDasharray: workflowEdge.dashed ? "6 5" : undefined
    },
    interactionWidth: 0,
    selectable: false,
    focusable: false,
    reconnectable: false,
    domAttributes: workflowEdgeDomAttributes(workflowEdge.dashed)
  }));
}

function useWorkflowEdges(layoutEdges: WorkflowCanvasProps["layout"]["edges"], context: WorkflowNodeContext) {
  return useMemo(() => toWorkflowReactFlowEdges(layoutEdges, context), [context, layoutEdges]);
}
