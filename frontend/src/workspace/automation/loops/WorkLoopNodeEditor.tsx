import type {
  ExecutionProfile,
  LocalRuntime,
  LoopScheduleState,
  ProjectInstruction,
  ProjectLoop,
  ProjectWorkLoopNode,
  Skill
} from "@shared/api/workspace-contracts";
import { ArrowDown, ArrowRight, ArrowUp, RotateCcw } from "lucide-react";
import { DeleteAction, TextAreaField, TextField } from "@/components/shared/workspace-ui";
import { Button } from "@/components/ui/button";
import { WorkNodeEditor } from "./WorkNodeEditor";
import { ValidationNodeEditor } from "./ValidationNodeEditor";
import { workLoopNodeIdError } from "./loopFormValidation";

export function WorkLoopNodeEditor({ node, loop, allLoops, profiles, instructions, skills, runtime, scheduleState, disabled, onChange, onMove, onRemove }: {
  node: ProjectWorkLoopNode;
  loop: ProjectLoop;
  allLoops: ProjectLoop[];
  profiles: ExecutionProfile[];
  instructions: ProjectInstruction[];
  skills: Skill[];
  runtime: LocalRuntime;
  scheduleState?: LoopScheduleState;
  disabled: boolean;
  onChange: (node: ProjectWorkLoopNode) => void;
  onMove: (offset: -1 | 1) => void;
  onRemove: () => void;
}) {
  const index = loop.nodes.findIndex((candidate) => candidate.id === node.id);
  return (
    <form aria-label={`Work Loop Node ${node.id}`} className="@container/loop-form grid gap-4 p-4" onSubmit={(event) => event.preventDefault()}>
      <header className="flex items-start gap-2 border-b border-divider-strong pb-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-mono text-sm font-semibold">Work Loop Node</h2>
          <p className="mt-1 text-xs text-muted-foreground">Composite execution unit with fixed Work and Validation phases.</p>
        </div>
        <Button type="button" size="icon-xs" variant="outline" aria-label={`Move ${node.id} earlier`} disabled={disabled || index <= 0} onClick={() => onMove(-1)}><ArrowUp /></Button>
        <Button type="button" size="icon-xs" variant="outline" aria-label={`Move ${node.id} later`} disabled={disabled || index < 0 || index >= loop.nodes.length - 1} onClick={() => onMove(1)}><ArrowDown /></Button>
        <DeleteAction deleteLabel={`Remove Work Loop Node ${node.id}`} deleteType="Work Loop Node" resourceName={node.id} disabled={disabled} onDelete={onRemove} />
      </header>
      <TextField label="Work Loop Node ID" value={node.id} error={workLoopNodeIdError(node, loop, allLoops)} required disabled={disabled} density="compact" maxLength={160} onChange={(id) => onChange({ ...node, id })} />
      <TextAreaField label="Work Loop Node description" value={node.description} error={node.description.trim() ? undefined : "Description is required."} required disabled={disabled} density="compact" rows={2} maxLength={2_000} onChange={(description) => onChange({ ...node, description })} />
      <TextField
        label="Maximum local attempts"
        description="Total attempts, including the first Work execution."
        type="number"
        value={node.maxLocalAttempts}
        error={Number.isInteger(node.maxLocalAttempts) && node.maxLocalAttempts >= 1 && node.maxLocalAttempts <= 100 ? undefined : "Enter an integer from 1 to 100."}
        required
        disabled={disabled}
        density="compact"
        onChange={(value) => onChange({ ...node, maxLocalAttempts: Number(value) })}
      />
      <div className="grid gap-2 rounded-lg border border-divider-strong bg-panel-section p-3 text-xs" aria-label="Fixed Work Loop Node edges">
        <span className="flex items-center gap-2"><ArrowRight className="size-3.5 text-primary" aria-hidden="true" /><strong>Fixed:</strong> Work completed → Validation</span>
        <span className="flex items-center gap-2"><RotateCcw className="size-3.5 text-tertiary" aria-hidden="true" /><strong>Fixed:</strong> Validation FAIL / LOCAL_RETRY → Work</span>
        <span className="text-muted-foreground">These internal edges are runtime invariants and cannot be configured.</span>
      </div>
      <WorkNodeEditor node={node.work} isStart={loop.startNodeId === node.id} profiles={profiles} instructions={instructions} skills={skills} runtime={runtime} scheduleState={scheduleState} disabled={disabled} onChange={(work) => onChange({ ...node, work })} />
      <ValidationNodeEditor node={node.validation} profiles={profiles} instructions={instructions} skills={skills} runtime={runtime} disabled={disabled} onChange={(validation) => onChange({ ...node, validation })} />
    </form>
  );
}
