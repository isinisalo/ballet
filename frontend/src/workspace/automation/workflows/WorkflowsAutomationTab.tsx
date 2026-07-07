import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Agent,
  EventIntakeRequest,
  EventRecord,
  ProjectAutomationConfig,
  ProjectHumanGateResponse,
  ProjectPolicy,
  ProjectWorkflow
} from "@shared/api/workspace-contracts";
import { automationFieldLimits, automationStringValidationMessage, automationTokenValidationMessage } from "@shared/api/automationValidation";
import { actionOutputIds, generatedPolicyId, humanGateResponseId, normalizePolicyToken, projectOutputRouteEventType, policyOutputEventType } from "@shared/policy-actions";
import { EmptyState, TextField } from "@/components/shared/workspace-ui";
import { FieldGroup } from "@/components/ui/field";
import { uniquePolicyAction } from "../automationUtils";
import type { AutomationConfigUpdater } from "../useAutomationDraft";
import { AllWorkflowsCanvas } from "./AllWorkflowsCanvas";
import { WorkflowCanvas } from "./WorkflowCanvas";
import { WorkflowHandlerSheet, type WorkflowHandlerRoute, type WorkflowHandlerSelectionSource } from "./WorkflowHandlerSheet";
import { nextConfigWithWorkflowHandlerAction, nextConfigWithoutWorkflowStepIndexes } from "./workflowActionSheetLogic";
import type { WorkflowStepRecord } from "./workflowGraph";
import { calculateCompositeWorkflowCanvasLayout, type WorkflowCanvasEdge } from "./workflowLayout";
import { workflowOutputTargetsForPolicy } from "./workflowOutputTargets";
import { useWorkflowCanvasInteraction } from "./useWorkflowCanvasInteraction";

const noSelection = "__none__";

type WorkflowHandlerSelection = {
  source: WorkflowHandlerSelectionSource;
  stepIndexes: number[];
};

