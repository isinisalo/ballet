import { useId } from "react";
import type { Agent, LoopScheduleState, ProjectLoop, ProjectStep, ProjectStepTransitionId } from "@shared/api/workspace-contracts";
import { isProjectExecutableStep } from "@shared/api/workspace-contracts";
import { ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LoopEditorSelect, compactLoopControl } from "./LoopEditorSelect";
import { LoopScheduleEditor } from "./LoopScheduleEditor";
import { LoopTransitionsEditor } from "./LoopTransitionsEditor";
import { canChangeStepToScheduled, canRemoveStep, changeStepType } from "./loopEditorState";

export function LoopStepSheetEditor({ step, loop, loops, agents, scheduleState, disabled, focusedTransition, onChange, onRemove }: {
  step: ProjectStep;
  loop: ProjectLoop;
  loops: ProjectLoop[];
  agents: Agent[];
  scheduleState?: LoopScheduleState;
  disabled: boolean;
  focusedTransition?: ProjectStepTransitionId;
  onChange: (step: ProjectStep) => void;
  onRemove: () => void;
}) {
  const id = useId();
  const typeOptions = [
    { value: "agent", label: "Agent" },
    { value: "human", label: "Human" },
    ...(step.type === "scheduled" || canChangeStepToScheduled(loop, step.id) ? [{ value: "scheduled", label: "Scheduled" }] : [])
  ];
  const scheduleTargets = loop.steps.filter((candidate) => candidate.id !== step.id && isProjectExecutableStep(candidate)).map((candidate) => ({ value: candidate.id, label: candidate.id }));

  return (
    <section aria-label="Step editor" className="min-w-0 overflow-y-auto px-3 pt-9 pb-2.5 text-xs">
      <FieldGroup className="gap-3">
        <Field className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2">
          <FieldLabel htmlFor={`${id}-step`} className="text-xs font-normal text-muted-foreground">Step</FieldLabel>
          <Input id={`${id}-step`} aria-label="Step ID" value={step.id} disabled={disabled} className={`${compactLoopControl} border-primary/50 bg-primary/10 text-primary`} onChange={(event) => onChange({ ...step, id: event.target.value } as ProjectStep)} />
        </Field>
        <Field className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2">
          <FieldLabel className="text-xs font-normal text-muted-foreground">Type</FieldLabel>
          <LoopEditorSelect ariaLabel="Step type" value={step.type} disabled={disabled} options={typeOptions} onChange={(type) => onChange(changeStepType(step, type as ProjectStep["type"], { loop, firstAgentId: agents[0]?.id }))} />
        </Field>
        <Field className="gap-1">
          <FieldLabel htmlFor={`${id}-description`} className="text-xs font-normal text-muted-foreground">Description</FieldLabel>
          <Textarea id={`${id}-description`} aria-label="Description" value={step.description} disabled={disabled} rows={3} className="min-h-16 rounded-md text-xs leading-4" onChange={(event) => onChange({ ...step, description: event.target.value } as ProjectStep)} />
        </Field>

        {step.type === "scheduled" ? (
          <LoopScheduleEditor step={step} targets={scheduleTargets} state={scheduleState} disabled={disabled} onChange={onChange} />
        ) : (
          <>
            <StepOwner step={step} agents={agents} disabled={disabled} onChange={onChange} />
            <LoopTransitionsEditor step={step} loop={loop} loops={loops} disabled={disabled} focusedTransition={focusedTransition === "triggered" ? undefined : focusedTransition} onChange={onChange} />
          </>
        )}
      </FieldGroup>
      <div className="mt-3 border-t border-divider-strong pt-2">
        <Button type="button" variant="ghost" size="xs" disabled={disabled || !canRemoveStep(loop, step.id)} className="px-1 text-destructive hover:text-destructive" onClick={onRemove}>
          <Trash2 data-icon="inline-start" /> Remove from loop
        </Button>
      </div>
    </section>
  );
}

function StepOwner({ step, agents, disabled, onChange }: {
  step: Exclude<ProjectStep, { type: "scheduled" }>;
  agents: Agent[];
  disabled: boolean;
  onChange: (step: ProjectStep) => void;
}) {
  return (
    <Field className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2">
      <FieldLabel className="text-xs font-normal text-muted-foreground">Agent</FieldLabel>
      {step.type === "agent" ? (
        <LoopEditorSelect ariaLabel="Agent" value={step.agentId} disabled={disabled || agents.length === 0} options={agents.map((agent) => ({ value: agent.id, label: agent.name ? `${agent.id} · ${agent.name}` : agent.id }))} onChange={(agentId) => onChange({ ...step, agentId })} />
      ) : (
        <div className="flex min-w-0 items-center gap-1.5 text-xs text-tertiary"><ShieldCheck className="size-3.5 shrink-0" /><span>Human operator</span></div>
      )}
    </Field>
  );
}
