import { useId, type ReactNode } from "react";
import type {
  ExecutionProfile,
  LocalRuntime,
  LoopScheduleState,
  ProjectExecutionStep,
  ProjectInstruction,
  ProjectLoop,
  ProjectLoopNode,
  ProjectStep,
  ProjectStepTransitionId,
  Skill
} from "@shared/api/workspace-contracts";
import { isProjectTerminalNode } from "@shared/api/workspace-contracts";
import { ChevronRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { compactLoopFormControl } from "./LoopEditorSelect";
import { LoopScheduleEditor } from "./LoopScheduleEditor";
import { CompactSelectField, NodeSizeField, NodeStyleField } from "./LoopStepFields";
import { StepCompositionFields } from "./StepCompositionFields";
import { LoopTransitionsEditor } from "./LoopTransitionsEditor";
import { canChangeStepToScheduled, canRemoveStep, changeStepType } from "./loopEditorState";
import { stepDescriptionError, stepIdError } from "./loopFormValidation";

export function LoopNodeSheetEditor({ step, loop, loops, executionProfiles, instructions, skills, runtime, scheduleState, disabled, focusedTransition, surface = "sheet", onChange, onRemove }: {
  step: ProjectLoopNode;
  loop: ProjectLoop;
  loops: ProjectLoop[];
  executionProfiles: ExecutionProfile[];
  instructions: ProjectInstruction[];
  skills: Skill[];
  runtime: LocalRuntime;
  scheduleState?: LoopScheduleState;
  disabled: boolean;
  focusedTransition?: ProjectStepTransitionId;
  surface?: "sheet" | "embedded";
  onChange: (step: ProjectLoopNode) => void;
  onRemove: () => void;
}) {
  const id = useId();
  const terminal = isProjectTerminalNode(step);
  const typeOptions = terminal ? [{ value: step.type, label: step.type }] : [
    { value: "agent", label: "Agent" },
    { value: "human", label: "Human" },
    ...(step.type === "scheduled" || canChangeStepToScheduled(loop, step.id) ? [{ value: "scheduled", label: "Scheduled" }] : [])
  ];

  return (
    <form aria-label="Node editor" className={`@container/loop-form min-w-0 overflow-y-auto px-3 pb-2.5 text-xs ${surface === "sheet" ? "pt-9" : "pt-0"}`} onSubmit={(event) => event.preventDefault()}>
      <FieldGroup className="gap-3">
        <TaskDescriptionField fieldId={`${id}-description`} step={step} disabled={disabled} terminal={terminal} onChange={onChange} />
        {step.type === "agent" || step.type === "scheduled" ? (
          <StepCompositionFields step={step} profiles={executionProfiles} instructions={instructions} skills={skills} runtime={runtime} disabled={disabled} onChange={onChange} />
        ) : null}
        <LoopTransitionsEditor step={step} loop={loop} loops={loops} disabled={disabled} focusedTransition={focusedTransition} onChange={onChange} />
        <NodeAppearanceFields node={step} disabled={disabled} onChange={onChange} />
        <NodeAdvancedFields id={id} node={step} loop={loop} typeOptions={typeOptions} scheduleState={scheduleState} disabled={disabled} onChange={onChange} />
      </FieldGroup>
      {!terminal ? <div className="mt-3 border-t border-divider-strong pt-2"><Button type="button" variant="ghost" size="xs" disabled={disabled || !canRemoveStep(loop, step.id)} className="px-1 text-destructive hover:text-destructive" onClick={onRemove}><Trash2 data-icon="inline-start" /> Remove from loop</Button></div> : null}
    </form>
  );
}

function TaskDescriptionField({ fieldId, step, terminal, disabled, onChange }: {
  fieldId: string;
  step: ProjectLoopNode;
  terminal: boolean;
  disabled: boolean;
  onChange: (step: ProjectLoopNode) => void;
}) {
  const error = stepDescriptionError(step);
  const errorId = `${fieldId}-error`;
  return (
    <Field className="gap-1" data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={fieldId} className="text-xs font-normal text-muted-foreground">{terminal ? "Description" : "Task description"}</FieldLabel>
      <Textarea id={fieldId} aria-label={terminal ? "Description" : "Task description"} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} value={step.description} disabled={disabled} rows={3} maxLength={2_001} className="min-h-20 rounded text-base leading-5 md:min-h-16 md:text-xs md:leading-4" onChange={(event) => onChange({ ...step, description: event.target.value } as ProjectLoopNode)} />
      {error ? <FieldError id={errorId} className="text-[0.65rem] leading-4">{error}</FieldError> : null}
    </Field>
  );
}