export function WorkflowsAutomationTab({
  agents,
  projectId,
  config,
  selectedId,
  createDraft,
  showAll = false,
  onCreateDraftChange,
  onSelect,
  updateConfig,
  saveDraft,
  createEvent
}: {
  agents: Agent[];
  projectId: string;
  config: ProjectAutomationConfig;
  selectedId?: string;
  createDraft: ProjectWorkflow;
  showAll?: boolean;
  onCreateDraftChange: (patch: Partial<ProjectWorkflow>) => void;
  onSelect: (id: string) => void;
  updateConfig: AutomationConfigUpdater;
  saveDraft: (nextDraft?: ProjectAutomationConfig) => Promise<boolean>;
  createEvent: (event: EventIntakeRequest) => Promise<EventRecord>;
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
  const workflowIdError = selected ? automationTokenValidationMessage("Workflow ID", selected.id) : undefined;
  const titleError = selected ? automationStringValidationMessage("Title", selected.title, automationFieldLimits.name) : undefined;
  const [selectedHandlerSelection, setSelectedHandlerSelection] = useState<WorkflowHandlerSelection | null>(null);
  const selectedHandlerStepIndexes = selectedHandlerSelection?.stepIndexes ?? [];
  const policyById = useMemo(() => new Map(config.policies.map((policy) => [policy.id, policy])), [config.policies]);
  const actionById = useMemo(() => new Map(config.actions.map((action) => [action.id, action])), [config.actions]);
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
  const workflowStepRecordsByWorkflowId = useMemo<Map<string, WorkflowStepRecord[]>>(() => new Map(config.workflows.map((workflow) => {
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
  })), [config, policyById]);
  const workflowStepRecords: WorkflowStepRecord[] = selected ? workflowStepRecordsByWorkflowId.get(selected.id) ?? [] : [];
  const workflowLayout = useMemo(
    () => selected && !creating
      ? calculateCompositeWorkflowCanvasLayout({
        config,
        selectedWorkflowId: selected.id,
        recordsByWorkflowId: workflowStepRecordsByWorkflowId,
        direction: "horizontal"
      })
      : undefined,
    [config, creating, selected, workflowStepRecordsByWorkflowId]
  );
  const selectedHandlerRecords = selectedHandlerStepIndexes
    .map((stepIndex) => workflowStepRecords.find((record) => record.index === stepIndex))
    .filter((record): record is WorkflowStepRecord => Boolean(record));
  const selectedHandlerRoutes = useMemo(
    () => selectedHandlerRecords
      .map(workflowHandlerRoute)
      .filter((route): route is WorkflowHandlerRoute => Boolean(route)),
    [selectedHandlerRecords]
  );

  useEffect(() => {
    if (foundSelectedIndex >= 0) lastSelectedIndexRef.current = foundSelectedIndex;
  }, [foundSelectedIndex]);

  useEffect(() => {
    setSelectedHandlerSelection(null);
  }, [selected?.id]);

  useEffect(() => {
    if (!selectedHandlerSelection) return;
    if (selectedHandlerRecords.length !== selectedHandlerStepIndexes.length || selectedHandlerRoutes.length === 0) {
      setSelectedHandlerSelection(null);
    }
  }, [selectedHandlerRecords.length, selectedHandlerRoutes.length, selectedHandlerSelection, selectedHandlerStepIndexes.length]);

  const updateSelected = (patch: Partial<ProjectWorkflow>) => {
    if (!selected) return;
    if (creating) {
      onCreateDraftChange(patch.id === undefined ? patch : { ...patch, id: normalizePolicyToken(patch.id) });
      return;
    }
    updateConfig((current) => ({
      ...current,
      workflows: current.workflows.map((workflow, index) => index === selectedIndex ? { ...workflow, ...patch } : workflow)
    }));
    if (patch.id) onSelect(patch.id);
  };

  const updateStep = (workflowId: string, index: number, policyId: string) => {
    if (!selected || workflowId !== selected.id) return;
    updateSelected({ steps: selected.steps.map((step, stepIndex) => stepIndex === index ? policyId : step) });
  };

  const addPolicyStep = (eventType?: string, sourcePolicy?: ProjectPolicy) => {
    if (!selected) return;
    const selectedPolicyIds = new Set(selected.steps);
    const addedStepIndex = selected.steps.length;
    const selectAddedOutputEventStep = () => {
      if (eventType) setSelectedHandlerSelection({ source: "edge", stepIndexes: [addedStepIndex] });
    };
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
      selectAddedOutputEventStep();
      return;
    }
    updateSelected({ steps: [...selected.steps, nextPolicy.id] });
    selectAddedOutputEventStep();
  };

  const reorderStep = (workflowId: string, fromIndex: number, toIndex: number) => {
    if (!selected || workflowId !== selected.id) return;
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= selected.steps.length || toIndex >= selected.steps.length) return;
    const steps = [...selected.steps];
    const [movedStep] = steps.splice(fromIndex, 1);
    steps.splice(toIndex, 0, movedStep);
    updateSelected({ steps });
  };

  const removeHandlerRoute = (workflowId: string, stepIndex: number) => {
    if (!selected || workflowId !== selected.id) return;
    updateConfig((current) => nextConfigWithoutWorkflowStepIndexes(current, selected.id, [stepIndex]));
    setSelectedHandlerSelection((current) => {
      if (!current) return current;
      const stepIndexes = current.stepIndexes.filter((candidate) => candidate !== stepIndex);
      return stepIndexes.length > 0 ? { ...current, stepIndexes } : null;
    });
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
  const clearHandlerSelection = () => setSelectedHandlerSelection(null);
  const selectActionStep = (records: WorkflowStepRecord[]) => {
    setSelectedHandlerSelection({ source: "node", stepIndexes: records.map((record) => record.index) });
  };
  const selectOutputHandler = (edge: WorkflowCanvasEdge) => {
    if (!selected || (edge.route?.handlerWorkflowId ?? selected.id) !== selected.id) return;
    const handlerStepIndex = edge.route?.handlerStepIndex;
    if (handlerStepIndex === undefined) return;
    setSelectedHandlerSelection({ source: "edge", stepIndexes: [handlerStepIndex] });
  };
  const updateHandlerRouteAction = (workflowId: string, stepIndex: number, actionId: string) => {
    if (!selected || workflowId !== selected.id) return;
    updateConfig((current) => nextConfigWithWorkflowHandlerAction(current, selected.id, stepIndex, actionId));
  };
  const submitHumanGateResponse = async (route: WorkflowHandlerRoute, outputId: string, prompt: string) => {
    const policy = config.policies.find((candidate) => candidate.id === route.policyId);
    const action = config.actions.find((candidate) => candidate.id === route.actionId);
    if (!policy || !action?.humanGate || !action.outputIds.includes(outputId)) return;
    const responseBase = {
      workflowId: route.workflowId,
      policyId: route.policyId,
      actionId: route.actionId,
      outputId,
      prompt,
      submittedAt: new Date().toISOString()
    };
    const response: ProjectHumanGateResponse = {
      ...responseBase,
      id: humanGateResponseId(responseBase)
    };
    const nextConfig: ProjectAutomationConfig = {
      ...config,
      humanGateResponses: [
        ...config.humanGateResponses.filter((candidate) => !sameHumanGateResponseTarget(candidate, response)),
        response
      ]
    };
    updateConfig(() => nextConfig);
    const saved = await saveDraft(nextConfig);
    if (!saved) return;
    const eventType = projectOutputRouteEventType(policy, outputId, nextConfig.outputRoutes);
    await createEvent({
      projectId,
      eventType,
      source: "human-gate",
      subject: route.actionId,
      dedupeKey: `human-gate:${response.id}:${response.submittedAt}`,
      tags: ["human-gate"],
      payload: {
        workflow_id: route.workflowId,
        policy_id: route.policyId,
        action: route.actionId,
        output_id: outputId,
        prompt
      },
      body: `Human gate ${route.actionId} selected ${outputId}.\n\n${prompt}`
    });
  };

  if (showAll) return <AllWorkflowsCanvas config={config} />;

  if (!selected) return <EmptyState title="No workflow selected." />;

  if (creating) {
    return (
      <div className="grid gap-4 p-4">
        <FieldGroup>
          <TextField
            label="Workflow ID"
            required
            minLength={automationFieldLimits.token.min}
            maxLength={automationFieldLimits.token.max}
            error={workflowIdError}
            value={selected.id}
            onChange={(id) => updateSelected({ id })}
          />
          <TextField
            label="Title"
            required
            minLength={automationFieldLimits.name.min}
            maxLength={automationFieldLimits.name.max}
            error={titleError}
            value={selected.title}
            onChange={(title) => updateSelected({ title })}
          />
        </FieldGroup>
      </div>
    );
  }

  if (!workflowLayout) return <EmptyState title="No workflow selected." />;

  return (
    <>
      <WorkflowCanvas
        layout={workflowLayout}
        selectedWorkflowId={selected.id}
        policyById={policyById}
        actionById={actionById}
        firstPolicy={policyById.get(selected.steps[0] ?? "")}
        noSelectionValue={noSelection}
        policyOptions={policyOptions}
        actionOptions={actionOptions}
        draggedStepIndex={canvasInteraction.draggedStepIndex}
        dragOverStepIndex={canvasInteraction.dragOverStepIndex}
        selectedActionStepIndexes={selectedHandlerStepIndexes}
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
        onActionStepSelect={selectActionStep}
        onOutputHandlerSelect={selectOutputHandler}
        onAddPolicyStep={addPolicyStep}
      />
      <WorkflowHandlerSheet
        open={selectedHandlerRoutes.length > 0}
        routes={selectedHandlerRoutes}
        selectionSource={selectedHandlerSelection?.source ?? "node"}
        agents={agents}
        config={config}
        onOpenChange={(open, details) => {
          if (!open && (details?.reason === "close-press" || details?.reason === "escape-key")) clearHandlerSelection();
        }}
        onRouteActionChange={updateHandlerRouteAction}
        onRemoveRoute={removeHandlerRoute}
        onOutputHandlerActionChange={updateHandlerRouteAction}
        onHumanGateSubmit={(route, outputId, prompt) => void submitHumanGateResponse(route, outputId, prompt)}
      />
    </>
  );
}

