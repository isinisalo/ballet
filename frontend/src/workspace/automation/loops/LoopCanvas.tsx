import { useMemo, type ReactNode } from "react";
import {
  defaultLoopTheme,
  type Agent,
  type AgentExecutionState,
  type LoopRunDetails,
  type LoopTheme,
  type ProjectAutomationConfig,
  type ProjectLoop,
  type ProjectLoopNode,
  type ProjectStepTransitionId
} from "@shared/api/workspace-contracts";
import { LoopCanvasSurface } from "./LoopCanvasSurface";
import { calculateCompositeLoopCanvasLayout } from "./loopLayout";
import type { LoopCanvasEdge } from "./loopLayoutEdges";
import { buildLoopVisualProjection } from "./loopVisualProjection";
import { useLoopCanvasInteraction } from "./useLoopCanvasInteraction";

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
  onAddFirstStep,
  onStepSelect,
  onTransitionSelect,
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
  onAddFirstStep?: () => void;
  onStepSelect?: (stepId: string) => void;
  onTransitionSelect?: (stepId: string, result: ProjectStepTransitionId) => void;
  onReorderStep?: (fromIndex: number, toIndex: number) => void;
}) {
  const theme = run?.themeSnapshot ?? themeOverride ?? defaultLoopTheme;
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
  const selectedIndexes = loop.nodes.flatMap((node, index) => node.id === selectedStepId ? [index] : []);
  const activeEdgeId = useMemo(() => activeRunEdgeId(layout.edges, loop, run), [layout.edges, loop, run]);

  const selectTransition = (edge: LoopCanvasEdge) => {
    const index = edge.route?.sourceStepIndex;
    const result = edge.route?.outputId;
    const node = index === undefined ? undefined : loop.nodes[index];
    const transition = selectableTransition(node, result);
    if (node && transition) onTransitionSelect?.(node.id, transition);
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
        canAddFirstStep={!readOnly && !loop.nodes.some((node) => node.type === "agent" || node.type === "human" || node.type === "scheduled") && Boolean(onAddFirstStep)}
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

export function activeRunEdgeId(edges: LoopCanvasEdge[], loop: ProjectLoop, run?: LoopRunDetails | null) {
  const latestWithResult = [...(run?.stepRuns ?? [])].reverse().find((stepRun) => stepRun.result);
  if (!latestWithResult?.result) return null;
  const result = latestWithResult.result.kind === "agent"
    ? latestWithResult.result.outcome
    : latestWithResult.result.decision;
  const sourceStepIndex = loop.nodes.findIndex((node) => node.id === latestWithResult.stepId);
  return edges.find((edge) => edge.route?.sourceStepIndex === sourceStepIndex
    && edge.route?.outputId === result)?.key ?? null;
}

const agentTransitionIds = new Set<ProjectStepTransitionId>([
  "ready", "approved", "changes-requested", "needs_input", "blocked", "failed"
]);

export function selectableTransition(
  node: ProjectLoopNode | undefined,
  result: string | undefined
): ProjectStepTransitionId | undefined {
  if (!node || !result || node.type === "completed" || node.type === "blocked" || node.type === "failed") return undefined;
  if (node.type === "human") return result === "approved" || result === "rejected" ? result : undefined;
  return agentTransitionIds.has(result as ProjectStepTransitionId) ? result as ProjectStepTransitionId : undefined;
}
