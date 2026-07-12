import { useMemo, type ReactNode } from "react";
import type {
  Agent,
  AgentExecutionState,
  LoopRunDetails,
  LoopTheme,
  ProjectAutomationConfig,
  ProjectLoop,
  ProjectStepTransitionId
} from "@shared/api/workspace-contracts";
import { LoopCanvasSurface } from "./LoopCanvasSurface";
import { calculateCompositeLoopCanvasLayout } from "./loopLayout";
import type { LoopCanvasEdge } from "./loopLayoutEdges";
import { buildLoopVisualProjection } from "./loopVisualProjection";
import { useLoopCanvasInteraction } from "./useLoopCanvasInteraction";
import { loopTheme as resolveLoopTheme } from "./loopTheme";

export function LoopCanvas({
  config,
  loop,
  agents = [],
  agentExecutionStates = [],
  run,
  selectedStepId,
  theme: themeOverride,
  readOnly = false,
  canvasControls,
  onStepSelect,
  onTransitionSelect,
  onInsertStep,
  onReorderStep
}: {
  config: ProjectAutomationConfig;
  loop: ProjectLoop;
  agents?: Agent[];
  agentExecutionStates?: AgentExecutionState[];
  run?: LoopRunDetails | null;
  selectedStepId?: string;
  theme?: LoopTheme;
  readOnly?: boolean;
  canvasControls?: ReactNode;
  onStepSelect?: (stepId: string) => void;
  onTransitionSelect?: (stepId: string, result: ProjectStepTransitionId) => void;
  onInsertStep?: (stepId: string, result: "approved" | "rejected") => void;
  onReorderStep?: (fromIndex: number, toIndex: number) => void;
}) {
  const theme = run?.themeSnapshot ?? themeOverride ?? resolveLoopTheme(loop.theme);
  const projection = useMemo(
    () => buildLoopVisualProjection(config, loop, run, agents, agentExecutionStates),
    [agentExecutionStates, agents, config, loop, run]
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
  const selectedIndexes = loop.steps.flatMap((step, index) => step.id === selectedStepId ? [index] : []);
  const activeEdgeId = useMemo(() => activeRunEdgeId(layout.edges, loop, run), [layout.edges, loop, run]);

  const selectTransition = (edge: LoopCanvasEdge) => {
    const index = edge.route?.sourceStepIndex;
    const result = edge.route?.outputId;
    const step = index === undefined ? undefined : loop.steps[index];
    if (step && (result === "approved" || result === "rejected" || result === "triggered")) {
      onTransitionSelect?.(step.id, result);
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
        canAddFirstStep={false}
        canAddStepForEvent={(sourceStep) => !readOnly && Boolean(onInsertStep) && sourceStep?.step.type !== "scheduled"}
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
  return edges.find((edge) => edge.route?.sourceStepIndex === sourceStepIndex
    && edge.route?.outputId === latestWithResult.result)?.key ?? null;
}
