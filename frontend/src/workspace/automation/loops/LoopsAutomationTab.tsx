import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Agent,
  EventIntakeRequest,
  EventRecord,
  ProjectAutomationConfig,
  ProjectHumanGateResponse,
  ProjectPolicy,
  ProjectLoop
} from "@shared/api/workspace-contracts";
import { actionOutputIds, generatedPolicyId, humanGateResponseId, normalizePolicyToken, projectOutputRouteEventType, policyOutputEventType, loopIdForPolicy } from "@shared/policy-actions";
import { EmptyState, SelectField } from "@/components/shared/workspace-ui";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { uniquePolicyAction } from "../automationUtils";
import type { AutomationConfigUpdater } from "../useAutomationDraft";
import { AllLoopsCanvas } from "./AllLoopsCanvas";
import { LoopCanvas } from "./LoopCanvas";
import { LoopHandlerSheet, type LoopHandlerRoute, type LoopHandlerSelectionSource } from "./LoopHandlerSheet";
import { nextConfigWithLoopHandlerAction, nextConfigWithoutLoopStepIndexes } from "./loopActionSheetLogic";
import type { LoopStepRecord } from "./loopGraph";
import { calculateCompositeLoopCanvasLayout, type LoopCanvasEdge } from "./loopLayout";
import { loopOutputTargetsForPolicy } from "./loopOutputTargets";
import { useLoopCanvasInteraction } from "./useLoopCanvasInteraction";

const noSelection = "__none__";

type LoopHandlerSelection = {
  source: LoopHandlerSelectionSource;
  stepIndexes: number[];
};

