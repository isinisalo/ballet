import { useEffect, useState, type ReactNode } from "react";
import type { ExecutionProfile, LocalRuntime, LoopScheduleState, LoopTheme, ProjectAutomationConfig, ProjectInstruction, ProjectLoop, ProjectStepTransitionId, Skill } from "@shared/api/workspace-contracts";
import { LockKeyhole } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TextField } from "@/components/shared/workspace-ui";
import { addFirstStep, removeStep, reorderLoopSteps, replaceNode } from "./loopEditorState";
import { LoopCanvas } from "./LoopCanvas";
import { StepCompositionPreview } from "./StepCompositionPreview";
import { LoopHandlerSheet } from "./LoopHandlerSheet";
import { LoopNodeSheetEditor } from "./LoopStepSheetEditor";
import { loopIdError } from "./loopFormValidation";

type Selection = { stepId: string; transition?: ProjectStepTransitionId };

export function LoopEditor({
  config, loop, loops, executionProfiles, instructions, skills, runtime, theme, scheduleState, locked,
  disabled = false, creation = false, lockMessage, canvasControls, onChange
}: {
  config: ProjectAutomationConfig;
  loop: ProjectLoop;
  loops: ProjectLoop[];
  executionProfiles: ExecutionProfile[];
  instructions: ProjectInstruction[];
  skills: Skill[];
  runtime: LocalRuntime;
  theme: LoopTheme;
  scheduleState?: LoopScheduleState;
  locked: boolean;
  disabled?: boolean;
  creation?: boolean;
  lockMessage?: string;
  canvasControls?: ReactNode;
  onChange: (loop: ProjectLoop) => void;
}) {
  const [selection, setSelection] = useState<Selection | null>(null);
  const selectedStep = loop.nodes.find((node) => node.id === selection?.stepId);
  const editingDisabled = locked || disabled;
  const selectionScope = creation ? "new-loop" : loop.id;

  useEffect(() => setSelection(null), [selectionScope]);
  useEffect(() => {
    if (!selection || selectedStep) return;
    setSelection(null);
  }, [selectedStep, selection]);

  const insertFirstStep = () => {
    if (editingDisabled) return;
    const next = addFirstStep(loop);
    const step = next.nodes.find((node) => node.type === "agent" || node.type === "human" || node.type === "scheduled");
    onChange(next);
    if (step) setSelection({ stepId: step.id });
  };

  return (
    <div className="grid min-w-0 gap-0">
      {locked ? <LoopLockedAlert message={lockMessage} /> : null}
      <div
        role="region"
        aria-label="Loop canvas workspace"
        className={selectedStep ? "grid min-h-[28rem] min-w-0 grid-cols-1 overflow-hidden md:grid-cols-2" : "grid min-h-[28rem] min-w-0 grid-cols-1 overflow-hidden"}
      >
        <LoopCanvas
          config={config}
          loop={loop}
          executionProfiles={executionProfiles}
          runtime={runtime}
          theme={theme}
          selectedStepId={selectedStep?.id}
          readOnly={false}
          canvasControls={canvasControls}
          onAddFirstStep={insertFirstStep}
          onStepSelect={(stepId) => setSelection({ stepId })}
          onTransitionSelect={(stepId, transition) => setSelection({ stepId, transition })}
          onReorderStep={(fromIndex, toIndex) => {
            if (!editingDisabled) onChange(reorderLoopSteps(loop, fromIndex, toIndex));
          }}
        />
        <LoopHandlerSheet
          open={Boolean(selectedStep)}
          title={selection?.transition ? "Transition editor" : creation ? "Loop definition" : "Node editor"}
          header={creation ? <LoopIdentityHeader loop={loop} loops={loops} disabled={editingDisabled} onChange={onChange} /> : undefined}
          onOpenChange={(open) => { if (!open) setSelection(null); }}
          left={selectedStep ? <StepCompositionPreview step={selectedStep} profiles={executionProfiles} instructions={instructions} skills={skills} runtime={runtime} /> : null}
          right={selectedStep ? (
            <LoopNodeSheetEditor
              step={selectedStep}
              loop={loop}
              loops={loops}
              executionProfiles={executionProfiles}
              instructions={instructions}
              skills={skills}
              runtime={runtime}
              scheduleState={selectedStep.type === "scheduled" ? scheduleState : undefined}
              disabled={editingDisabled}
              focusedTransition={selection?.transition}
              onChange={(step) => {
                const previousId = selectedStep.id;
                onChange(replaceNode(loop, previousId, step));
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

function LoopIdentityHeader({ loop, loops, disabled, onChange }: {
  loop: ProjectLoop;
  loops: ProjectLoop[];
  disabled: boolean;
  onChange: (loop: ProjectLoop) => void;
}) {
  return (
    <div className="p-3">
      <TextField label="Loop ID" density="compact" required value={loop.id} error={loopIdError(loop, loops)} disabled={disabled} onChange={(id) => onChange({ ...loop, id })} />
    </div>
  );
}

function LoopLockedAlert({ message }: { message?: string }) {
  return (
    <Alert className="m-4 mb-0 rounded-lg border-tertiary/40 text-tertiary">
      <LockKeyhole />
      <AlertDescription>{message ?? "This loop has an active run. Editing is locked until it finishes or is cancelled."}</AlertDescription>
    </Alert>
  );
}
