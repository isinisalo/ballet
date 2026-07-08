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
  const policyById = useMemo(() => new Map(config.policies.map((policy) => [policy.id, policy])), [config.policies]);
  const actionById = useMemo(() => new Map(config.actions.map((action) => [action.id, action])), [config.actions]);
  const policyOptions = useMemo(() => [
    { value: noSelection, label: "No policy" },
    ...config.policies.map((policy) => ({ value: policy.id, label: policy.id }))
  ], [config.policies]);
  const actionOptions = useMemo(() => [
    { value: noSelection, label: "No action" },
    ...config.actions.map((action) => ({
      value: action.id,
      label: action.description ? `${action.id} · ${action.description}` : action.id,
      description: action.description
    }))
  ], [config.actions]);
  const recordsByLoopId = useMemo(() => loopStepRecordsByLoopId(config, policyById), [config, policyById]);
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
      policyById={policyById}
      actionById={actionById}
      noSelectionValue={noSelection}
      policyOptions={policyOptions}
      actionOptions={actionOptions}
      draggedStepIndex={canvasInteraction.draggedStepIndex}
      dragOverStepIndex={canvasInteraction.dragOverStepIndex}
      selectedActionStepIndexes={[]}
      canvasHeight={canvasInteraction.canvasHeight}
      isCanvasPanning={canvasInteraction.isCanvasPanning}
      loopCanvasRef={canvasInteraction.loopCanvasRef}
      canAddFirstPolicy={false}
      canAddPolicyForEvent={() => false}
      onStepPointerDown={canvasInteraction.handleStepPointerDown}
      onStepPointerMove={canvasInteraction.handleStepPointerMove}
      onStepPointerUp={canvasInteraction.handleStepPointerUp}
      onStepPointerCancel={canvasInteraction.resetStepDrag}
      onCanvasMoveStart={canvasInteraction.handleCanvasMoveStart}
      onCanvasMoveEnd={canvasInteraction.handleCanvasMoveEnd}
      onPolicyChange={() => undefined}
      onActionStepSelect={() => undefined}
      onOutputHandlerSelect={() => undefined}
      onAddPolicyStep={() => undefined}
    />
  );
}

function loopStepRecordsByLoopId(
  config: ProjectAutomationConfig,
  policyById: ReadonlyMap<string, ProjectAutomationConfig["policies"][number]>
) {
  return new Map(config.loops.map((loop) => {
    const records: LoopStepRecord[] = loop.steps.map((policyId, index) => {
      const policy = policyById.get(policyId);
      const outputTargets = policy ? loopOutputTargetsForPolicy(config, policy) : undefined;
      return {
        policyId,
        index,
        loopId: loop.id,
        policy,
        outputEvents: outputTargets?.map((output) => output.eventType),
        outputTargets
      };
    });
    return [loop.id, records] as const;
  }));
}
