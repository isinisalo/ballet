import { useMemo } from "react";
import type { ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import { EmptyState } from "@/components/shared/workspace-ui";
import { WorkflowCanvas } from "./WorkflowCanvas";
import type { WorkflowStepRecord } from "./workflowGraph";
import { calculateAllWorkflowsCanvasLayout } from "./workflowLayout";
import { workflowOutputTargetsForPolicy } from "./workflowOutputTargets";
import { useWorkflowCanvasInteraction } from "./useWorkflowCanvasInteraction";

const allWorkflowsReadOnlyId = "__all_workflows__";
const noSelection = "__none__";

export function AllWorkflowsCanvas({ config }: { config: ProjectAutomationConfig }) {
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
  const recordsByWorkflowId = useMemo(() => workflowStepRecordsByWorkflowId(config, policyById), [config, policyById]);
  const layout = useMemo(() => calculateAllWorkflowsCanvasLayout({
    config,
    recordsByWorkflowId,
    direction: "horizontal"
  }), [config, recordsByWorkflowId]);
  const canvasInteraction = useWorkflowCanvasInteraction({
    selectedId: allWorkflowsReadOnlyId,
    reorderStep: () => undefined
  });

  if (config.workflows.length === 0) return <EmptyState title="No workflows configured." />;

  return (
    <WorkflowCanvas
      layout={layout}
      selectedWorkflowId={allWorkflowsReadOnlyId}
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
      workflowCanvasRef={canvasInteraction.workflowCanvasRef}
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

function workflowStepRecordsByWorkflowId(
  config: ProjectAutomationConfig,
  policyById: ReadonlyMap<string, ProjectAutomationConfig["policies"][number]>
) {
  return new Map(config.workflows.map((workflow) => {
    const records: WorkflowStepRecord[] = workflow.steps.map((policyId, index) => {
      const policy = policyById.get(policyId);
      const outputTargets = policy ? workflowOutputTargetsForPolicy(config, policy) : undefined;
      return {
        policyId,
        index,
        workflowId: workflow.id,
        policy,
        outputEvents: outputTargets?.map((output) => output.eventType),
        outputTargets
      };
    });
    return [workflow.id, records] as const;
  }));
}
