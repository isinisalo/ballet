import { useEffect, useState, type ReactNode } from "react";
import type { Agent, AgentExecutionState, LoopScheduleState, LoopTheme, ProjectAutomationConfig, ProjectLoop, ProjectStepTransitionId } from "@shared/api/workspace-contracts";
import { LockKeyhole } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TextField } from "@/components/shared/workspace-ui";
import { insertStepForTransition, removeStep, reorderLoopSteps, replaceStep } from "./loopEditorState";
import { LoopCanvas } from "./LoopCanvas";
import { LoopHandlerAgentInstructions } from "./LoopHandlerAgentInstructions";
import { LoopHandlerSheet } from "./LoopHandlerSheet";
import { LoopStepSheetEditor } from "./LoopStepSheetEditor";
import { LoopThemeField } from "./LoopThemeField";
import { loopIdError } from "./loopFormValidation";
import { loopTheme as resolveLoopTheme } from "./loopTheme";

type Selection = { stepId: string; transition?: ProjectStepTransitionId };

export function LoopCreationEditor({ loop, loops, agents, themes, disabled = false, onChange }: {
  loop: ProjectLoop;
  loops: ProjectLoop[];
  agents: Agent[];
  themes: readonly LoopTheme[];
  disabled?: boolean;
  onChange: (loop: ProjectLoop) => void;
}) {
  const step = loop.steps[0];
  const idError = loopIdError(loop, loops);
  return (
    <div className="grid min-w-0 gap-4 p-4 md:grid-cols-[minmax(14rem,1fr)_minmax(0,2fr)]">
      <div className="grid min-w-0 grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_7.5rem]">
        <TextField label="Loop ID" required value={loop.id} error={idError} disabled={disabled} onChange={(id) => onChange({ ...loop, id })} />
        <LoopThemeField loop={loop} themes={themes} disabled={disabled} onChange={onChange} />
      </div>
      {step ? (
        <LoopStepSheetEditor
          step={step}
          loop={loop}
          loops={loops}
          agents={agents}
          disabled={disabled}
          surface="embedded"
          onChange={(nextStep) => onChange(replaceStep(loop, step.id, nextStep))}
          onRemove={() => undefined}
        />
      ) : null}
    </div>
  );
}

export function LoopEditor({
  config,
  loop,
  loops,
  agents,
  agentExecutionStates,
  themes,
  scheduleState,
  locked,
  disabled = false,
  lockMessage,
  canvasControls,
  onChange
}: {
  config: ProjectAutomationConfig;
  loop: ProjectLoop;
  loops: ProjectLoop[];
  agents: Agent[];
  agentExecutionStates?: AgentExecutionState[];
  themes: readonly LoopTheme[];
  scheduleState?: LoopScheduleState;
  locked: boolean;
  disabled?: boolean;
  lockMessage?: string;
  canvasControls?: ReactNode;
  onChange: (loop: ProjectLoop) => void;
}) {
  const [selection, setSelection] = useState<Selection | null>(null);
  const selectedStep = loop.steps.find((step) => step.id === selection?.stepId);
  const editingDisabled = locked || disabled;
  const controls = canvasControls ? <div className="flex items-center gap-2">{canvasControls}</div> : undefined;

  useEffect(() => setSelection(null), [loop.id]);
  useEffect(() => {
    if (!selection || selectedStep) return;
    setSelection(null);
  }, [selectedStep, selection]);

  return (
    <div className="grid min-w-0 gap-0">
      {locked ? (
        <Alert className="m-4 mb-0 rounded-lg border-tertiary/40 text-tertiary">
          <LockKeyhole />
          <AlertDescription>{lockMessage ?? "This loop has an active run. Editing is locked until it finishes or is cancelled."}</AlertDescription>
        </Alert>
      ) : null}
      <div
        role="region"
        aria-label="Loop canvas workspace"
        className={selectedStep ? "grid min-h-[28rem] min-w-0 grid-cols-1 overflow-hidden md:grid-cols-2" : "grid min-h-[28rem] min-w-0 grid-cols-1 overflow-hidden"}
      >
        <LoopCanvas
          config={config}
          loop={loop}
          agents={agents}
          agentExecutionStates={agentExecutionStates}
          theme={resolveLoopTheme(loop.theme, themes)}
          selectedStepId={selectedStep?.id}
          readOnly={false}
          canvasControls={controls}
          onStepSelect={(stepId) => setSelection({ stepId })}
          onTransitionSelect={(stepId, transition) => setSelection({ stepId, transition })}
          onInsertStep={(stepId, result) => {
            if (editingDisabled) return;
            const next = insertStepForTransition(loop, stepId, result, agents);
            onChange(next);
            const inserted = next.steps.find((step) => !loop.steps.some((candidate) => candidate.id === step.id));
            if (inserted) setSelection({ stepId: inserted.id });
          }}
          onReorderStep={(fromIndex, toIndex) => {
            if (!editingDisabled) onChange(reorderLoopSteps(loop, fromIndex, toIndex));
          }}
        />
        <LoopHandlerSheet
          open={Boolean(selectedStep)}
          title={selection?.transition ? "Transition editor" : "Step editor"}
          onOpenChange={(open) => { if (!open) setSelection(null); }}
          left={selectedStep ? <LoopHandlerAgentInstructions step={selectedStep} agents={agents} /> : null}
          right={selectedStep ? (
            <LoopStepSheetEditor
              step={selectedStep}
              loop={loop}
              loops={loops}
              agents={agents}
              scheduleState={selectedStep.type === "scheduled" ? scheduleState : undefined}
              disabled={editingDisabled}
              focusedTransition={selection?.transition}
              onChange={(step) => {
                const previousId = selectedStep.id;
                onChange(replaceStep(loop, previousId, step));
                if (step.id !== previousId) setSelection((current) => current ? { ...current, stepId: step.id } : current);
              }}
              onRemove={() => {
                onChange(removeStep(loop, selectedStep.id));
                setSelection(null);
              }}
            />
          ) : null}
        />
      </div>
    </div>
  );
}
