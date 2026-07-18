import { useId } from "react";
import type {
  ProjectLoop,
  ProjectLoopNode,
  ProjectStep,
  ProjectStepTransitionId,
  StepTransitionTarget,
  TransitionAction,
  TransitionFallbackAction,
  TransitionInputMode
} from "@shared/api/workspace-contracts";
import {
  getProjectStepTransitionEntries,
  isProjectTerminalNode,
  MAX_TRANSITION_RETRY_ATTEMPTS
} from "@shared/api/workspace-contracts";
import { Field, FieldError, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { LoopEditorSelect, compactLoopFormControl } from "./LoopEditorSelect";
import {
  transitionTarget,
  transitionTargetKind,
  transitionTargetValue,
  type TransitionTargetKind
} from "./loopEditorState";

const actionOptions = [
  { value: "goto", label: "Go to" },
  { value: "terminate", label: "Terminate" },
  { value: "wait", label: "Wait" },
  { value: "retry", label: "Retry" }
];

export function LoopTransitionsEditor({ step, loop, loops, disabled, focusedTransition, onChange }: {
  step: ProjectLoopNode;
  loop: ProjectLoop;
  loops: ProjectLoop[];
  disabled: boolean;
  focusedTransition?: ProjectStepTransitionId;
  onChange: (step: ProjectLoopNode) => void;
}) {
  if (isProjectTerminalNode(step)) return <TerminalTransitions />;
  const patch = (signal: ProjectStepTransitionId, action: TransitionAction) => onChange({
    ...step,
    on: { ...step.on, [signal]: action }
  } as ProjectStep);
  return (
    <TransitionRows>
      {getProjectStepTransitionEntries(step).map(([signal, action]) => (
        <TransitionRow
          key={signal}
          signal={signal}
          action={action}
          step={step}
          loop={loop}
          loops={loops}
          disabled={disabled}
          focused={focusedTransition === signal}
          onChange={(next) => patch(signal, next)}
        />
      ))}
    </TransitionRows>
  );
}

function TransitionRows({ children }: { children: React.ReactNode }) {
  return (
    <FieldSet className="gap-1.5">
      <FieldLegend variant="label" className="mb-0 text-xs font-normal text-muted-foreground">Transitions</FieldLegend>
      <div className="divide-y divide-divider-strong border-y border-divider-strong">{children}</div>
    </FieldSet>
  );
}

function TerminalTransitions() {
  return (
    <FieldSet className="gap-1.5">
      <FieldLegend variant="label" className="mb-0 text-xs font-normal text-muted-foreground">Transitions</FieldLegend>
      <p className="border-y border-divider-strong py-2 text-xs text-muted-foreground">Terminal nodes have no transitions.</p>
    </FieldSet>
  );
}

function TransitionRow({ signal, action, step, loop, loops, disabled, focused, onChange }: {
  signal: ProjectStepTransitionId;
  action: TransitionAction;
  step: ProjectStep;
  loop: ProjectLoop;
  loops: ProjectLoop[];
  disabled: boolean;
  focused: boolean;
  onChange: (action: TransitionAction) => void;
}) {
  const actionId = useId();
  const changeAction = (value: string) => onChange(defaultAction(value as TransitionAction["action"], step.id));
  return (
    <div className={`grid gap-1.5 py-2 ${focused ? "bg-primary/5" : ""}`}>
      <span className={`font-mono text-[0.66rem] leading-4 ${actionTone(action)}`}>{signal}</span>
      <Field className="grid min-w-0 grid-cols-[4.25rem_minmax(0,1fr)] items-start gap-1.5">
        <FieldLabel htmlFor={actionId} className="pt-1 text-[0.65rem] font-normal text-muted-foreground">Action</FieldLabel>
        <LoopEditorSelect
          id={actionId}
          ariaLabel={`${signal} action`}
          density="form"
          value={action.action}
          disabled={disabled}
          options={actionOptions}
          onChange={changeAction}
        />
      </Field>
      <ActionFields action={action} step={step} loop={loop} loops={loops} disabled={disabled} labelPrefix={signal} onChange={onChange} />
    </div>
  );
}

function ActionFields({ action, step, loop, loops, disabled, labelPrefix, onChange }: {
  action: TransitionAction;
  step: ProjectStep;
  loop: ProjectLoop;
  loops: ProjectLoop[];
  disabled: boolean;
  labelPrefix: string;
  onChange: (action: TransitionAction) => void;
}) {
  if (action.action === "goto") {
    return <><TargetFields label="Target" ariaPrefix={labelPrefix} target={action.target} step={step} loop={loop} loops={loops} disabled={disabled} onChange={(target) => onChange({ ...action, target })} /><InputModeField value={action.input} disabled={disabled} ariaPrefix={labelPrefix} onChange={(input) => onChange({ ...action, input })} /></>;
  }
  if (action.action === "terminate") {
    return <SelectField label="Status" ariaLabel={`${labelPrefix} termination status`} value={action.status} disabled={disabled} options={[{ value: "completed", label: "Completed" }, { value: "blocked", label: "Blocked" }, { value: "failed", label: "Failed" }]} onChange={(status) => onChange({ ...action, status: status as typeof action.status })} />;
  }
  if (action.action === "wait") {
    const resumeMode = action.resume === "same-step" ? "same-step" : "target";
    return <>
      <SelectField label="Resume" ariaLabel={`${labelPrefix} wait resume mode`} value={resumeMode} disabled={disabled} options={[{ value: "same-step", label: "Same step" }, { value: "target", label: "Target" }]} onChange={(mode) => onChange({ ...action, resume: mode === "same-step" ? "same-step" : { target: step.id } })} />
      {action.resume === "same-step" ? null : <TargetFields label="Target" ariaPrefix={`${labelPrefix} wait resume`} target={action.resume.target} step={step} loop={loop} loops={loops} disabled={disabled} onChange={(target) => onChange({ ...action, resume: { target } })} />}
      <InputModeField value={action.input} disabled={disabled} ariaPrefix={labelPrefix} onChange={(input) => onChange({ ...action, input })} />
    </>;
  }

  const attemptsError = Number.isInteger(action.policy.maxAttempts)
    && action.policy.maxAttempts >= 1
    && action.policy.maxAttempts <= MAX_TRANSITION_RETRY_ATTEMPTS
    ? undefined
    : `Use a whole number from 1 to ${MAX_TRANSITION_RETRY_ATTEMPTS}.`;
  return <>
    <SelectField label="Retry" ariaLabel={`${labelPrefix} retry target mode`} value={action.target ? "target" : "same-step"} disabled={disabled} options={[{ value: "same-step", label: "Same step" }, { value: "target", label: "Target" }]} onChange={(mode) => onChange({ ...action, target: mode === "target" ? step.id : undefined })} />
    {action.target ? <RetryTargetField target={action.target} step={step} loop={loop} disabled={disabled} ariaPrefix={labelPrefix} onChange={(target) => onChange({ ...action, target })} /> : null}
    <NumberField label="Max attempts" ariaLabel={`${labelPrefix} retry max attempts`} value={action.policy.maxAttempts} min={1} max={MAX_TRANSITION_RETRY_ATTEMPTS} error={attemptsError} disabled={disabled} onChange={(maxAttempts) => onChange({ ...action, policy: { ...action.policy, maxAttempts } })} />
    <SelectField label="Condition" ariaLabel={`${labelPrefix} retry condition`} value={action.policy.when?.failureClassification ?? "always"} disabled={disabled} options={[{ value: "always", label: "Always" }, { value: "transient", label: "Transient failure" }, { value: "permanent", label: "Permanent failure" }]} onChange={(value) => onChange({ ...action, policy: { ...action.policy, when: value === "always" ? undefined : { failureClassification: value as "transient" | "permanent" } } })} />
    <SelectField label="Stall" ariaLabel={`${labelPrefix} retry stall detection`} value={action.policy.stallDetection ?? "none"} disabled={disabled} options={[{ value: "none", label: "None" }, { value: "same-evidence", label: "Same evidence" }]} onChange={(value) => onChange({ ...action, policy: { ...action.policy, stallDetection: value === "same-evidence" ? "same-evidence" : undefined } })} />
    <InputModeField value={action.input} disabled={disabled} ariaPrefix={labelPrefix} onChange={(input) => onChange({ ...action, input })} />
    <FallbackFields action={action.policy.onExhausted} step={step} loop={loop} loops={loops} disabled={disabled} ariaPrefix={`${labelPrefix} on exhausted`} onChange={(onExhausted) => onChange({ ...action, policy: { ...action.policy, onExhausted } })} />
  </>;
}

function FallbackFields({ action, step, loop, loops, disabled, ariaPrefix, onChange }: {
  action: TransitionFallbackAction;
  step: ProjectStep;
  loop: ProjectLoop;
  loops: ProjectLoop[];
  disabled: boolean;
  ariaPrefix: string;
  onChange: (action: TransitionFallbackAction) => void;
}) {
  return <div className="grid gap-1 border-l border-divider-strong pl-2">
    <SelectField label="Exhausted" ariaLabel={`${ariaPrefix} action`} value={action.action} disabled={disabled} options={actionOptions.filter((option) => option.value !== "retry")} onChange={(value) => onChange(defaultFallbackAction(value as TransitionFallbackAction["action"], step.id))} />
    <ActionFields action={action} step={step} loop={loop} loops={loops} disabled={disabled} labelPrefix={ariaPrefix} onChange={(next) => onChange(next as TransitionFallbackAction)} />
  </div>;
}

function TargetFields({ label, ariaPrefix, target, step, loop, loops, disabled, onChange }: {
  label: string;
  ariaPrefix: string;
  target: StepTransitionTarget;
  step: ProjectStep;
  loop: ProjectLoop;
  loops: ProjectLoop[];
  disabled: boolean;
  onChange: (target: StepTransitionTarget) => void;
}) {
  const kindId = useId();
  const targetId = useId();
  const kind = transitionTargetKind(target);
  const loopOptions = loops.filter((candidate) => candidate.id !== loop.id).map((candidate) => ({ value: candidate.id, label: candidate.id }));
  const kindOptions = [{ value: "node", label: "Node" }, ...(loopOptions.length ? [{ value: "loop", label: "Loop" }] : [])];
  const valueOptions = kind === "node"
    ? loop.nodes.map((candidate) => ({ value: candidate.id, label: candidate.id }))
    : loopOptions;
  const changeKind = (value: string) => {
    const nextKind = value as TransitionTargetKind;
    onChange(transitionTarget(nextKind, nextKind === "node" ? step.id : loopOptions[0]?.value ?? ""));
  };
  return <Field className="grid min-w-0 grid-cols-[4.25rem_minmax(0,1fr)] items-start gap-1.5">
    <FieldLabel htmlFor={kindId} className="pt-1 text-[0.65rem] font-normal text-muted-foreground">{label}</FieldLabel>
    <div className="grid min-w-0 grid-cols-2 gap-1.5">
      <LoopEditorSelect id={kindId} ariaLabel={`${ariaPrefix} target kind`} density="form" value={kind} disabled={disabled} options={kindOptions} onChange={changeKind} />
      <LoopEditorSelect id={targetId} ariaLabel={`${ariaPrefix} target`} density="form" value={transitionTargetValue(target)} disabled={disabled} options={valueOptions} onChange={(value) => onChange(transitionTarget(kind, value))} />
    </div>
  </Field>;
}

function RetryTargetField({ target, step, loop, disabled, ariaPrefix, onChange }: {
  target: string;
  step: ProjectStep;
  loop: ProjectLoop;
  disabled: boolean;
  ariaPrefix: string;
  onChange: (target: string) => void;
}) {
  const id = useId();
  const options = loop.nodes.filter((node) => !isProjectTerminalNode(node) && node.type !== "scheduled")
    .map((node) => ({ value: node.id, label: node.id }));
  return <Field className="grid min-w-0 grid-cols-[4.25rem_minmax(0,1fr)] items-start gap-1.5">
    <FieldLabel htmlFor={id} className="pt-1 text-[0.65rem] font-normal text-muted-foreground">Target</FieldLabel>
    <LoopEditorSelect id={id} ariaLabel={`${ariaPrefix} retry target`} density="form" value={target} disabled={disabled} options={options.length ? options : [{ value: step.id, label: step.id }]} onChange={onChange} />
  </Field>;
}

function InputModeField({ value, disabled, ariaPrefix, onChange }: {
  value?: TransitionInputMode;
  disabled: boolean;
  ariaPrefix: string;
  onChange: (value: TransitionInputMode | undefined) => void;
}) {
  return <SelectField label="Input" ariaLabel={`${ariaPrefix} input forwarding`} value={value ?? "current"} disabled={disabled} options={[{ value: "current", label: "Current" }, { value: "signal", label: "Signal" }, { value: "append-signal", label: "Current + signal" }]} onChange={(input) => onChange(input === "current" ? undefined : input as TransitionInputMode)} />;
}

function SelectField({ label, ariaLabel, value, options, disabled, onChange }: {
  label: string;
  ariaLabel: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return <Field className="grid min-w-0 grid-cols-[4.25rem_minmax(0,1fr)] items-start gap-1.5">
    <FieldLabel htmlFor={id} className="pt-1 text-[0.65rem] font-normal text-muted-foreground">{label}</FieldLabel>
    <LoopEditorSelect id={id} ariaLabel={ariaLabel} density="form" value={value} disabled={disabled} options={options} onChange={onChange} />
  </Field>;
}

function NumberField({ label, ariaLabel, value, min, max, error, disabled, onChange }: {
  label: string;
  ariaLabel: string;
  value: number;
  min: number;
  max: number;
  error?: string;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  return <Field className="grid min-w-0 grid-cols-[4.25rem_minmax(0,1fr)] items-start gap-1.5" data-invalid={Boolean(error)}>
    <FieldLabel htmlFor={id} className="pt-1 text-[0.65rem] font-normal text-muted-foreground">{label}</FieldLabel>
    <div className="grid gap-1">
      <Input id={id} aria-label={ariaLabel} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} className={compactLoopFormControl} type="number" min={min} max={max} step={1} value={String(value)} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} />
      {error ? <FieldError id={errorId} className="text-[0.65rem] leading-4">{error}</FieldError> : null}
    </div>
  </Field>;
}

const defaultAction = (action: TransitionAction["action"], stepId: string): TransitionAction =>
  action === "retry"
    ? { action: "retry", policy: { maxAttempts: 1, onExhausted: { action: "terminate", status: "blocked" } } }
    : defaultFallbackAction(action, stepId);

const defaultFallbackAction = (action: TransitionFallbackAction["action"], stepId: string): TransitionFallbackAction => {
  if (action === "goto") return { action: "goto", target: stepId };
  if (action === "wait") return { action: "wait", resume: "same-step", input: "append-signal" };
  return { action: "terminate", status: "blocked" };
};

const actionTone = (action: TransitionAction) => action.action === "goto"
  ? "text-secondary"
  : action.action === "terminate" && action.status !== "completed"
    ? "text-destructive"
    : "text-tertiary";
