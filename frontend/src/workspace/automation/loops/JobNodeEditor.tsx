import type {
  ExecutionProfile,
  LocalRuntime,
  LoopScheduleState,
  ProjectInstruction,
  ProjectJobNode,
  ProjectLoop,
  Skill
} from "@shared/api/workspace-contracts";
import { isProjectProviderJobNode } from "@shared/api/workspace-contracts";
import { ArrowDown, ArrowRight, ArrowUp, Bot, BriefcaseBusiness, CalendarClock, RotateCcw, UserRound } from "lucide-react";
import { DeleteAction, SelectField, TextAreaField, TextField } from "@/components/shared/workspace-ui";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ExecutionCompositionFields } from "./ExecutionCompositionFields";
import { JobScheduleEditor } from "./JobScheduleEditor";
import { NodeAppearanceFields } from "./NodeAppearanceFields";
import { changeJobNodeType } from "./loopEditorState";
import { jobNodeIdError } from "./loopFormValidation";

export function JobNodeEditor({ node, loop, allLoops, profiles, instructions, skills, runtime, scheduleState, disabled, removable, removeBlockedReason, onChange, onMove, onRemove }: {
  node: ProjectJobNode;
  loop: ProjectLoop;
  allLoops: ProjectLoop[];
  profiles: ExecutionProfile[];
  instructions: ProjectInstruction[];
  skills: Skill[];
  runtime: LocalRuntime;
  scheduleState?: LoopScheduleState;
  disabled: boolean;
  removable: boolean;
  removeBlockedReason?: string;
  onChange: (node: ProjectJobNode) => void;
  onMove: (offset: -1 | 1) => void;
  onRemove: () => void;
}) {
  const index = loop.workflow.jobNodes.findIndex((candidate) => candidate.id === node.id);
  const isStart = loop.workflow.startJobNodeId === node.id;
  const typeOptions = [
    { value: "agent", label: "Agent" },
    { value: "human", label: "Human" },
    ...(isStart || node.type === "scheduled" ? [{ value: "scheduled", label: "Scheduled" }] : [])
  ];
  const TypeIcon = node.type === "agent" ? Bot : node.type === "human" ? UserRound : CalendarClock;

  return (
    <form aria-label={`Job Node ${node.id}`} className="@container/loop-form grid gap-4 p-4" onSubmit={(event) => event.preventDefault()}>
      <header className="flex items-start gap-2 border-b border-divider-strong pb-3">
        <BriefcaseBusiness className="mt-0.5 size-4 text-primary" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 className="font-mono text-sm font-semibold">Job Node</h2>
          <p className="mt-1 text-xs text-muted-foreground">Executes work, then transfers control to its paired Validation Node.</p>
        </div>
        <Button type="button" size="icon-xs" variant="outline" aria-label={`Move ${node.id} earlier`} disabled={disabled || index <= 0} onClick={() => onMove(-1)}><ArrowUp /></Button>
        <Button type="button" size="icon-xs" variant="outline" aria-label={`Move ${node.id} later`} disabled={disabled || index < 0 || index >= loop.workflow.jobNodes.length - 1} onClick={() => onMove(1)}><ArrowDown /></Button>
        <DeleteAction deleteLabel={`Remove Job Node pair ${node.id}`} deleteType="Job/Validation pair" resourceName={node.id} disabled={disabled || !removable} onDelete={onRemove} />
      </header>
      {!removable && removeBlockedReason ? <Alert><AlertDescription>{removeBlockedReason}</AlertDescription></Alert> : null}
      <TextField label="Job Node ID" value={node.id} error={jobNodeIdError(node, loop, allLoops)} required disabled={disabled} density="compact" maxLength={160} onChange={(id) => onChange({ ...node, id })} />
      <TextAreaField label="Job description" value={node.description} error={node.description.trim() ? undefined : "Job description is required."} required disabled={disabled} density="compact" rows={2} maxLength={2_000} onChange={(description) => onChange({ ...node, description })} />
      <TextField
        label="Maximum retries"
        description="Additional Job executions after the first execution. Default: 3."
        type="number"
        value={node.maxRetries}
        error={Number.isInteger(node.maxRetries) && node.maxRetries >= 0 && node.maxRetries <= 100 ? undefined : "Enter an integer from 0 to 100."}
        required disabled={disabled} density="compact"
        onChange={(value) => onChange({ ...node, maxRetries: Number(value) })}
      />
      <SelectField label="Job node type" value={node.type} options={typeOptions} disabled={disabled} density="compact" onChange={(type) => onChange(changeJobNodeType(node, type as ProjectJobNode["type"]))} />
      <span className="flex items-center gap-1 font-mono text-[0.62rem] text-muted-foreground"><TypeIcon className="size-3" aria-hidden="true" /> {node.type}</span>
      {!isStart && node.type === "scheduled" ? <Alert variant="destructive"><AlertDescription>Scheduled Job is allowed only as the Workflow start.</AlertDescription></Alert> : null}
      <TextAreaField label="Job task" value={node.task} error={node.task.trim() ? undefined : "Job task is required."} required disabled={disabled} density="compact" rows={4} maxLength={20_000} onChange={(task) => onChange({ ...node, task })} />
      {isProjectProviderJobNode(node) ? (
        <ExecutionCompositionFields roleLabel="Job" value={node} profiles={profiles} instructions={instructions} skills={skills} runtime={runtime} disabled={disabled} onChange={(composition) => onChange({ ...node, ...composition })} />
      ) : null}
      {node.type === "scheduled" ? <JobScheduleEditor node={node} state={scheduleState} disabled={disabled} onChange={onChange} /> : null}
      <NodeAppearanceFields value={node} roleLabel="Job" disabled={disabled} onChange={(appearance) => onChange({ ...node, ...appearance })} />
      <div className="grid gap-2 rounded-lg border border-divider-strong bg-panel-section p-3 text-xs" aria-label="Fixed Job transitions">
        <span className="flex items-center gap-2"><ArrowRight className="size-3.5 text-primary" aria-hidden="true" /><strong>Fixed:</strong> Job completed → {node.validationNodeId}</span>
        <span className="flex items-center gap-2"><RotateCcw className="size-3.5 text-tertiary" aria-hidden="true" /><strong>Fixed:</strong> Validation FAIL → paired Job while retry budget remains</span>
      </div>
    </form>
  );
}
