import { useId } from "react";
import type { ProjectExecutableStep, ProjectLoop, StepTransitionTarget } from "@shared/api/workspace-contracts";
import { Field, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { LoopEditorSelect } from "./LoopEditorSelect";
import { transitionTarget, transitionTargetKind, transitionTargetValue, type TransitionTargetKind } from "./loopEditorState";

export function LoopTransitionsEditor({ step, loop, loops, disabled, focusedTransition, onChange }: {
  step: ProjectExecutableStep;
  loop: ProjectLoop;
  loops: ProjectLoop[];
  disabled: boolean;
  focusedTransition?: "approved" | "rejected";
  onChange: (step: ProjectExecutableStep) => void;
}) {
  const patch = (result: "approved" | "rejected", target: StepTransitionTarget) => onChange({ ...step, on: { ...step.on, [result]: target } });
  return (
    <FieldSet className="gap-1.5">
      <FieldLegend variant="label" className="mb-0 text-xs font-normal text-muted-foreground">Transitions</FieldLegend>
      <div className="divide-y divide-divider-strong border-y border-divider-strong">
        {(["approved", "rejected"] as const).map((result) => (
          <TransitionRow key={result} result={result} target={step.on[result]} step={step} loop={loop} loops={loops} disabled={disabled} focused={focusedTransition === result} onChange={(target) => patch(result, target)} />
        ))}
      </div>
    </FieldSet>
  );
}

function TransitionRow({ result, target, step, loop, loops, disabled, focused, onChange }: {
  result: "approved" | "rejected";
  target: StepTransitionTarget;
  step: ProjectExecutableStep;
  loop: ProjectLoop;
  loops: ProjectLoop[];
  disabled: boolean;
  focused: boolean;
  onChange: (target: StepTransitionTarget) => void;
}) {
  const kindId = useId();
  const targetId = useId();
  const kind = transitionTargetKind(target);
  const loopOptions = loops.filter((candidate) => candidate.id !== loop.id).map((candidate) => ({ value: candidate.id, label: candidate.id }));
  const kindOptions = [
    { value: "step", label: "Step" },
    ...(step.type === "human" && loopOptions.length > 0 ? [{ value: "loop", label: "Loop" }] : []),
    { value: "end", label: "End" }
  ];
  const valueOptions = kind === "step"
    ? loop.steps.map((candidate) => ({ value: candidate.id, label: candidate.id }))
    : kind === "loop" ? loopOptions : ["completed", "blocked", "failed"].map((value) => ({ value, label: value }));
  const changeKind = (value: string) => {
    const nextKind = value as TransitionTargetKind;
    const nextValue = nextKind === "step"
      ? loop.steps[0]?.id ?? step.id
      : nextKind === "loop" ? loopOptions[0]?.value ?? "" : result === "approved" ? "completed" : "blocked";
    onChange(transitionTarget(nextKind, nextValue));
  };

  return (
    <div className={`grid gap-1.5 py-2 ${focused ? "bg-primary/5" : ""}`}>
      <span className={`font-mono text-[0.66rem] leading-4 ${result === "approved" ? "text-secondary" : "text-destructive"}`}>{result}</span>
      <div className="grid min-w-0 grid-cols-2 gap-1.5">
        <Field className="min-w-0 gap-1">
          <FieldLabel htmlFor={kindId} className="sr-only">{result} transition kind</FieldLabel>
          <LoopEditorSelect id={kindId} ariaLabel={`${result} transition kind`} density="form" value={kind} disabled={disabled} options={kindOptions} onChange={changeKind} />
        </Field>
        <Field className="min-w-0 gap-1">
          <FieldLabel htmlFor={targetId} className="sr-only">{result} transition target</FieldLabel>
          <LoopEditorSelect id={targetId} ariaLabel={`${result} transition target`} density="form" value={transitionTargetValue(target)} disabled={disabled} options={valueOptions} onChange={(value) => onChange(transitionTarget(kind, value))} />
        </Field>
      </div>
    </div>
  );
}
