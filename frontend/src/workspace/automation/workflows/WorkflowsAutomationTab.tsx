import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ProjectAutomationConfig,
  ProjectPolicy,
  ProjectWorkflow
} from "../../../../../shared/api/workspace-contracts";
import { actionOutputIds, generatedPolicyId, normalizePolicyToken, policyOutputEventType } from "../../../../../shared/policy-actions";
import { EmptyState } from "@/components/shared/workspace-ui";
import { uniquePolicyAction } from "../automationUtils";
import type { AutomationConfigUpdater } from "../useAutomationDraft";
import { WorkflowCanvas } from "./WorkflowCanvas";
import { buildWorkflowGraph, type WorkflowOutputTarget, type WorkflowStepRecord } from "./workflowGraph";
import { calculateWorkflowCanvasLayout } from "./workflowLayout";
import { useWorkflowCanvasInteraction } from "./useWorkflowCanvasInteraction";

const noSelection = "__none__";

export function WorkflowsAutomationTab({
  config,
  selectedId,
  onSelect,
  updateConfig,
  saveDraft
}: {
  config: ProjectAutomationConfig;
  selectedId: string;
  onSelect: (id: string) => void;
  updateConfig: AutomationConfigUpdater;
  saveDraft: (nextDraft?: ProjectAutomationConfig) => Promise<boolean>;
}) {
  const lastSelectedIndexRef = useRef(0);
  const foundSelectedIndex = config.workflows.findIndex((workflow) => workflow.id === selectedId);
  const selectedIndex = foundSelectedIndex >= 0
    ? foundSelectedIndex
    : Math.min(lastSelectedIndexRef.current, Math.max(0, config.workflows.length - 1));
  const selected = config.workflows[selectedIndex];
  const [editingPolicyIndex, setEditingPolicyIndex] = useState<number | null>(null);
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
      type: config.outputs.find((output) => output.id === outputId)?.type ?? "event"
    }));
  const workflowStepRecords = useMemo<WorkflowStepRecord[]>(() =>
    selected?.steps.map((policyId, index) => {
      const policy = policyById.get(policyId);
      const outputTargets = policy ? workflowOutputTargets(policy) : undefined;
      return {
        policyId,
        index,
        policy,
        outputEvents: outputTargets?.filter((output) => output.type === "event").map((output) => output.eventType),
        outputTargets
      };
    }) ?? [],
  [config.actions, config.outputs, policyById, selected?.steps]);
  const workflowGraph = useMemo(() => buildWorkflowGraph(workflowStepRecords), [workflowStepRecords]);
  const workflowLayout = useMemo(
    () => selected ? calculateWorkflowCanvasLayout({ workflowGraph, editingPolicyIndex, direction: "horizontal" }) : undefined,
    [editingPolicyIndex, selected, workflowGraph]
  );

  useEffect(() => {
    if (foundSelectedIndex >= 0) lastSelectedIndexRef.current = foundSelectedIndex;
  }, [foundSelectedIndex]);

  const updateSelected = (patch: Partial<ProjectWorkflow>) => {
    if (!selected) return;
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

  const nextConfigWithWorkflowPolicy = (current: ProjectAutomationConfig, record: WorkflowStepRecord, patch: Partial<ProjectPolicy>) => {
    if (!record.policy) return current;
    const selectedPolicy = record.policy;
    const next = { ...selectedPolicy, ...patch };
    const source: ProjectPolicy["source"] = next.source === "trigger" ? "trigger" : "event";
    const normalized = {
      ...next,
      source,
      event: source === "event" ? next.event ?? "" : undefined,
      trigger: source === "trigger" ? normalizePolicyToken(next.trigger ?? "") : undefined,
      action: normalizePolicyToken(next.action)
    };
    const nextId = generatedPolicyId(normalized);

    return {
      ...current,
      policies: current.policies.map((policy) => policy.id === selectedPolicy.id ? { ...normalized, id: nextId } : policy),
      workflows: current.workflows.map((workflow) => ({
        ...workflow,
        steps: workflow.steps.map((step) => step === selectedPolicy.id ? nextId : step)
      }))
    };
  };

  const updateWorkflowPolicy = (record: WorkflowStepRecord, patch: Partial<ProjectPolicy>, { autoSave = false }: { autoSave?: boolean } = {}) => {
    const nextConfig = nextConfigWithWorkflowPolicy(config, record, patch);
    updateConfig(() => nextConfig);
    if (autoSave) void saveDraft(nextConfig);
  };

  const addPolicyStep = (eventType?: string, sourcePolicy?: ProjectPolicy) => {
    if (!selected) return;
    const selectedPolicyIds = new Set(selected.steps);
    const nextPolicy = eventType
      ? config.policies.find((policy) => policy.source === "event" && policy.event === eventType && !selectedPolicyIds.has(policy.id))
      : config.policies.find((policy) => !selectedPolicyIds.has(policy.id)) ?? config.policies[0];
    if (!nextPolicy) {
      const baseAction = sourcePolicy?.action || defaultAction;
      if (!baseAction) return;
      const generatedSource: ProjectPolicy["source"] = eventType || !config.triggers[0]?.id ? "event" : "trigger";
      const generatedEvent = eventType || policyOutputEventType({ action: baseAction }, selectedActionOutputIds(baseAction)[0] ?? "");
      const action = generatedSource === "event" ? uniquePolicyAction(generatedEvent, baseAction, config.policies) : baseAction;
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
            description: "",
            outputIds,
            agentIds: current.actions.find((candidate) => candidate.id === baseAction)?.agentIds ?? []
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

  const canAddFirstPolicy = Boolean(defaultAction && (config.actions.find((action) => action.id === defaultAction)?.agentIds.length ?? 0) > 0);
  const canAddPolicyForEvent = (policy?: ProjectPolicy) => {
    const action = policy?.action || defaultAction;
    const actionAgentCount = config.actions.find((candidate) => candidate.id === action)?.agentIds.length ?? 0;
    return Boolean(action && actionAgentCount > 0 && selectedActionOutputIds(action).length > 0);
  };

  if (!selected || !workflowLayout) return <EmptyState title="No workflow selected." />;

  return (
    <WorkflowCanvas
      layout={workflowLayout}
      policyById={policyById}
      firstPolicy={policyById.get(selected.steps[0] ?? "")}
      noSelectionValue={noSelection}
      policyOptions={policyOptions}
      actionOptions={actionOptions}
      draggedStepIndex={canvasInteraction.draggedStepIndex}
      dragOverStepIndex={canvasInteraction.dragOverStepIndex}
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
      onPolicyChange={updateStep}
      onActionChange={(record, action) => updateWorkflowPolicy(record, { action: action === noSelection ? "" : action }, { autoSave: true })}
      onEditPolicy={setEditingPolicyIndex}
      onAddPolicyStep={addPolicyStep}
    />
  );
}
