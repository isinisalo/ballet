import { useEffect, useState, type ReactNode } from "react";
import type { Agent, ProjectAutomationConfig, ProjectLoop } from "@shared/api/workspace-contracts";
import { LockKeyhole } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TextField } from "@/components/shared/workspace-ui";
import { insertStepForTransition, removeStep, reorderLoopSteps, replaceStep } from "./loopEditorState";
import { LoopCanvas } from "./LoopCanvas";
import { LoopHandlerAgentInstructions } from "./LoopHandlerAgentInstructions";
import { LoopHandlerSheet } from "./LoopHandlerSheet";
import { LoopStepSheetEditor } from "./LoopStepSheetEditor";

type Selection = { stepId: string; transition?: "approved" | "rejected" };

export function LoopCreationEditor({ loop, loops, agents, onChange }: {
  loop: ProjectLoop;
  loops: ProjectLoop[];
  agents: Agent[];
  onChange: (loop: ProjectLoop) => void;
}) {
  const step = loop.steps[0];
  return (
    <div className="grid min-w-0 gap-4 p-4 md:grid-cols-[minmax(14rem,1fr)_minmax(0,2fr)]">
      <TextField label="Loop ID" required value={loop.id} onChange={(id) => onChange({ ...loop, id })} />
      {step ? (
        <LoopStepSheetEditor
          step={step}
          loop={loop}
          loops={loops}
          agents={agents}
          disabled={false}
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
  locked,
  lockMessage,
  canvasControls,
  onChange
}: {
  config: ProjectAutomationConfig;
  loop: ProjectLoop;
  loops: ProjectLoop[];
  agents: Agent[];
  locked: boolean;
  lockMessage?: string;
  canvasControls?: ReactNode;
  onChange: (loop: ProjectLoop) => void;
}) {
  const [selection, setSelection] = useState<Selection | null>(null);
  const selectedStep = loop.steps.find((step) => step.id === selection?.stepId);

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
          selectedStepId={selectedStep?.id}
          readOnly={false}
          canvasControls={canvasControls}
          onStepSelect={(stepId) => setSelection({ stepId })}
          onTransitionSelect={(stepId, transition) => setSelection({ stepId, transition })}
          onInsertStep={(stepId, result) => {
            if (locked) return;
            const next = insertStepForTransition(loop, stepId, result, agents);
            onChange(next);
            const inserted = next.steps.find((step) => !loop.steps.some((candidate) => candidate.id === step.id));
            if (inserted) setSelection({ stepId: inserted.id });
          }}
          onReorderStep={(fromIndex, toIndex) => {
            if (!locked) onChange(reorderLoopSteps(loop, fromIndex, toIndex));
          }}
        />
        <LoopHandlerSheet
          open={Boolean(selectedStep)}
          title={selection?.transition ? "Transition editor" : "Step editor"}
          onOpenChange={(open) => { if (!open) setSelection(null); }}
          left={selectedStep ? <LoopHandlerAgentInstructions step={selectedStep} agents={agents} config={config} /> : null}
          right={selectedStep ? (
            <LoopStepSheetEditor
              step={selectedStep}
              loop={loop}
              loops={loops}
              agents={agents}
              disabled={locked}
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
