import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Agent,
  EventIntakeRequest,
  EventRecord,
  ProjectAutomationConfig,
  ProjectHumanGateResponse,
  ProjectAction,
  ProjectLoop
} from "@shared/api/workspace-contracts";
import { actionOutputEventType, actionOutputIds, humanGateResponseId } from "@shared/policy-actions";
import { EmptyState, SelectField, TextField } from "@/components/shared/workspace-ui";
import { FieldGroup } from "@/components/ui/field";
import type { AutomationConfigUpdater } from "../useAutomationDraft";
import { AllLoopsCanvas } from "./AllLoopsCanvas";
import { LoopCanvas } from "./LoopCanvas";
import { LoopHandlerSheet, type LoopHandlerRoute, type LoopHandlerSelectionSource } from "./LoopHandlerSheet";
import {
  nextConfigWithLoopHandlerAction,
  nextConfigWithLoopOutputRouteTarget,
  nextConfigWithPendingLoopOutputHandlerAction,
  nextConfigWithoutLoopOutputRouteTarget,
  nextConfigWithoutLoopStepIndexes
} from "./loopActionSheetLogic";
import type { LoopStepRecord } from "./loopGraph";
import {
  loopEventParts,
  loopHandlerRoute,
  pendingLoopHandlerRoute,
  type PendingLoopHandlerOutput
} from "./loopHandlerRoutes";
import { calculateCompositeLoopCanvasLayout, type LoopCanvasEdge } from "./loopLayout";
import { loopOutputTargetsForPolicy } from "./loopOutputTargets";
import { useLoopCanvasInteraction } from "./useLoopCanvasInteraction";

const noSelection = "__none__";

