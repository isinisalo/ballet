import { useEffect, useMemo, useRef, useState } from "react";
import { Columns3, Rows3 } from "lucide-react";
import type {
  AppData,
  ProjectAutomationConfig,
  ProjectPolicy,
  ProjectWorkflow
} from "../../../../../shared/api/workspace-contracts";
import { actionOutputIds, generatedPolicyId, normalizePolicyToken, policyOutputEventType, preferredAgentToken } from "../../../../../shared/policy-actions";
import { EmptyState, TextField } from "@/components/shared/workspace-ui";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { automationAgentOptions, uniquePolicyAction } from "../automationUtils";
import type { AutomationConfigUpdater } from "../useAutomationDraft";
import { WorkflowCanvas } from "./WorkflowCanvas";
import { buildWorkflowGraph, type WorkflowOutputTarget, type WorkflowStepRecord } from "./workflowGraph";
import { calculateWorkflowCanvasLayout, type WorkflowLayoutDirection } from "./workflowLayout";
import { useWorkflowCanvasInteraction } from "./useWorkflowCanvasInteraction";

const noSelection = "__none__";

export function WorkflowsAutomationTab({
  data,
  config,
  selectedId,
  onSelect,
  updateConfig,
  saveDraft
}: {
  data: AppData;
  config: ProjectAutomationConfig;
  selectedId: string;
  onSelect: (id: string) => void;
  updateConfig: AutomationConfigUpdater;
  saveDraft: () => Promise<boolean>;
}) {
  const lastSelectedIndexRef = useRef(0);
  const foundSelectedIndex = config.workflows.findIndex((workflow) => workflow.id === selectedId);
  const selectedIndex = foundSelectedIndex >= 0
    ? foundSelectedIndex
    : Math.min(lastSelectedIndexRef.current, Math.max(0, config.workflows.length - 1));
  const selected = config.workflows[selectedIndex];
  const [editingPolicyIndex, setEditingPolicyIndex] = useState<number | null>(null);
  const [layoutDirection, setLayoutDirection] = useState<WorkflowLayoutDirection>("horizontal");
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
  const agentOptions = [{ value: noSelection, label: "No agent" }, ...automationAgentOptions(data.agents)];
  const defaultAgent = data.agents[0] ? preferredAgentToken(data.agents[0]) : "";
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
    () => selected ? calculateWorkflowCanvasLayout({ workflowGraph, editingPolicyIndex, direction: layoutDirection }) : undefined,
    [editingPolicyIndex, layoutDirection, selected, workflowGraph]
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

  const updateWorkflowPolicy = (record: WorkflowStepRecord, patch: Partial<ProjectPolicy>) => {
    if (!record.policy) return;
    const selectedPolicy = record.policy;
    const next = { ...selectedPolicy, ...patch };
    const source: ProjectPolicy["source"] = next.source === "trigger" ? "trigger" : "event";
    const normalized = {
      ...next,
      source,
      event: source === "event" ? next.event ?? "" : undefined,
      trigger: source === "trigger" ? normalizePolicyToken(next.trigger ?? "") : undefined,
      agent: normalizePolicyToken(next.agent),
      action: normalizePolicyToken(next.action)
    };
    const nextId = generatedPolicyId(normalized);

    updateConfig((current) => ({
      ...current,
      policies: current.policies.map((policy) => policy.id === selectedPolicy.id ? { ...normalized, id: nextId } : policy),
      workflows: current.workflows.map((workflow) => ({
        ...workflow,
        steps: workflow.steps.map((step) => step === selectedPolicy.id ? nextId : step)
      }))
    }));
  };

  const saveWorkflowPolicyEdit = async () => {
    const saved = await saveDraft();
    if (saved) setEditingPolicyIndex(null);
  };

  const addPolicyStep = (eventType?: string, sourcePolicy?: ProjectPolicy) => {
    if (!selected) return;
    const selectedPolicyIds = new Set(selected.steps);
    const nextPolicy = eventType
      ? config.policies.find((policy) => policy.source === "event" && policy.event === eventType && !selectedPolicyIds.has(policy.id))
      : config.policies.find((policy) => !selectedPolicyIds.has(policy.id)) ?? config.policies[0];
    if (!nextPolicy) {
      const agent = sourcePolicy?.agent || config.policies[0]?.agent || defaultAgent;
      const baseAction = sourcePolicy?.action || defaultAction;
      if (!agent || !baseAction) return;
      const generatedSource: ProjectPolicy["source"] = eventType || !config.triggers[0]?.id ? "event" : "trigger";
      const generatedEvent = eventType || policyOutputEventType({ agent, action: baseAction }, selectedActionOutputIds(baseAction)[0] ?? "");
      const action = generatedSource === "event" ? uniquePolicyAction(generatedEvent, agent, baseAction, config.policies) : baseAction;
      const outputIds = selectedActionOutputIds(action);
      const generatedPolicy: ProjectPolicy = {
        id: generatedPolicyId({
          source: generatedSource,
          event: generatedSource === "event" ? generatedEvent : undefined,
          trigger: generatedSource === "trigger" ? config.triggers[0]?.id ?? "" : undefined,
          agent,
          action
        }),
        source: generatedSource,
        event: generatedSource === "event" ? generatedEvent : undefined,
        trigger: generatedSource === "trigger" ? config.triggers[0]?.id ?? "" : undefined,
        agent,
        action,
        enabled: true
      };
      updateConfig((current) => ({
        ...current,
        actions: current.actions.some((candidate) => candidate.id === action) ? current.actions : [...current.actions, { id: action, description: "", outputIds }],
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

  const deleteStep = (index: number) => {
    updateSelected({ steps: selected?.steps.filter((_, stepIndex) => stepIndex !== index) ?? [] });
  };

  const canAddFirstPolicy = Boolean(defaultAgent && defaultAction);
  const canAddPolicyForEvent = (policy?: ProjectPolicy) => {
    const action = policy?.action || defaultAction;
    return Boolean((policy?.agent || config.policies[0]?.agent || defaultAgent) && action && selectedActionOutputIds(action).length > 0);
  };

  return (
    <div className="grid gap-4">
      {selected && workflowLayout ? (
        <div className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <TextField label="Workflow ID" required value={selected.id} onChange={(id) => updateSelected({ id })} />
            <WorkflowLayoutToggle direction={layoutDirection} onDirectionChange={setLayoutDirection} />
          </div>
          <WorkflowCanvas
            layout={workflowLayout}
            policyById={policyById}
            firstPolicy={policyById.get(selected.steps[0] ?? "")}
            noSelectionValue={noSelection}
            policyOptions={policyOptions}
            agentOptions={agentOptions}
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
            onAgentChange={(record, agent) => updateWorkflowPolicy(record, { agent: agent === noSelection ? "" : agent })}
            onActionChange={(record, action) => updateWorkflowPolicy(record, { action: action === noSelection ? "" : action })}
            onSavePolicy={() => void saveWorkflowPolicyEdit()}
            onEditPolicy={setEditingPolicyIndex}
            onDeleteStep={deleteStep}
            onAddPolicyStep={addPolicyStep}
          />
        </div>
      ) : <EmptyState title="No workflow selected." />}
    </div>
  );
}

function WorkflowLayoutToggle({
  direction,
  onDirectionChange
}: {
  direction: WorkflowLayoutDirection;
  onDirectionChange: (direction: WorkflowLayoutDirection) => void;
}) {
  return (
    <div role="group" aria-label="Workflow layout" className="inline-flex h-8 w-fit overflow-hidden rounded border border-divider-strong bg-background">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        aria-pressed={direction === "horizontal"}
        aria-label="Horizontal workflow layout"
        className={cn("h-8 rounded-none border-0 px-2 text-muted-foreground", direction === "horizontal" && "bg-muted text-foreground")}
        onClick={() => onDirectionChange("horizontal")}
      >
        <Columns3 data-icon="inline-start" />
        Horizontal
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        aria-pressed={direction === "vertical"}
        aria-label="Vertical workflow layout"
        className={cn("h-8 rounded-none border-0 border-l border-divider-strong px-2 text-muted-foreground", direction === "vertical" && "bg-muted text-foreground")}
        onClick={() => onDirectionChange("vertical")}
      >
        <Rows3 data-icon="inline-start" />
        Vertical
      </Button>
    </div>
  );
}
