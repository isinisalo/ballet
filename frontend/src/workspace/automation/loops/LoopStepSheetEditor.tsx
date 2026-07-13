import { useId, type ReactNode } from "react";
import type { Agent, LoopNodeSize, LoopScheduleState, ProjectLoop, ProjectStep, ProjectStepTransitionId } from "@shared/api/workspace-contracts";
import { isProjectExecutableStep } from "@shared/api/workspace-contracts";
import { ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LoopEditorSelect, compactLoopFormControl } from "./LoopEditorSelect";
import { LoopScheduleEditor } from "./LoopScheduleEditor";
import { LoopTransitionsEditor } from "./LoopTransitionsEditor";
import { canChangeStepToScheduled, canRemoveStep, changeStepType } from "./loopEditorState";
import { stepDescriptionError, stepIdError } from "./loopFormValidation";

export function LoopStepSheetEditor({ step, loop, loops, agents, scheduleState, disabled, focusedTransition, surface = "sheet", onChange, onRemove }: {
  step: ProjectStep;
  loop: ProjectLoop;
  loops: ProjectLoop[];
  agents: Agent[];
  scheduleState?: LoopScheduleState;
  disabled: boolean;
  focusedTransition?: ProjectStepTransitionId;
  surface?: "sheet" | "embedded";
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
  const idError = stepIdError(loop, step);
  const descriptionError = stepDescriptionError(step);
  const idErrorId = `${id}-step-error`;
  const descriptionErrorId = `${id}-description-error`;

  return (
    <form aria-label="Step editor" className={`@container/loop-form min-w-0 overflow-y-auto px-3 pb-2.5 text-xs ${surface === "sheet" ? "pt-9" : "pt-0"}`} onSubmit={(event) => event.preventDefault()}>
      <FieldGroup className="gap-3">
        <Field className="grid grid-cols-1 items-start gap-1.5 @sm/loop-form:grid-cols-[5.5rem_minmax(0,1fr)] @sm/loop-form:gap-2" data-invalid={Boolean(idError)}>
          <FieldLabel htmlFor={`${id}-step`} className="text-xs font-normal text-muted-foreground">Step</FieldLabel>
          <div className="grid min-w-0 gap-1">
            <Input
              id={`${id}-step`}
              aria-label="Step ID"
              aria-invalid={Boolean(idError)}
              aria-describedby={idError ? idErrorId : undefined}
              value={step.id}
              disabled={disabled}
              className={`${compactLoopFormControl} border-primary/50 bg-primary/10 text-primary`}
              onChange={(event) => onChange({ ...step, id: event.target.value } as ProjectStep)}
            />
            {idError ? <FieldError id={idErrorId} className="text-[0.65rem] leading-4">{idError}</FieldError> : null}
          </div>
        </Field>
        <CompactSelectField
          label="Type"
          ariaLabel="Step type"
          value={step.type}
          disabled={disabled}
          options={typeOptions}
          onChange={(type) => onChange(changeStepType(step, type as ProjectStep["type"], { loop, firstAgentId: agents[0]?.id }))}
        />
        <CompactSelectField
          label="Node size"
          ariaLabel="Node size"
          value={step.nodeSize}
          disabled={disabled}
          options={[
            { value: "small", label: "Small" },
            { value: "medium", label: "Medium" },
            { value: "large", label: "Large" }
          ]}
          onChange={(nodeSize) => onChange({ ...step, nodeSize: nodeSize as LoopNodeSize } as ProjectStep)}
        />
        <Field className="gap-1" data-invalid={Boolean(descriptionError)}>
          <FieldLabel htmlFor={`${id}-description`} className="text-xs font-normal text-muted-foreground">Description</FieldLabel>
          <Textarea
            id={`${id}-description`}
            aria-label="Description"
            aria-invalid={Boolean(descriptionError)}
            aria-describedby={descriptionError ? descriptionErrorId : undefined}
            value={step.description}
            disabled={disabled}
            rows={3}
            maxLength={2_001}
            className="min-h-20 rounded text-base leading-5 md:min-h-16 md:text-xs md:leading-4"
            onChange={(event) => onChange({ ...step, description: event.target.value } as ProjectStep)}
          />
          {descriptionError ? <FieldError id={descriptionErrorId} className="text-[0.65rem] leading-4">{descriptionError}</FieldError> : null}
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
    </form>
  );
}

function StepOwner({ step, agents, disabled, onChange }: {
  step: Exclude<ProjectStep, { type: "scheduled" }>;
  agents: Agent[];
  disabled: boolean;
  onChange: (step: ProjectStep) => void;
}) {
  if (step.type === "agent") {
    return (
      <CompactSelectField
        label="Agent"
        ariaLabel="Agent"
        value={step.agentId}
        disabled={disabled || agents.length === 0}
        invalid={!step.agentId}
        error={!step.agentId ? "Select an agent." : undefined}
        options={agents.map((agent) => ({ value: agent.id, label: agent.name ? `${agent.id} · ${agent.name}` : agent.id }))}
        onChange={(agentId) => onChange({ ...step, agentId })}
      />
    );
  }
  return (
    <Field className="grid grid-cols-1 items-start gap-1.5 @sm/loop-form:grid-cols-[5.5rem_minmax(0,1fr)] @sm/loop-form:items-center @sm/loop-form:gap-2">
      <span className="text-xs font-normal text-muted-foreground">Agent</span>
      <div className="flex min-w-0 items-center gap-1.5 text-xs text-tertiary"><ShieldCheck className="size-3.5 shrink-0" /><span>Human operator</span></div>
    </Field>
  );
}

function CompactSelectField({ label, ariaLabel, value, options, disabled, invalid, error, onChange }: {
  label: ReactNode;
  ariaLabel: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  disabled: boolean;
  invalid?: boolean;
  error?: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <Field className="grid grid-cols-1 items-start gap-1.5 @sm/loop-form:grid-cols-[5.5rem_minmax(0,1fr)] @sm/loop-form:gap-2" data-invalid={Boolean(invalid || error)}>
      <FieldLabel htmlFor={id} className="text-xs font-normal text-muted-foreground @sm/loop-form:pt-1">{label}</FieldLabel>
      <div className="grid min-w-0 gap-1">
        <LoopEditorSelect id={id} ariaLabel={ariaLabel} density="form" value={value} disabled={disabled} invalid={Boolean(invalid || error)} describedBy={error ? errorId : undefined} options={options} onChange={onChange} />
        {error ? <FieldError id={errorId} className="text-[0.65rem] leading-4">{error}</FieldError> : null}
      </div>
    </Field>
  );
}
