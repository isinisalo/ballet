import { useMemo, type ReactNode } from "react";
import {
  defaultLoopTheme,
  type ExecutionProfile,
  type LocalRuntime,
  type LoopRunDetails,
  type LoopTheme,
  type ProjectAutomationConfig,
  type ProjectLoop
} from "@shared/api/workspace-contracts";
import { LoopCanvasSurface } from "./LoopCanvasSurface";
import { calculateCompositeLoopCanvasLayout } from "./loopLayout";
import type { LoopCanvasEdge } from "./loopLayoutEdges";
import { buildLoopVisualProjection } from "./loopVisualProjection";
import { useLoopCanvasInteraction } from "./useLoopCanvasInteraction";
import { executionProfileBlockingReason } from "../../executionProfiles/executionProfileOptions";

export function LoopCanvas({
  config,
  loop,
  executionProfiles = [],
  runtime,
  run,
  selectedNodeId,
  theme: themeOverride,
  readOnly = false,
  canvasControls,
  onAddFirstNode,
  onNodeSelect,
  onNodeEdgeSelect,
  onReorderNode
}: {
  config: ProjectAutomationConfig;
  loop: ProjectLoop;
  executionProfiles?: ExecutionProfile[];
  runtime?: LocalRuntime;
  run?: LoopRunDetails | null;
  selectedNodeId?: string;
  theme?: LoopTheme;
  readOnly?: boolean;
  canvasControls?: ReactNode;
  onAddFirstNode?: () => void;
  onNodeSelect?: (nodeId: string) => void;
  onNodeEdgeSelect?: (nodeId: string, edgeId: string) => void;
  onReorderNode?: (fromIndex: number, toIndex: number) => void;
}) {
  const theme = run?.themeSnapshot ?? themeOverride ?? defaultLoopTheme;
  const availableExecutionProfileIds = useMemo(() => runtime
    ? new Set(executionProfiles
      .filter((profile) => !executionProfileBlockingReason(profile, runtime))
      .map((profile) => profile.id))
    : undefined, [executionProfiles, runtime]);
  const projection = useMemo(
    () => buildLoopVisualProjection(config, loop, run, executionProfiles, availableExecutionProfileIds),
    [availableExecutionProfileIds, config, executionProfiles, loop, run]
  );
  const layout = useMemo(() => calculateCompositeLoopCanvasLayout({
    config: projection.config,
    selectedLoopId: loop.id,
    recordsByLoopId: projection.recordsByLoopId,
    direction: "horizontal"
  }), [loop.id, projection]);
  const interaction = useLoopCanvasInteraction({
    selectedId: loop.id,
    reorderNode: (_loopId, fromIndex, toIndex) => onReorderNode?.(fromIndex, toIndex)
  });
  const selectedIndexes = loop.nodes.flatMap((node, index) => node.id === selectedNodeId ? [index] : []);
  const activeEdgeId = useMemo(() => activeRunEdgeId(layout.edges, loop, run), [layout.edges, loop, run]);

  const selectNodeEdge = (edge: LoopCanvasEdge) => {
    const index = edge.route?.sourceNodeIndex;
    const result = edge.route?.outputId;
    const node = index === undefined ? undefined : loop.nodes[index];
    if (node && result === "ok") {
      onNodeEdgeSelect?.(node.id, result);
    }
  };

  return (
    <div className="relative min-w-0">
      <LoopCanvasSurface
        layout={layout}
        theme={theme}
        selectedLoopId={loop.id}
        nodeByKey={projection.nodeByKey}
        draggedNodeIndex={interaction.draggedNodeIndex}
        dragOverNodeIndex={interaction.dragOverNodeIndex}
        selectedNodeIndexes={selectedIndexes}
        readOnly={readOnly}
        staticPreview={false}
        canvasHeight={interaction.canvasHeight}
        isCanvasPanning={interaction.isCanvasPanning}
        loopCanvasRef={interaction.loopCanvasRef}
        canAddFirstNode={!readOnly && loop.nodes.length === 0 && Boolean(onAddFirstNode)}
        onNodePointerDown={interaction.handleNodePointerDown}
        onNodePointerMove={interaction.handleNodePointerMove}
        onNodePointerUp={interaction.handleNodePointerUp}
        onNodePointerCancel={interaction.resetNodeDrag}
        onCanvasMoveStart={interaction.handleCanvasMoveStart}
        onCanvasMoveEnd={interaction.handleCanvasMoveEnd}
        onNodeSelect={(records) => {
          const nodeId = records[0]?.node?.displayId;
          if (nodeId) onNodeSelect?.(nodeId);
        }}
        onOutputHandlerSelect={selectNodeEdge}
        onAddFirstNode={() => onAddFirstNode?.()}
        activeEdgeId={activeEdgeId}
      />
      {canvasControls ? <div data-loop-canvas-controls className="absolute top-3 right-3 z-30">{canvasControls}</div> : null}
    </div>
  );
}

function activeRunEdgeId(edges: LoopCanvasEdge[], loop: ProjectLoop, run?: LoopRunDetails | null) {
  const latestValidation = [...(run?.nodeRuns ?? [])].reverse().find((nodeRun) =>
    nodeRun.role === "validation" && nodeRun.outcome?.role === "validation"
      && nodeRun.outcome.state === "completed" && nodeRun.outcome.decision === "OK");
  if (!latestValidation?.workLoopNodeId) return null;
  const sourceNodeIndex = loop.nodes.findIndex((node) => node.id === latestValidation.workLoopNodeId);
  return edges.find((edge) => edge.route?.sourceNodeIndex === sourceNodeIndex
    && edge.route?.outputId === "ok")?.key ?? null;
}
