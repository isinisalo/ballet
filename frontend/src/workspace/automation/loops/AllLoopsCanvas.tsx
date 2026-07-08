import { useMemo } from "react";
import type { ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import { EmptyState } from "@/components/shared/workspace-ui";
import { LoopCanvas } from "./LoopCanvas";
import type { LoopStepRecord } from "./loopGraph";
import { calculateAllLoopsCanvasLayout } from "./loopLayout";
import { loopOutputTargetsForPolicy } from "./loopOutputTargets";
import { useLoopCanvasInteraction } from "./useLoopCanvasInteraction";

const allLoopsReadOnlyId = "__all_loops__";
const noSelection = "__none__";

export function AllLoopsCanvas({ config }: { config: ProjectAutomationConfig }) {
  const actionById = useMemo(() => new Map(config.actions.map((action) => [action.id, action])), [config.actions]);
  const stepActionOptions = useMemo(() => [
    { value: noSelection, label: "No action" },
    ...config.actions.map((action) => ({ value: action.id, label: action.id }))
  ], [config.actions]);
  const actionOptions = useMemo(() => [
    { value: noSelection, label: "No action" },
    ...config.actions.map((action) => ({
      value: action.id,
      label: action.description ? `${action.id} · ${action.description}` : action.id,
      description: action.description
    }))
  ], [config.actions]);
  const recordsByLoopId = useMemo(() => loopStepRecordsByLoopId(config, actionById), [config, actionById]);
  const layout = useMemo(() => calculateAllLoopsCanvasLayout({
    config,
    recordsByLoopId,
    direction: "horizontal"
  }), [config, recordsByLoopId]);
  const canvasInteraction = useLoopCanvasInteraction({
    selectedId: allLoopsReadOnlyId,
    reorderStep: () => undefined
  });

  if (config.loops.length === 0) return <EmptyState title="No loops configured." />;

  return (
    <LoopCanvas
      layout={layout}
      selectedLoopId={allLoopsReadOnlyId}
      actionById={actionById}
      noSelectionValue={noSelection}
      stepActionOptions={stepActionOptions}
      actionOptions={actionOptions}
      draggedStepIndex={canvasInteraction.draggedStepIndex}
      dragOverStepIndex={canvasInteraction.dragOverStepIndex}
      selectedActionStepIndexes={[]}
      canvasHeight={canvasInteraction.canvasHeight}
      isCanvasPanning={canvasInteraction.isCanvasPanning}
      loopCanvasRef={canvasInteraction.loopCanvasRef}
      canAddFirstAction={false}
      canAddActionForEvent={() => false}
      onStepPointerDown={canvasInteraction.handleStepPointerDown}
      onStepPointerMove={canvasInteraction.handleStepPointerMove}
      onStepPointerUp={canvasInteraction.handleStepPointerUp}
      onStepPointerCancel={canvasInteraction.resetStepDrag}
      onCanvasMoveStart={canvasInteraction.handleCanvasMoveStart}
      onCanvasMoveEnd={canvasInteraction.handleCanvasMoveEnd}
      onActionChange={() => undefined}
      onActionStepSelect={() => undefined}
      onOutputHandlerSelect={() => undefined}
      onAddActionStep={() => undefined}
    />
  );
}

function loopStepRecordsByLoopId(
  config: ProjectAutomationConfig,
  actionById: ReadonlyMap<string, ProjectAutomationConfig["actions"][number]>
) {
  return new Map(config.loops.map((loop) => {
    const records: LoopStepRecord[] = loop.steps.map((actionId, index) => {
      const action = actionById.get(actionId);
      const outputTargets = action ? loopOutputTargetsForPolicy(config, action, loop.id) : undefined;
      return {
        actionId,
        index,
        loopId: loop.id,
        action,
        outputEvents: outputTargets?.map((output) => output.eventType),
        outputTargets
      };
    });
    return [loop.id, records] as const;
  }));
}
