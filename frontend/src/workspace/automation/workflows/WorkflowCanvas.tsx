import { useEffect, useMemo } from "react";
import { ReactFlow, type EdgeTypes, type NodeTypes, useUpdateNodeInternals } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { WorkflowReactFlowEdgeComponent } from "./WorkflowReactFlowEdge";
import { WorkflowReactFlowNodeComponent } from "./WorkflowReactFlowNode";
import type { WorkflowCanvasProps, WorkflowNodeContext, WorkflowReactFlowEdge, WorkflowReactFlowNode } from "./WorkflowCanvasTypes";

const workflowNodeTypes = {
  workflow: WorkflowReactFlowNodeComponent
} satisfies NodeTypes;

const workflowEdgeTypes = {
  workflow: WorkflowReactFlowEdgeComponent
} satisfies EdgeTypes;

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
  const edges = useWorkflowEdges(layout.edges);

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
    draggable: false,
    selectable: false,
    connectable: false,
    focusable: false,
    style: { width: layoutNode.width, height: layoutNode.height, pointerEvents: "all" }
  })), [layoutNodes, nodeContext]);
}

function useWorkflowEdges(layoutEdges: WorkflowCanvasProps["layout"]["edges"]) {
  return useMemo<WorkflowReactFlowEdge[]>(() => layoutEdges.map((workflowEdge) => ({
    id: workflowEdge.key,
    type: "workflow",
    source: workflowEdge.sourceNodeKey,
    target: workflowEdge.targetNodeKey,
    sourceHandle: workflowEdge.sourceHandleId,
    targetHandle: workflowEdge.targetHandleId,
    data: { workflowEdge },
    selectable: false,
    focusable: false,
    reconnectable: false
  })), [layoutEdges]);
}
