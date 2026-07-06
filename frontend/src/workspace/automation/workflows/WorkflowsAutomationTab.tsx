import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Agent,
  ProjectAction,
  ProjectAutomationConfig,
  ProjectPolicy,
  ProjectWorkflow
} from "../../../../../shared/api/workspace-contracts";
import { actionOutputIds, generatedPolicyId, normalizePolicyToken, policyOutputEventType } from "../../../../../shared/policy-actions";
import { EmptyState, TextField } from "@/components/shared/workspace-ui";
import { FieldGroup } from "@/components/ui/field";
import { nextConfigWithActionPatch } from "../actions/actionEditorLogic";
import { uniquePolicyAction } from "../automationUtils";
import type { AutomationConfigUpdater } from "../useAutomationDraft";
import { WorkflowCanvas } from "./WorkflowCanvas";
import { WorkflowActionSheet } from "./WorkflowActionSheet";
import { buildWorkflowGraph, type WorkflowOutputTarget, type WorkflowStepRecord } from "./workflowGraph";
import { calculateWorkflowCanvasLayout } from "./workflowLayout";
import { useWorkflowCanvasInteraction } from "./useWorkflowCanvasInteraction";

const noSelection = "__none__";

export function WorkflowsAutomationTab({
  agents,
  config,
  selectedId,
  createDraft,
  onCreateDraftChange,
  onSelect,
  updateConfig
}: {
  agents: Agent[];
  config: ProjectAutomationConfig;
  selectedId?: string;
  createDraft: ProjectWorkflow;
  onCreateDraftChange: (patch: Partial<ProjectWorkflow>) => void;
  onSelect: (id: string) => void;
  updateConfig: AutomationConfigUpdater;
}) {
  const foundSelectedIndex = config.workflows.findIndex((workflow) => workflow.id === selectedId);
  const lastSelectedIndexRef = useRef<number | undefined>(foundSelectedIndex >= 0 ? foundSelectedIndex : undefined);
  const selectedIndex = foundSelectedIndex >= 0
    ? foundSelectedIndex
    : selectedId && lastSelectedIndexRef.current !== undefined
      ? Math.min(lastSelectedIndexRef.current, Math.max(0, config.workflows.length - 1))
      : -1;
  const selected = selectedIndex >= 0 ? config.workflows[selectedIndex] : createDraft;
  const creating = selectedIndex < 0;
  const [selectedActionStepIndex, setSelectedActionStepIndex] = useState<number | null>(null);
  const policyById = useMemo(() => new Map(config.policies.map((policy) => [policy.id, policy])), [config.policies]);
  const policyOptions = [{ value: noSelection, label: "No policy" }, ...config.policies.map((policy) => ({ value: policy.id, label: policy.id }))];
  const actionOptions = [
    { value: noSelection, label: "No action" },
    ...config.actions.map((action) => ({
      value: action.id,
      label: action.description ? `${action.id} · ${action.description}` : action.id,
      description: action.description
    }))
  ];
  const defaultAction = config.actions[0]?.id ?? "";
  const selectedActionOutputIds = (actionId: string) => actionOutputIds(config.actions, actionId);
  const workflowOutputTargets = (policy: ProjectPolicy): WorkflowOutputTarget[] =>
    selectedActionOutputIds(policy.action).map((outputId) => ({
      outputId,
      eventType: policyOutputEventType(policy, outputId),
      type: "event"
    }));
  const workflowStepRecords = useMemo<WorkflowStepRecord[]>(() =>
    selected?.steps.map((policyId, index) => {
      const policy = policyById.get(policyId);
      const outputTargets = policy ? workflowOutputTargets(policy) : undefined;
      return {
        policyId,
        index,
        policy,
        outputEvents: outputTargets?.map((output) => output.eventType),
        outputTargets
      };
    }) ?? [],
  [config.actions, config.outputs, policyById, selected?.steps]);
  const workflowGraph = useMemo(() => buildWorkflowGraph(workflowStepRecords), [workflowStepRecords]);
  const workflowLayout = useMemo(
    () => selected ? calculateWorkflowCanvasLayout({ workflowGraph, editingPolicyIndex: null, direction: "horizontal" }) : undefined,
    [selected, workflowGraph]
  );
  const selectedActionRecord = selectedActionStepIndex === null ? undefined : workflowStepRecords.find((record) => record.index === selectedActionStepIndex);
  const selectedAction = selectedActionRecord?.policy
    ? config.actions.find((action) => action.id === selectedActionRecord.policy?.action)
    : undefined;

  useEffect(() => {
    if (foundSelectedIndex >= 0) lastSelectedIndexRef.current = foundSelectedIndex;
  }, [foundSelectedIndex]);

  useEffect(() => {
    setSelectedActionStepIndex(null);
  }, [selected?.id]);

  useEffect(() => {
    if (selectedActionStepIndex === null) return;
    if (!selectedActionRecord?.policy || !selectedAction) setSelectedActionStepIndex(null);
  }, [selectedAction, selectedActionRecord, selectedActionStepIndex]);

  const updateSelected = (patch: Partial<ProjectWorkflow>) => {
    if (!selected) return;
    if (creating) {
      onCreateDraftChange({ ...patch, id: patch.id ? normalizePolicyToken(patch.id) : patch.id });
      return;
    }
    updateConfig((current) => ({
      ...current,
      workflows: current.workflows.map((workflow, index) => index === selectedIndex ? { ...workflow, ...patch } : workflow)
    }));
    if (patch.id) onSelect(patch.id);
  };

  const updateStep = (index: number, policyId: string) => {
    if (!selected) return;
    updateSelected({ steps: selected.steps.map((step, stepIndex) => stepIndex === index ? policyId : step) });
  };

  const addPolicyStep = (eventType?: string, sourcePolicy?: ProjectPolicy) => {
    if (!selected) return;
    const selectedPolicyIds = new Set(selected.steps);
    const eventOutputId = eventType?.split(".").at(-1) ?? "";
    const isDoneEvent = normalizePolicyToken(eventOutputId) === "done";
    const nextPolicy = eventType
      ? config.policies.find((policy) =>
        policy.source === "event" &&
        policy.event === eventType &&
        (!isDoneEvent || policy.action === "done") &&
        !selectedPolicyIds.has(policy.id)
      )
      : config.policies.find((policy) => !selectedPolicyIds.has(policy.id)) ?? config.policies[0];
    if (!nextPolicy) {
      const baseAction = sourcePolicy?.action || defaultAction;
      if (!baseAction) return;
      const generatedSource: ProjectPolicy["source"] = eventType || !config.triggers[0]?.id ? "event" : "trigger";
      const generatedEvent = eventType || policyOutputEventType({ action: baseAction }, selectedActionOutputIds(baseAction)[0] ?? "");
      const action = generatedSource === "event"
        ? isDoneEvent ? "done" : uniquePolicyAction(generatedEvent, baseAction, config.policies)
        : baseAction;
      const outputIds = selectedActionOutputIds(action);
      const generatedPolicy: ProjectPolicy = {
        id: generatedPolicyId({
          source: generatedSource,
          event: generatedSource === "event" ? generatedEvent : undefined,
          trigger: generatedSource === "trigger" ? config.triggers[0]?.id ?? "" : undefined,
          action
        }),
        source: generatedSource,
        event: generatedSource === "event" ? generatedEvent : undefined,
        trigger: generatedSource === "trigger" ? config.triggers[0]?.id ?? "" : undefined,
        action,
        enabled: true
      };
      updateConfig((current) => ({
        ...current,
        actions: current.actions.some((candidate) => candidate.id === action)
          ? current.actions
          : [...current.actions, {
            id: action,
            description: action === "done" ? "No further actions." : "",
            outputIds: action === "done" ? [] : outputIds,
            agentIds: action === "done" ? [] : current.actions.find((candidate) => candidate.id === baseAction)?.agentIds ?? []
          }],
        policies: [...current.policies, generatedPolicy],
        workflows: current.workflows.map((workflow) => workflow.id === selected.id ? { ...workflow, steps: [...workflow.steps, generatedPolicy.id] } : workflow)
      }));
      return;
    }
    updateSelected({ steps: [...selected.steps, nextPolicy.id] });
  };

  const reorderStep = (fromIndex: number, toIndex: number) => {
    if (!selected) return;
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= selected.steps.length || toIndex >= selected.steps.length) return;
    const steps = [...selected.steps];
    const [movedStep] = steps.splice(fromIndex, 1);
    steps.splice(toIndex, 0, movedStep);
    updateSelected({ steps });
  };

  const canvasInteraction = useWorkflowCanvasInteraction({
    selectedId: selected?.id,
    reorderStep
  });

  const canAddFirstPolicy = Boolean(defaultAction);
  const canAddPolicyForEvent = (policy?: ProjectPolicy) => {
    const action = policy?.action || defaultAction;
    return Boolean(action && selectedActionOutputIds(action).length > 0);
  };
  const clearActionSelection = () => setSelectedActionStepIndex(null);
  const selectActionStep = (record: WorkflowStepRecord) => {
    setSelectedActionStepIndex((current) => current === record.index ? null : record.index);
  };
  const updateSelectedAction = (patch: Partial<ProjectAction>) => {
    if (!selectedAction) return;
    updateConfig((current) => nextConfigWithActionPatch(current, selectedAction.id, patch).config);
  };
  const createOutput = (outputId: string) => {
    const id = normalizePolicyToken(outputId);
    if (!id || config.outputs.some((output) => normalizePolicyToken(output.id) === id)) return;
    updateConfig((current) => ({ ...current, outputs: [...current.outputs, { id }] }));
  };

  if (!selected || !workflowLayout) return <EmptyState title="No workflow selected." />;

  if (creating) {
    return (
      <div className="grid gap-4 p-4">
        <FieldGroup>
          <TextField label="Workflow ID" required value={selected.id} onChange={(id) => updateSelected({ id })} />
          <TextField label="Title" value={selected.title} onChange={(title) => updateSelected({ title })} />
        </FieldGroup>
      </div>
    );
  }

  return (
    <>
      <WorkflowCanvas
        layout={workflowLayout}
        policyById={policyById}
        firstPolicy={policyById.get(selected.steps[0] ?? "")}
        noSelectionValue={noSelection}
        policyOptions={policyOptions}
        actionOptions={actionOptions}
        draggedStepIndex={canvasInteraction.draggedStepIndex}
        dragOverStepIndex={canvasInteraction.dragOverStepIndex}
        selectedActionStepIndex={selectedActionStepIndex}
        canvasHeight={canvasInteraction.canvasHeight}
        isCanvasPanning={canvasInteraction.isCanvasPanning}
        workflowCanvasRef={canvasInteraction.workflowCanvasRef}
        canAddFirstPolicy={canAddFirstPolicy}
        canAddPolicyForEvent={canAddPolicyForEvent}
        onStepPointerDown={canvasInteraction.handleStepPointerDown}
        onStepPointerMove={canvasInteraction.handleStepPointerMove}
        onStepPointerUp={canvasInteraction.handleStepPointerUp}
        onStepPointerCancel={canvasInteraction.resetStepDrag}
        onCanvasMoveStart={canvasInteraction.handleCanvasMoveStart}
        onCanvasMoveEnd={canvasInteraction.handleCanvasMoveEnd}
        onActionSelectionClear={clearActionSelection}
        onPolicyChange={updateStep}
        onActionStepSelect={selectActionStep}
        onAddPolicyStep={addPolicyStep}
      />
      <WorkflowActionSheet
        open={Boolean(selectedAction)}
        action={selectedAction}
        agents={agents}
        config={config}
        onOpenChange={(open) => {
          if (!open) clearActionSelection();
        }}
        onActionChange={updateSelectedAction}
        onCreateOutput={createOutput}
      />
    </>
  );
}
