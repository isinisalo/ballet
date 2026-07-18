import { useId } from "react";
import type { Agent, LoopScheduleState, ProjectLoop, ProjectLoopNode, ProjectStep, ProjectStepTransitionId } from "@shared/api/workspace-contracts";
import { isProjectTerminalNode } from "@shared/api/workspace-contracts";
import { ChevronRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { compactLoopFormControl } from "./LoopEditorSelect";
import { LoopScheduleEditor } from "./LoopScheduleEditor";
import { CompactSelectField, NodeSizeField, NodeStyleField, StepOwner } from "./LoopStepFields";
import { LoopTransitionsEditor } from "./LoopTransitionsEditor";
import { canChangeStepToScheduled, canRemoveStep, changeStepType } from "./loopEditorState";
import { stepDescriptionError, stepIdError } from "./loopFormValidation";

export function LoopNodeSheetEditor({ step, loop, loops, agents, scheduleState, disabled, focusedTransition, surface = "sheet", onChange, onRemove }: {
  step: ProjectLoopNode;
  loop: ProjectLoop;
  loops: ProjectLoop[];
  agents: Agent[];
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
    ...(step.type === "scheduled" || (agents.length > 0 && canChangeStepToScheduled(loop, step.id)) ? [{ value: "scheduled", label: "Scheduled" }] : [])
  ];
  const idError = terminal ? undefined : stepIdError(loop, step);
  const descriptionError = stepDescriptionError(step);
  const idErrorId = `${id}-step-error`;
  const descriptionErrorId = `${id}-description-error`;

  return (
    <form aria-label="Node editor" className={`@container/loop-form min-w-0 overflow-y-auto px-3 pb-2.5 text-xs ${surface === "sheet" ? "pt-9" : "pt-0"}`} onSubmit={(event) => event.preventDefault()}>
      <FieldGroup className="gap-3">
        <Field className="grid grid-cols-1 items-start gap-1.5 @sm/loop-form:grid-cols-[5.5rem_minmax(0,1fr)] @sm/loop-form:gap-2" data-invalid={Boolean(idError)}>
          <FieldLabel htmlFor={`${id}-step`} className="text-xs font-normal text-muted-foreground">Node</FieldLabel>
          <div className="grid min-w-0 gap-1">
            <Input
              id={`${id}-step`}
              aria-label="Node ID"
              aria-invalid={Boolean(idError)}
              aria-describedby={idError ? idErrorId : undefined}
              value={step.id}
              disabled={disabled || terminal}
              className={`${compactLoopFormControl} border-primary/50 bg-primary/10 text-primary`}
              onChange={(event) => onChange({ ...step, id: event.target.value } as ProjectLoopNode)}
            />
            {idError ? <FieldError id={idErrorId} className="text-[0.65rem] leading-4">{idError}</FieldError> : null}
          </div>
        </Field>
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
            onChange={(event) => onChange({ ...step, description: event.target.value } as ProjectLoopNode)}
          />
          {descriptionError ? <FieldError id={descriptionErrorId} className="text-[0.65rem] leading-4">{descriptionError}</FieldError> : null}
        </Field>
        <CompactSelectField
          label="Type"
          ariaLabel="Node type"
          value={step.type}
          disabled={disabled || terminal}
          options={typeOptions}
          onChange={(type) => { if (!terminal) onChange(changeStepType(step, type as ProjectStep["type"], { loop, firstAgentId: agents[0]?.id })); }}
        />
        {terminal ? <CompactSelectField label="Agent" ariaLabel="Agent" value="" options={[]} disabled onChange={() => undefined} /> : <StepOwner step={step} agents={agents} disabled={disabled} onChange={onChange} />}
        {step.type === "scheduled" ? <LoopScheduleEditor step={step} state={scheduleState} disabled={disabled} onChange={onChange} /> : null}
        <LoopTransitionsEditor step={step} loop={loop} loops={loops} disabled={disabled} focusedTransition={focusedTransition} onChange={onChange} />
        <NodeAppearanceFields node={step} disabled={disabled} onChange={onChange} />
      </FieldGroup>
      {!terminal ? <div className="mt-3 border-t border-divider-strong pt-2">
        <Button type="button" variant="ghost" size="xs" disabled={disabled || !canRemoveStep(loop, step.id)} className="px-1 text-destructive hover:text-destructive" onClick={onRemove}>
          <Trash2 data-icon="inline-start" /> Remove from loop
        </Button>
      </div> : null}
    </form>
  );
}

function NodeAppearanceFields({ node, disabled, onChange }: {
  node: ProjectLoopNode;
  disabled: boolean;
  onChange: (node: ProjectLoopNode) => void;
}) {
  return (
    <Collapsible className="group/appearance">
      <CollapsibleTrigger render={
        <Button type="button" variant="ghost" size="xs" className="w-full justify-start px-0 text-muted-foreground">
          <ChevronRight className="transition-transform group-data-[state=open]/appearance:rotate-90" /> Appearance
        </Button>
      } />
      <CollapsibleContent className="grid gap-3 border-t border-divider-strong pt-3">
        <NodeStyleField node={node} disabled={disabled} onChange={onChange} />
        <NodeSizeField node={node} disabled={disabled} onChange={onChange} />
      </CollapsibleContent>
    </Collapsible>
  );
}