export function LoopsAutomationTab({
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
  createDraft: ProjectLoop;
  showAll?: boolean;
  onCreateDraftChange: (patch: Partial<ProjectLoop>) => void;
  onSelect: (id: string) => void;
  updateConfig: AutomationConfigUpdater;
  saveDraft: (nextDraft?: ProjectAutomationConfig) => Promise<boolean>;
  createEvent: (event: EventIntakeRequest) => Promise<EventRecord>;
}) {
  const foundSelectedIndex = config.loops.findIndex((loop) => loop.id === selectedId);
  const lastSelectedIndexRef = useRef<number | undefined>(foundSelectedIndex >= 0 ? foundSelectedIndex : undefined);
  const selectedIndex = foundSelectedIndex >= 0
    ? foundSelectedIndex
    : selectedId && lastSelectedIndexRef.current !== undefined
      ? Math.min(lastSelectedIndexRef.current, Math.max(0, config.loops.length - 1))
      : -1;
  const selected = selectedIndex >= 0 ? config.loops[selectedIndex] : createDraft;
  const creating = selectedIndex < 0;
  const [selectedHandlerSelection, setSelectedHandlerSelection] = useState<LoopHandlerSelection | null>(null);
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
  const usedStartingPolicyIds = useMemo(() => {
    const ids = new Set<string>();
    config.loops.forEach((loop) => {
      const firstPolicy = policyById.get(loop.steps[0] ?? "");
      if (firstPolicy?.source === "trigger") ids.add(firstPolicy.id);
    });
    return ids;
  }, [config.loops, policyById]);
  const availableStartingTriggerPolicies = useMemo(() => config.policies.filter((policy) =>
    policy.source === "trigger" &&
    Boolean(policy.trigger) &&
    (!usedStartingPolicyIds.has(policy.id) || createDraft.steps[0] === policy.id)
  ), [config.policies, createDraft.steps, usedStartingPolicyIds]);
  const startingTriggerOptions = availableStartingTriggerPolicies.map((policy) => ({
    value: policy.id,
    label: policy.trigger ? `${policy.trigger} · ${policy.action}` : policy.id
  }));
  const defaultAction = config.actions[0]?.id ?? "";
  const selectedActionOutputIds = (actionId: string) => actionOutputIds(config.actions, actionId);
  const loopStepRecordsByLoopId = useMemo<Map<string, LoopStepRecord[]>>(() => new Map(config.loops.map((loop) => {
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
  })), [config, policyById]);
  const loopStepRecords: LoopStepRecord[] = selected ? loopStepRecordsByLoopId.get(selected.id) ?? [] : [];
  const loopLayout = useMemo(
    () => selected && !creating
      ? calculateCompositeLoopCanvasLayout({
        config,
        selectedLoopId: selected.id,
        recordsByLoopId: loopStepRecordsByLoopId,
        direction: "horizontal"
      })
      : undefined,
    [config, creating, selected, loopStepRecordsByLoopId]
  );
  const selectedHandlerRecords = selectedHandlerStepIndexes
    .map((stepIndex) => loopStepRecords.find((record) => record.index === stepIndex))
    .filter((record): record is LoopStepRecord => Boolean(record));
  const selectedHandlerRoutes = useMemo(
    () => selectedHandlerRecords
      .map(loopHandlerRoute)
      .filter((route): route is LoopHandlerRoute => Boolean(route)),
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

  const updateSelected = (patch: Partial<ProjectLoop>) => {
    if (!selected) return;
    if (creating) {
      onCreateDraftChange(patch);
      return;
    }
    const nextLoopBase = { ...selected, ...patch };
    const derivedId = loopIdForPolicy(policyById.get(nextLoopBase.steps[0] ?? ""));
    const nextLoop = derivedId && derivedId !== selected.id
      ? { ...nextLoopBase, id: derivedId }
      : nextLoopBase;
    updateConfig((current) => {
      const currentLoop = current.loops[selectedIndex];
      if (!currentLoop) return current;
      return {
        ...current,
        loops: current.loops.map((loop, index) => index === selectedIndex ? nextLoop : loop),
        humanGateResponses: nextLoop.id === currentLoop.id
          ? current.humanGateResponses
          : current.humanGateResponses.map((response) => {
            if (response.loopId !== currentLoop.id) return response;
            const nextResponse = { ...response, loopId: nextLoop.id };
            return { ...nextResponse, id: humanGateResponseId(nextResponse) };
          })
      };
    });
    if (nextLoop.id !== selected.id) onSelect(nextLoop.id);
  };

  const updateStep = (loopId: string, index: number, policyId: string) => {
    if (!selected || loopId !== selected.id) return;
    updateSelected({ steps: selected.steps.map((step, stepIndex) => stepIndex === index ? policyId : step) });
  };

  const addPolicyStep = (eventType?: string, sourcePolicy?: ProjectPolicy) => {
    if (!selected) return;
    const selectedPolicyIds = new Set(selected.steps);
    const addedStepIndex = selected.steps.length;
    const scopedEventType = eventType ? loopScopedEventType(eventType, selected.id) : undefined;
    const selectAddedOutputEventStep = () => {
      if (scopedEventType) setSelectedHandlerSelection({ source: "edge", stepIndexes: [addedStepIndex] });
    };
    const eventOutputId = scopedEventType?.split(".").at(-1) ?? "";
    const isDoneEvent = normalizePolicyToken(eventOutputId) === "done";
    const nextPolicy = scopedEventType
      ? config.policies.find((policy) =>
        policy.source === "event" &&
        policy.event === scopedEventType &&
        (!isDoneEvent || policy.action === "done") &&
        !selectedPolicyIds.has(policy.id)
      )
      : config.policies.find((policy) => !selectedPolicyIds.has(policy.id)) ?? config.policies[0];
    if (!nextPolicy) {
      const baseAction = sourcePolicy?.action || defaultAction;
      if (!baseAction) return;
      const generatedEvent = scopedEventType || policyOutputEventType({ action: baseAction, loopId: selected.id }, selectedActionOutputIds(baseAction)[0] ?? "");
      const action = isDoneEvent ? "done" : uniquePolicyAction(generatedEvent, baseAction, config.policies, selected.id);
      const outputIds = selectedActionOutputIds(action);
      const generatedPolicy: ProjectPolicy = {
        id: generatedPolicyId({
          loopId: selected.id,
          source: "event",
          event: generatedEvent,
          action
        }),
        loopId: selected.id,
        source: "event",
        event: generatedEvent,
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
        loops: current.loops.map((loop) => loop.id === selected.id ? { ...loop, steps: [...loop.steps, generatedPolicy.id] } : loop)
      }));
      selectAddedOutputEventStep();
      return;
    }
    updateSelected({ steps: [...selected.steps, nextPolicy.id] });
    selectAddedOutputEventStep();
  };

  const reorderStep = (loopId: string, fromIndex: number, toIndex: number) => {
    if (!selected || loopId !== selected.id) return;
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= selected.steps.length || toIndex >= selected.steps.length) return;
    const steps = [...selected.steps];
    const [movedStep] = steps.splice(fromIndex, 1);
    steps.splice(toIndex, 0, movedStep);
    updateSelected({ steps });
  };

  const removeHandlerRoute = (loopId: string, stepIndex: number) => {
    if (!selected || loopId !== selected.id) return;
    updateConfig((current) => nextConfigWithoutLoopStepIndexes(current, selected.id, [stepIndex]));
    setSelectedHandlerSelection((current) => {
      if (!current) return current;
      const stepIndexes = current.stepIndexes.filter((candidate) => candidate !== stepIndex);
      return stepIndexes.length > 0 ? { ...current, stepIndexes } : null;
    });
  };

  const canvasInteraction = useLoopCanvasInteraction({
    selectedId: selected?.id,
    reorderStep
  });

  const canAddFirstPolicy = Boolean(defaultAction);
  const canAddPolicyForEvent = (policy?: ProjectPolicy) => {
    const action = policy?.action || defaultAction;
    return Boolean(action && selectedActionOutputIds(action).length > 0);
  };
  const clearHandlerSelection = () => setSelectedHandlerSelection(null);
  const selectActionStep = (records: LoopStepRecord[]) => {
    setSelectedHandlerSelection({ source: "node", stepIndexes: records.map((record) => record.index) });
  };
  const selectOutputHandler = (edge: LoopCanvasEdge) => {
    if (!selected || (edge.route?.handlerLoopId ?? selected.id) !== selected.id) return;
    const handlerStepIndex = edge.route?.handlerStepIndex;
    if (handlerStepIndex === undefined) return;
    setSelectedHandlerSelection({ source: "edge", stepIndexes: [handlerStepIndex] });
  };
  const updateHandlerRouteAction = (loopId: string, stepIndex: number, actionId: string) => {
    if (!selected || loopId !== selected.id) return;
    updateConfig((current) => nextConfigWithLoopHandlerAction(current, selected.id, stepIndex, actionId));
  };
  const submitHumanGateResponse = async (route: LoopHandlerRoute, outputId: string, prompt: string) => {
    const policy = config.policies.find((candidate) => candidate.id === route.policyId);
    const action = config.actions.find((candidate) => candidate.id === route.actionId);
    if (!policy || !action?.humanGate || !action.outputIds.includes(outputId)) return;
    const responseBase = {
      loopId: route.loopId,
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
    const eventType = projectOutputRouteEventType(policy, outputId, nextConfig.outputRoutes, nextConfig.actions, nextConfig.policies);
    await createEvent({
      projectId,
      eventType,
      source: "human-gate",
      subject: route.actionId,
      dedupeKey: `human-gate:${response.id}:${response.submittedAt}`,
      tags: ["human-gate"],
      payload: {
        loop_id: route.loopId,
        policy_id: route.policyId,
        action: route.actionId,
        output_id: outputId,
        prompt
      },
      body: `Human gate ${route.actionId} selected ${outputId}.\n\n${prompt}`
    });
  };

  if (showAll) return <AllLoopsCanvas config={config} />;

  if (!selected) return <EmptyState title="No loop selected." />;

  if (creating) {
    const selectedStartingPolicyId = selected.steps[0] ?? "";
    const selectedStartingPolicy = policyById.get(selectedStartingPolicyId);
    const derivedLoopId = loopIdForPolicy(selectedStartingPolicy);
    if (startingTriggerOptions.length === 0) {
      return (
        <div className="p-4">
          <EmptyState title="No unused starting triggers." action="Create a trigger policy before adding a loop." />
        </div>
      );
    }
    return (
      <div className="grid gap-4 p-4">
        <FieldGroup>
          <SelectField
            label="Starting trigger"
            value={selectedStartingPolicyId || startingTriggerOptions[0]?.value || noSelection}
            options={startingTriggerOptions}
            onChange={(policyId) => updateSelected({ steps: [policyId] })}
          />
          <Field className="gap-1.5">
            <FieldLabel>Derived ID</FieldLabel>
            <div className="min-h-9 rounded border border-input bg-muted/30 px-3 py-2 font-mono text-xs text-muted-foreground">
              {derivedLoopId || "Select a starting trigger"}
            </div>
          </Field>
        </FieldGroup>
      </div>
    );
  }

  if (!loopLayout) return <EmptyState title="No loop selected." />;

  return (
    <>
      <LoopCanvas
        layout={loopLayout}
        selectedLoopId={selected.id}
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
        loopCanvasRef={canvasInteraction.loopCanvasRef}
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
      <LoopHandlerSheet
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

function loopScopedEventType(eventType: string, loopId: string) {
  return eventType.startsWith(`${loopId}.`) || eventType.includes(".loop.") || eventType.startsWith("trigger.")
    ? eventType
    : `${loopId}.${eventType}`;
}

function sameHumanGateResponseTarget(first: ProjectHumanGateResponse, second: ProjectHumanGateResponse) {
  return first.policyId === second.policyId &&
    first.actionId === second.actionId &&
    (first.loopId ?? "") === (second.loopId ?? "");
}

function loopHandlerRoute(record: LoopStepRecord): LoopHandlerRoute | undefined {
  if (!record.policy) return undefined;
  const eventParts = record.policy.source === "event" ? loopEventParts(record.policy.event) : undefined;

  return {
    id: `${record.loopId ?? "loop"}-${record.index}-${record.policyId}`,
    loopId: record.loopId ?? "",
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

function loopEventParts(eventType: string | undefined) {
  if (!eventType) return undefined;
  const separatorIndex = eventType.lastIndexOf(".");
  if (separatorIndex < 0) return { sourceLabel: eventType };
  return {
    sourceLabel: eventType.slice(0, separatorIndex) || eventType,
    outputId: eventType.slice(separatorIndex + 1) || undefined
  };
}
