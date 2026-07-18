import { useId } from "react";
import type { ProjectLoop, ProjectLoopNode, StepTransitionTarget } from "@shared/api/workspace-contracts";
import { isProjectTerminalNode } from "@shared/api/workspace-contracts";
import { Field, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { LoopEditorSelect, type LoopEditorSelectOption } from "./LoopEditorSelect";
import { transitionTargetFromSelectValue, transitionTargetSelectValue } from "./loopEditorState";

const transitionResults = ["approved", "rejected"] as const;
const transitionLabels = { approved: "Approved", rejected: "Rejected" } as const;
const terminalLabels = { completed: "Completed", blocked: "Blocked", failed: "Failed" } as const;

export function LoopTransitionsEditor({ step, loop, loops, disabled, focusedTransition, onChange }: {
  step: ProjectLoopNode;
  loop: ProjectLoop;
  loops: ProjectLoop[];
  disabled: boolean;
  focusedTransition?: "approved" | "rejected";
  onChange: (step: ProjectLoopNode) => void;
}) {
  if (isProjectTerminalNode(step)) return <TerminalTransitions />;
  const options = transitionTargetOptions(loop, loops);
  const patch = (result: "approved" | "rejected", target: StepTransitionTarget) => onChange({ ...step, on: { ...step.on, [result]: target } });
  return (
    <FieldSet className="gap-1.5">
      <FieldLegend variant="label" className="mb-0 text-xs font-normal text-muted-foreground">Transitions</FieldLegend>
      <div className="divide-y divide-divider-strong border-y border-divider-strong">
        {transitionResults.map((result) => (
          <TransitionRow key={result} result={result} target={step.on[result]} options={options} disabled={disabled} focused={focusedTransition === result} onChange={(target) => patch(result, target)} />
        ))}
      </div>
    </FieldSet>
  );
}

function TerminalTransitions() {
  return (
    <FieldSet className="gap-1.5">
      <FieldLegend variant="label" className="mb-0 text-xs font-normal text-muted-foreground">Transitions</FieldLegend>
      <div className="divide-y divide-divider-strong border-y border-divider-strong">
        {transitionResults.map((result) => <TransitionRow key={result} result={result} options={[]} disabled focused={false} />)}
      </div>
    </FieldSet>
  );
}

function TransitionRow({ result, target, options, disabled, focused, onChange }: {
  result: "approved" | "rejected";
  target?: StepTransitionTarget;
  options: LoopEditorSelectOption[];
  disabled: boolean;
  focused: boolean;
  onChange?: (target: StepTransitionTarget) => void;
}) {
  const targetId = useId();
  const label = transitionLabels[result];

  return (
    <div data-loop-transition-result={result} className={`grid gap-1.5 py-2 ${focused ? "bg-primary/5" : ""}`}>
      <Field className="min-w-0 gap-1">
        <FieldLabel htmlFor={targetId} className={`font-mono text-[0.66rem] leading-4 ${result === "approved" ? "text-secondary" : "text-muted-foreground"}`}>{label} target</FieldLabel>
        <LoopEditorSelect
          id={targetId}
          ariaLabel={`${label} target`}
          density="form"
          value={target ? transitionTargetSelectValue(target) : ""}
          disabled={disabled}
          options={options}
          onChange={(value) => onChange?.(transitionTargetFromSelectValue(value))}
        />
      </Field>
    </div>
  );
}

function transitionTargetOptions(loop: ProjectLoop, loops: ProjectLoop[]): LoopEditorSelectOption[] {
  const nodeOptions = loop.nodes
    .filter((candidate) => !isProjectTerminalNode(candidate))
    .map((candidate) => ({ value: transitionTargetSelectValue(candidate.id), label: candidate.id, group: "Node" }));
  const loopOptions = loops
    .filter((candidate) => candidate.id !== loop.id)
    .map((candidate) => ({ value: transitionTargetSelectValue({ loop: candidate.id }), label: candidate.id, group: "Loop" }));
  const terminalOptions = loop.nodes
    .filter(isProjectTerminalNode)
    .map((candidate) => ({ value: transitionTargetSelectValue(candidate.id), label: terminalLabels[candidate.type], group: "End Loop" }));
  return [...nodeOptions, ...loopOptions, ...terminalOptions];
}
