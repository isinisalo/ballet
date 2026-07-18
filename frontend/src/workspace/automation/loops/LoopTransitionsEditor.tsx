import { useId } from "react";
import type { ProjectLoop, ProjectLoopNode, ProjectStep, ProjectStepTransitionId, StepTransitionTarget } from "@shared/api/workspace-contracts";
import { isProjectTerminalNode } from "@shared/api/workspace-contracts";
import { Field, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { LoopEditorSelect } from "./LoopEditorSelect";
import { transitionTarget, transitionTargetKind, transitionTargetValue, type TransitionTargetKind } from "./loopEditorState";

export function LoopTransitionsEditor({ step, loop, loops, disabled, focusedTransition, onChange }: {
  step: ProjectLoopNode;
  loop: ProjectLoop;
  loops: ProjectLoop[];
  disabled: boolean;
  focusedTransition?: ProjectStepTransitionId;
  onChange: (step: ProjectLoopNode) => void;
}) {
  if (isProjectTerminalNode(step)) return <TerminalTransitions />;
  if (step.type === "human") {
    const patch = (result: "approved" | "rejected", target: StepTransitionTarget) => onChange({ ...step, on: { ...step.on, [result]: target } });
    return (
      <TransitionRows>
        {(["approved", "rejected"] as const).map((result) => (
          <TransitionRow key={result} result={result} target={step.on[result]} step={step} loop={loop} loops={loops} disabled={disabled} focused={focusedTransition === result} onChange={(target) => patch(result, target)} />
        ))}
      </TransitionRows>
    );
  }
  const patchSuccess = (result: "ready" | "approved", target: StepTransitionTarget) =>
    onChange({ ...step, on: { ...step.on, [result]: target } });
  const changes = step.on["changes-requested"];
  const needs = step.on.needs_input;
  return (
    <TransitionRows>
      {(["ready", "approved"] as const).map((result) => (
        <TransitionRow key={result} result={result} target={step.on[result]} step={step} loop={loop} loops={loops} disabled={disabled} focused={focusedTransition === result} onChange={(target) => patchSuccess(result, target)} />
      ))}
      <TransitionRow result="changes-requested" target={"repair" in changes ? changes.repair : "blocked"} step={step} loop={loop} loops={loops} disabled={disabled} focused={focusedTransition === "changes-requested"} nodeFilter={(node) => node.type === "agent" || node.type === "blocked"} onChange={(target) => onChange({ ...step, on: { ...step.on, "changes-requested": typeof target === "string" && target !== "blocked" ? { repair: target } : { terminate: "blocked" } } })} />
      <NeedsInputRow value={"human" in needs ? needs.human : "__wait__"} loop={loop} disabled={disabled} focused={focusedTransition === "needs_input"} onChange={(value) => onChange({ ...step, on: { ...step.on, needs_input: value === "__wait__" ? { wait: true } : { human: value } } })} />
      <FixedTransitionRow result="blocked" target="blocked" focused={focusedTransition === "blocked"} />
      <FixedTransitionRow result="failed" target="failed" focused={focusedTransition === "failed"} />
    </TransitionRows>
  );
}

function TransitionRows({ children }: { children: React.ReactNode }) {
  return <FieldSet className="gap-1.5"><FieldLegend variant="label" className="mb-0 text-xs font-normal text-muted-foreground">Transitions</FieldLegend><div className="divide-y divide-divider-strong border-y border-divider-strong">{children}</div></FieldSet>;
}

function TerminalTransitions() {
  return (
    <FieldSet className="gap-1.5">
      <FieldLegend variant="label" className="mb-0 text-xs font-normal text-muted-foreground">Transitions</FieldLegend>
      <p className="border-y border-divider-strong py-2 text-xs text-muted-foreground">Terminal nodes have no transitions.</p>
    </FieldSet>
  );
}

function TransitionRow({ result, target, step, loop, loops, disabled, focused, nodeFilter, onChange }: {
  result: ProjectStepTransitionId;
  target: StepTransitionTarget;
  step: ProjectStep;
  loop: ProjectLoop;
  loops: ProjectLoop[];
  disabled: boolean;
  focused: boolean;
  nodeFilter?: never;
  onChange: (target: StepTransitionTarget) => void;
} | {
  result: ProjectStepTransitionId;
  target: StepTransitionTarget;
  step: ProjectStep;
  loop: ProjectLoop;
  loops: ProjectLoop[];
  disabled: boolean;
  focused: boolean;
  nodeFilter: (node: ProjectLoopNode) => boolean;
  onChange: (target: StepTransitionTarget) => void;
}) {
  const kindId = useId();
  const targetId = useId();
  const kind = transitionTargetKind(target);
  const loopOptions = loops.filter((candidate) => candidate.id !== loop.id).map((candidate) => ({ value: candidate.id, label: candidate.id }));
  const kindOptions = [
    { value: "node", label: "Node" },
    ...(step.type === "human" && loopOptions.length > 0 ? [{ value: "loop", label: "Loop" }] : []),
  ];
  const valueOptions = kind === "node"
    ? loop.nodes.filter((candidate) => !nodeFilter || nodeFilter(candidate)).map((candidate) => ({ value: candidate.id, label: candidate.id }))
    : loopOptions;
  const changeKind = (value: string) => {
    const nextKind = value as TransitionTargetKind;
    const nextValue = nextKind === "node"
      ? loop.nodes[0]?.id ?? step.id
      : loopOptions[0]?.value ?? "";
    onChange(transitionTarget(nextKind, nextValue));
  };

  return (
    <div className={`grid gap-1.5 py-2 ${focused ? "bg-primary/5" : ""}`}>
      <span className={`font-mono text-[0.66rem] leading-4 ${transitionTone(result)}`}>{result}</span>
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

function NeedsInputRow({ value, loop, disabled, focused, onChange }: {
  value: string;
  loop: ProjectLoop;
  disabled: boolean;
  focused: boolean;
  onChange: (value: string) => void;
}) {
  const targetId = useId();
  const options = [
    ...loop.nodes.filter((node) => node.type === "human").map((node) => ({ value: node.id, label: node.id })),
    { value: "__wait__", label: "Wait for human" }
  ];
  return <div className={`grid gap-1.5 py-2 ${focused ? "bg-primary/5" : ""}`}><span className="font-mono text-[0.66rem] leading-4 text-tertiary">needs_input</span><Field className="min-w-0 gap-1"><FieldLabel htmlFor={targetId} className="sr-only">needs_input transition target</FieldLabel><LoopEditorSelect id={targetId} ariaLabel="needs_input transition target" density="form" value={value} disabled={disabled} options={options} onChange={onChange} /></Field></div>;
}

function FixedTransitionRow({ result, target, focused }: { result: "blocked" | "failed"; target: string; focused: boolean }) {
  const targetId = useId();
  return <div className={`grid gap-1.5 py-2 ${focused ? "bg-primary/5" : ""}`}><span className="font-mono text-[0.66rem] leading-4 text-destructive">{result}</span><Field className="min-w-0 gap-1"><FieldLabel htmlFor={targetId} className="sr-only">{result} transition target</FieldLabel><LoopEditorSelect id={targetId} ariaLabel={`${result} transition target`} density="form" value={target} disabled options={[{ value: target, label: target }]} onChange={() => undefined} /></Field></div>;
}

const transitionTone = (result: ProjectStepTransitionId) => result === "ready" || result === "approved"
  ? "text-secondary" : result === "changes-requested" || result === "needs_input" ? "text-tertiary" : "text-destructive";
