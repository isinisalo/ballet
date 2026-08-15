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
  selectedStepId,
  theme: themeOverride,
  readOnly = false,
  canvasControls,
  onAddFirstStep,
  onStepSelect,
  onTransitionSelect,
  onReorderStep
}: {
  config: ProjectAutomationConfig;
  loop: ProjectLoop;
  executionProfiles?: ExecutionProfile[];
  runtime?: LocalRuntime;
  run?: LoopRunDetails | null;
  selectedStepId?: string;
  theme?: LoopTheme;
  readOnly?: boolean;
  canvasControls?: ReactNode;
  onAddFirstStep?: () => void;
  onStepSelect?: (stepId: string) => void;
  onTransitionSelect?: (nodeId: string, edgeId: string) => void;
  onReorderStep?: (fromIndex: number, toIndex: number) => void;
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
    reorderStep: (_loopId, fromIndex, toIndex) => onReorderStep?.(fromIndex, toIndex)
  });
  const selectedIndexes = loop.nodes.flatMap((node, index) => node.id === selectedStepId ? [index] : []);
  const activeEdgeId = useMemo(() => activeRunEdgeId(layout.edges, loop, run), [layout.edges, loop, run]);

  const selectTransition = (edge: LoopCanvasEdge) => {
    const index = edge.route?.sourceStepIndex;
    const result = edge.route?.outputId;
    const node = index === undefined ? undefined : loop.nodes[index];
    if (node && result === "ok") {
      onTransitionSelect?.(node.id, result);
    }
  };

  return (
    <div className="relative min-w-0">
      <LoopCanvasSurface
        layout={layout}
        theme={theme}
        selectedLoopId={loop.id}
        stepByKey={projection.stepByKey}
        draggedStepIndex={interaction.draggedStepIndex}
        dragOverStepIndex={interaction.dragOverStepIndex}
        selectedStepIndexes={selectedIndexes}
        readOnly={readOnly}
        staticPreview={false}
        canvasHeight={interaction.canvasHeight}
        isCanvasPanning={interaction.isCanvasPanning}
        loopCanvasRef={interaction.loopCanvasRef}
        canAddFirstStep={!readOnly && loop.nodes.length === 0 && Boolean(onAddFirstStep)}
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
        onAddFirstStep={() => onAddFirstStep?.()}
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
  const sourceStepIndex = loop.nodes.findIndex((node) => node.id === latestValidation.workLoopNodeId);
  return edges.find((edge) => edge.route?.sourceStepIndex === sourceStepIndex
    && edge.route?.outputId === "ok")?.key ?? null;
}
