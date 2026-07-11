import { useId } from "react";
import type { Agent, ProjectLoop, ProjectStep, StepTransitionTarget } from "@shared/api/workspace-contracts";
import { ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { changeStepType, transitionTarget, transitionTargetKind, transitionTargetValue, type TransitionTargetKind } from "./loopEditorState";

const compactControl = "h-[22px] min-h-[22px] w-full rounded-md border-divider-strong bg-card px-1.5 py-0 font-mono text-[0.66rem] leading-4 shadow-none";

export function LoopStepSheetEditor({
  step,
  loop,
  loops,
  agents,
  disabled,
  focusedTransition,
  onChange,
  onRemove
}: {
  step: ProjectStep;
  loop: ProjectLoop;
  loops: ProjectLoop[];
  agents: Agent[];
  disabled: boolean;
  focusedTransition?: "approved" | "rejected";
  onChange: (step: ProjectStep) => void;
  onRemove: () => void;
}) {
  const id = useId();
  const patchTransition = (result: "approved" | "rejected", target: StepTransitionTarget) =>
    onChange({ ...step, on: { ...step.on, [result]: target } } as ProjectStep);

  return (
    <section aria-label="Step editor" className="min-w-0 overflow-y-auto px-3 pt-9 pb-2.5 text-xs">
      <FieldGroup className="gap-3">
        <Field className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2">
          <FieldLabel htmlFor={`${id}-step`} className="text-xs font-normal text-muted-foreground">Step</FieldLabel>
          <Input id={`${id}-step`} aria-label="Step ID" value={step.id} disabled={disabled} className={`${compactControl} border-primary/50 bg-primary/10 text-primary`} onChange={(event) => onChange({ ...step, id: event.target.value } as ProjectStep)} />
        </Field>
        <Field className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2">
          <FieldLabel className="text-xs font-normal text-muted-foreground">Type</FieldLabel>
          <CompactSelect ariaLabel="Step type" value={step.type} disabled={disabled} options={[{ value: "agent", label: "Agent" }, { value: "human", label: "Human" }]} onChange={(type) => onChange(changeStepType(step, type as ProjectStep["type"], agents[0]?.id))} />
        </Field>
        <Field className="gap-1">
          <FieldLabel htmlFor={`${id}-description`} className="text-xs font-normal text-muted-foreground">Description</FieldLabel>
          <Textarea id={`${id}-description`} aria-label="Description" value={step.description} disabled={disabled} rows={3} className="min-h-16 rounded-md text-xs leading-4" onChange={(event) => onChange({ ...step, description: event.target.value } as ProjectStep)} />
        </Field>
        {step.type === "agent" ? (
          <Field className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2">
            <FieldLabel className="text-xs font-normal text-muted-foreground">Agent</FieldLabel>
            <CompactSelect ariaLabel="Agent" value={step.agentId} disabled={disabled || agents.length === 0} options={agents.map((agent) => ({ value: agent.id, label: agent.name ? `${agent.id} · ${agent.name}` : agent.id }))} onChange={(agentId) => onChange({ ...step, agentId })} />
          </Field>
        ) : (
          <Field className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2">
            <FieldLabel className="text-xs font-normal text-muted-foreground">Agent</FieldLabel>
            <div className="flex min-w-0 items-center gap-1.5 text-xs text-tertiary"><ShieldCheck className="size-3.5 shrink-0" /><span>Human operator</span></div>
          </Field>
        )}
        <Field className="gap-1.5">
          <FieldLabel className="text-xs font-normal text-muted-foreground">Transitions</FieldLabel>
          <div className="divide-y divide-divider-strong border-y border-divider-strong">
            {(["approved", "rejected"] as const).map((result) => (
              <TransitionRow
                key={result}
                result={result}
                target={step.on[result]}
                step={step}
                loop={loop}
                loops={loops}
                disabled={disabled}
                focused={focusedTransition === result}
                onChange={(target) => patchTransition(result, target)}
              />
            ))}
          </div>
        </Field>
      </FieldGroup>
      <div className="mt-3 border-t border-divider-strong pt-2">
        <Button type="button" variant="ghost" size="xs" disabled={disabled || loop.steps.length <= 1} className="px-1 text-destructive hover:text-destructive" onClick={onRemove}>
          <Trash2 data-icon="inline-start" /> Remove from loop
        </Button>
      </div>
    </section>
  );
}

function TransitionRow({ result, target, step, loop, loops, disabled, focused, onChange }: {
  result: "approved" | "rejected";
  target: StepTransitionTarget;
  step: ProjectStep;
  loop: ProjectLoop;
  loops: ProjectLoop[];
  disabled: boolean;
  focused: boolean;
  onChange: (target: StepTransitionTarget) => void;
}) {
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
      : nextKind === "loop" ? loopOptions[0]?.value ?? "" : result === "approved" ? "completed" : "failed";
    onChange(transitionTarget(nextKind, nextValue));
  };

  return (
    <div className={`grid gap-1.5 py-2 ${focused ? "bg-primary/5" : ""}`}>
      <span className={`font-mono text-[0.66rem] leading-4 ${result === "approved" ? "text-secondary" : "text-destructive"}`}>{result}</span>
      <div className="grid min-w-0 grid-cols-2 gap-1.5">
        <CompactSelect ariaLabel={`${result} transition kind`} value={kind} disabled={disabled} options={kindOptions} onChange={changeKind} />
        <CompactSelect ariaLabel={`${result} transition target`} value={transitionTargetValue(target)} disabled={disabled} options={valueOptions} onChange={(value) => onChange(transitionTarget(kind, value))} />
      </div>
    </div>
  );
}

function CompactSelect({ ariaLabel, value, options, disabled, onChange }: {
  ariaLabel: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value || undefined} disabled={disabled} items={options} onValueChange={onChange}>
      <SelectTrigger size="sm" aria-label={ariaLabel} className={compactControl}><SelectValue /></SelectTrigger>
      <SelectContent><SelectGroup>{options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectGroup></SelectContent>
    </Select>
  );
}