function Disclosure({ label, children }: { label: string; group: string; children: ReactNode }) {
  return (
    <Collapsible className="group/disclosure">
      <CollapsibleTrigger render={<Button type="button" variant="ghost" size="xs" className="w-full justify-start px-0 text-muted-foreground"><ChevronRight className="transition-transform group-data-[state=open]/disclosure:rotate-90" /> {label}</Button>} />
      <CollapsibleContent className="grid gap-3 border-t border-divider-strong pt-3">{children}</CollapsibleContent>
    </Collapsible>
  );
}

function NodeAppearanceFields({ node, disabled, onChange }: { node: ProjectLoopNode; disabled: boolean; onChange: (node: ProjectLoopNode) => void }) {
  return <Disclosure label="Appearance" group="appearance"><NodeStyleField node={node} disabled={disabled} onChange={onChange} /><NodeSizeField node={node} disabled={disabled} onChange={onChange} /></Disclosure>;
}

function NodeAdvancedFields({ id, node, loop, typeOptions, scheduleState, disabled, onChange }: {
  id: string;
  node: ProjectLoopNode;
  loop: ProjectLoop;
  typeOptions: Array<{ value: string; label: string }>;
  scheduleState?: LoopScheduleState;
  disabled: boolean;
  onChange: (node: ProjectLoopNode) => void;
}) {
  const terminal = isProjectTerminalNode(node);
  const idError = terminal ? undefined : stepIdError(loop, node);
  const errorId = `${id}-step-error`;
  return (
    <Disclosure label="Advanced" group="advanced">
      <Field className="grid grid-cols-1 items-start gap-1.5 @sm/loop-form:grid-cols-[5.5rem_minmax(0,1fr)] @sm/loop-form:gap-2" data-invalid={Boolean(idError)}>
        <FieldLabel htmlFor={`${id}-step`} className="text-xs font-normal text-muted-foreground">Node ID</FieldLabel>
        <div className="grid min-w-0 gap-1"><Input id={`${id}-step`} aria-label="Node ID" aria-invalid={Boolean(idError)} aria-describedby={idError ? errorId : undefined} value={node.id} disabled={disabled || terminal} className={`${compactLoopFormControl} border-primary/50 bg-primary/10 text-primary`} onChange={(event) => onChange({ ...node, id: event.target.value } as ProjectLoopNode)} />{idError ? <FieldError id={errorId} className="text-[0.65rem] leading-4">{idError}</FieldError> : null}</div>
      </Field>
      <CompactSelectField label="Step type" ariaLabel="Node type" value={node.type} disabled={disabled || terminal} options={typeOptions} onChange={(type) => { if (!terminal) onChange(changeStepType(node, type as ProjectStep["type"], { loop })); }} />
      {node.type === "scheduled" ? <LoopScheduleEditor step={node} state={scheduleState} disabled={disabled} onChange={onChange} /> : null}
      {node.type === "agent" || node.type === "scheduled" ? <CompositionIds step={node} /> : null}
    </Disclosure>
  );
}

function CompositionIds({ step }: { step: ProjectExecutionStep }) {
  const rows = [
    ["Profile ID", step.executionProfileId || "Not selected"],
    ["Primary ID", step.primaryInstructionId || "Not selected"],
    ["Skill IDs", step.skillIds.length ? step.skillIds.join(", ") : "None"],
    ["Order", "System → Primary → Skills → Task → Schema"]
  ];
  return <dl className="grid gap-2 border-y border-divider-strong py-2">{rows.map(([label, value]) => <div key={label} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2"><dt className="text-muted-foreground">{label}</dt><dd className="break-words font-mono text-[0.65rem]">{value}</dd></div>)}</dl>;
}