type LoopHandlerSelection = {
  source: LoopHandlerSelectionSource;
  stepIndexes: number[];
  pendingOutput?: PendingLoopHandlerOutput;
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
  const actionById = useMemo(() => new Map(config.actions.map((action) => [action.id, action])), [config.actions]);
  const startingActionOptions = config.actions.map((action) => ({
    value: action.id,
    label: action.description ? `${action.id} · ${action.description}` : action.id
  }));
  const defaultAction = config.actions[0]?.id ?? "";
  const selectedActionOutputIds = (actionId: string) => actionOutputIds(config.actions, actionId);
  const loopStepRecordsByLoopId = useMemo<Map<string, LoopStepRecord[]>>(() => new Map(config.loops.map((loop) => {
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
  })), [config, actionById]);
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
    () => selectedHandlerSelection?.pendingOutput && selected
      ? [pendingLoopHandlerRoute(selected.id, selected.steps.length, selectedHandlerSelection.pendingOutput)]
      : selectedHandlerRecords
        .map(loopHandlerRoute)
        .filter((route): route is LoopHandlerRoute => Boolean(route)),
    [selected, selectedHandlerRecords, selectedHandlerSelection?.pendingOutput]
  );

  useEffect(() => {
    if (foundSelectedIndex >= 0) lastSelectedIndexRef.current = foundSelectedIndex;
  }, [foundSelectedIndex]);

  useEffect(() => {
    setSelectedHandlerSelection(null);
  }, [selected?.id]);

  useEffect(() => {
    if (!selectedHandlerSelection) return;
    if (selectedHandlerSelection.pendingOutput) return;
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
    const nextLoop = nextLoopBase;
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

  const addActionStep = (eventType?: string, sourceAction?: ProjectAction) => {
    if (!selected) return;
    const eventParts = loopEventParts(eventType);
    if (eventType && sourceAction && eventParts?.outputId) {
      setSelectedHandlerSelection({
        source: "edge",
        stepIndexes: [],
        pendingOutput: {
          eventType,
          sourceActionId: sourceAction.id,
          sourceLabel: eventParts.sourceLabel,
          outputId: eventParts.outputId
        }
      });
      return;
    }
    const selectedActionIds = new Set(selected.steps);
    const nextAction = config.actions.find((action) => !selectedActionIds.has(action.id)) ?? config.actions[0];
    if (!nextAction) return;
    const shouldAppendStep = !selected.steps.includes(nextAction.id);
    if (shouldAppendStep) updateSelected({ steps: [...selected.steps, nextAction.id] });
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

  const canAddFirstAction = Boolean(defaultAction);
  const canAddActionForEvent = (sourceAction?: ProjectAction) => {
    const actionId = sourceAction?.id || defaultAction;
    return Boolean(actionId && selectedActionOutputIds(actionId).length > 0);
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
    const pendingOutput = selectedHandlerSelection?.pendingOutput;
    if (pendingOutput) {
      updateConfig((current) =>
        nextConfigWithPendingLoopOutputHandlerAction(
          current,
          selected.id,
          stepIndex,
          actionId,
          pendingOutput.sourceActionId,
          pendingOutput.outputId
        )
      );
      setSelectedHandlerSelection({ source: "edge", stepIndexes: [stepIndex] });
      return;
    }
    updateConfig((current) => nextConfigWithLoopHandlerAction(current, selected.id, stepIndex, actionId));
  };
  const updateOutputHandlerRoute = (
    sourceLoopId: string,
    sourceActionId: string,
    outputId: string,
    targetLoopId: string,
    targetActionId: string
  ) => {
    updateConfig((current) =>
      nextConfigWithLoopOutputRouteTarget(current, sourceLoopId, sourceActionId, outputId, targetLoopId, targetActionId)
    );
  };
  const clearOutputHandlerRoute = (sourceLoopId: string, sourceActionId: string, outputId: string) => {
    updateConfig((current) =>
      nextConfigWithoutLoopOutputRouteTarget(current, sourceLoopId, sourceActionId, outputId)
    );
  };
  const submitHumanGateResponse = async (route: LoopHandlerRoute, outputId: string, prompt: string) => {
    const action = config.actions.find((candidate) => candidate.id === route.actionId);
    if (!action?.humanGate || !actionOutputIds(config.actions, action.id).includes(outputId)) return;
    const responseBase = {
      loopId: route.loopId,
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
    const eventType = actionOutputEventType({ loopId: route.loopId, actionId: action.id }, outputId);
    await createEvent({
      projectId,
      eventType,
      source: "human-gate",
      subject: route.actionId,
      dedupeKey: `human-gate:${response.id}:${response.submittedAt}`,
      tags: ["human-gate"],
      payload: {
        loop_id: route.loopId,
        action_id: route.actionId,
        action: route.actionLabel,
        output_id: outputId,
        prompt
      },
      body: `Human gate ${route.actionLabel} selected ${outputId}.\n\n${prompt}`
    });
  };

  if (showAll) return <AllLoopsCanvas config={config} />;

  if (!selected) return <EmptyState title="No loop selected." />;

  if (creating) {
    const selectedStartingActionId = selected.steps[0] ?? "";
    if (startingActionOptions.length === 0) {
      return (
        <div className="p-4">
          <EmptyState title="No actions configured." action="Create an action before adding a loop." />
        </div>
      );
    }
    return (
      <div className="grid gap-4 p-4">
        <FieldGroup>
          <TextField
            label="Loop ID"
            required
            value={selected.id}
            onChange={(id) => updateSelected({ id })}
          />
          <SelectField
            label="Starting action"
            value={selectedStartingActionId || startingActionOptions[0]?.value || noSelection}
            options={startingActionOptions}
            onChange={(actionId) => updateSelected({ steps: [actionId] })}
          />
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
        actionById={actionById}
        draggedStepIndex={canvasInteraction.draggedStepIndex}
        dragOverStepIndex={canvasInteraction.dragOverStepIndex}
        selectedActionStepIndexes={selectedHandlerStepIndexes}
        canvasHeight={canvasInteraction.canvasHeight}
        isCanvasPanning={canvasInteraction.isCanvasPanning}
        loopCanvasRef={canvasInteraction.loopCanvasRef}
        canAddFirstAction={canAddFirstAction}
        canAddActionForEvent={canAddActionForEvent}
        onStepPointerDown={canvasInteraction.handleStepPointerDown}
        onStepPointerMove={canvasInteraction.handleStepPointerMove}
        onStepPointerUp={canvasInteraction.handleStepPointerUp}
        onStepPointerCancel={canvasInteraction.resetStepDrag}
        onCanvasMoveStart={canvasInteraction.handleCanvasMoveStart}
        onCanvasMoveEnd={canvasInteraction.handleCanvasMoveEnd}
        onActionStepSelect={selectActionStep}
        onOutputHandlerSelect={selectOutputHandler}
        onAddActionStep={addActionStep}
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
        onOutputHandlerRouteChange={updateOutputHandlerRoute}
        onOutputHandlerRouteClear={clearOutputHandlerRoute}
        onHumanGateSubmit={(route, outputId, prompt) => void submitHumanGateResponse(route, outputId, prompt)}
      />
    </>
  );
}

function sameHumanGateResponseTarget(first: ProjectHumanGateResponse, second: ProjectHumanGateResponse) {
  return first.actionId === second.actionId &&
    (first.loopId ?? "") === (second.loopId ?? "");
}