function sameHumanGateResponseTarget(first: ProjectHumanGateResponse, second: ProjectHumanGateResponse) {
  return first.policyId === second.policyId &&
    first.actionId === second.actionId &&
    (first.workflowId ?? "") === (second.workflowId ?? "");
}

function workflowHandlerRoute(record: WorkflowStepRecord): WorkflowHandlerRoute | undefined {
  if (!record.policy) return undefined;
  const eventParts = record.policy.source === "event" ? workflowEventParts(record.policy.event) : undefined;

  return {
    id: `${record.workflowId ?? "workflow"}-${record.index}-${record.policyId}`,
    workflowId: record.workflowId ?? "",
    stepIndex: record.index,
    policyId: record.policyId,
    sourceLabel: record.policy.source === "trigger"
      ? record.policy.trigger || "Missing trigger"
      : eventParts?.sourceLabel ?? "Missing event",
    outputId: eventParts?.outputId,
    eventType: record.policy.source === "event" ? record.policy.event : undefined,
    actionId: record.policy.action
  };
}

function workflowEventParts(eventType: string | undefined) {
  if (!eventType) return undefined;
  const separatorIndex = eventType.lastIndexOf(".");
  if (separatorIndex < 0) return { sourceLabel: eventType };
  return {
    sourceLabel: eventType.slice(0, separatorIndex) || eventType,
    outputId: eventType.slice(separatorIndex + 1) || undefined
  };
}
