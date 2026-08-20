import type { ReactNode } from "react";
import type { ProjectAutomationConfig, ProjectLoop } from "@shared/api/workspace-contracts";
import { ArrowLeft, ArrowRight, Braces, CircleCheck, CircleX, Plus, Settings2, ShieldCheck } from "lucide-react";
import { SelectField, TextAreaField, TextField } from "@/components/shared/workspace-ui";
import { Button } from "@/components/ui/button";
import { addJobPair, createJobNodeDraft, nextJobNodeId } from "./loopEditorState";
import type { WorkflowCanvasSelection } from "./LoopCanvas";
import { loopIdError } from "./loopFormValidation";

export function LoopDefinitionEditor({ config, loop, initialStateText, initialStateError, disabled, onLoopChange, onInitialStateTextChange, onSelection, onBackToGraph }: {
  config: ProjectAutomationConfig;
  loop: ProjectLoop;
  initialStateText: string;
  initialStateError?: string;
  disabled: boolean;
  onLoopChange: (loop: ProjectLoop) => void;
  onInitialStateTextChange: (text: string) => void;
  onSelection: (selection: WorkflowCanvasSelection) => void;
  onBackToGraph: () => void;
}) {
  const addJob = () => {
    const job = createJobNodeDraft(nextJobNodeId(config, loop));
    onLoopChange(addJobPair(loop, job));
    onSelection({ kind: "job", id: job.id });
  };
  return (
    <form aria-label="Loop definition" className="@container/loop-form grid gap-4 p-4" onSubmit={(event) => event.preventDefault()}>
      <header className="flex items-start gap-2 border-b border-divider-strong pb-3">
        <Settings2 className="mt-0.5 size-4 text-primary" aria-hidden="true" />
        <div><h2 className="font-mono text-sm font-semibold">Loop definition</h2><p className="mt-1 text-xs text-muted-foreground">Loop identity, canonical State, and its Workflow entry point.</p></div>
      </header>
      <TextField label="Loop ID" value={loop.id} error={loopIdError(loop, config.loops)} required disabled={disabled} density="compact" maxLength={101} onChange={(id) => onLoopChange({ ...loop, id })} />
      <TextAreaField label="Loop description" value={loop.description} error={loop.description.trim() ? undefined : "Loop description is required."} required disabled={disabled} density="compact" rows={3} maxLength={2_000} onChange={(description) => onLoopChange({ ...loop, description })} />
      <TextAreaField label="State description" value={loop.state.description} error={loop.state.description.trim() ? undefined : "State description is required."} required disabled={disabled} density="compact" rows={2} maxLength={2_000} onChange={(description) => onLoopChange({ ...loop, state: { ...loop.state, description } })} />
      <TextAreaField
        label="Accepted capabilities"
        description="One capability per line. Graph flow routes must match this allowlist."
        value={loop.capabilities.accepts.join("\n")}
        error={loop.capabilities.accepts.length ? undefined : "At least one accepted capability is required."}
        required disabled={disabled} density="compact" rows={2} maxLength={20_000}
        onChange={(value) => onLoopChange({ ...loop, capabilities: { ...loop.capabilities, accepts: capabilityLines(value) } })}
      />
      <TextAreaField
        label="Provided capabilities"
        description="One capability per line. Repair routes select from these capabilities."
        value={loop.capabilities.provides.join("\n")}
        error={loop.capabilities.provides.length ? undefined : "At least one provided capability is required."}
        required disabled={disabled} density="compact" rows={2} maxLength={20_000}
        onChange={(value) => onLoopChange({ ...loop, capabilities: { ...loop.capabilities, provides: capabilityLines(value) } })}
      />
      <div className="grid gap-1">
        <span className="flex items-center gap-1 font-mono text-[0.68rem] font-medium text-muted-foreground"><Braces className="size-3" aria-hidden="true" /> JSON State is validated before it enters the domain draft.</span>
        <TextAreaField label="Initial State JSON" value={initialStateText} error={initialStateError} required disabled={disabled} density="compact" rows={8} onChange={onInitialStateTextChange} />
      </div>
      {loop.workflow.jobNodes.length ? (
        <SelectField label="Start Job Node" value={loop.workflow.startJobNodeId} options={loop.workflow.jobNodes.map((job) => ({ value: job.id, label: `${job.id} · ${job.description || "No description"}` }))} required disabled={disabled} density="compact" onChange={(startJobNodeId) => onLoopChange({ ...loop, workflow: { ...loop.workflow, startJobNodeId } })} />
      ) : null}
      <section aria-labelledby="workflow-pairs-heading" className="grid gap-2 rounded-lg border border-divider-strong bg-card p-3">
        <div className="flex items-center gap-2"><h3 id="workflow-pairs-heading" className="font-mono text-xs font-semibold uppercase tracking-[0.08em]">Workflow nodes</h3><Button type="button" size="xs" variant="outline" className="ml-auto" disabled={disabled} onClick={addJob}><Plus /> Add Job</Button></div>
        {loop.workflow.jobNodes.map((job) => {
          const validation = loop.workflow.validationNodes.find((node) => node.id === job.validationNodeId);
          const passEdge = loop.workflow.passEdges.find((edge) => edge.sourceValidationNodeId === job.validationNodeId);
          const failEdge = loop.workflow.failEdges.find((edge) => edge.sourceValidationNodeId === job.validationNodeId);
          return <div key={job.id} className="grid gap-2 rounded border border-divider-strong bg-background p-2">
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
              <WorkflowSelectionButton label={`Edit Job Node ${job.id}`} icon={<span className="font-mono text-[0.58rem] text-primary">JOB</span>} value={job.id} disabled={disabled} onClick={() => onSelection({ kind: "job", id: job.id })} />
              <ArrowRight className="size-4 text-primary" aria-label="validate" />
              <WorkflowSelectionButton label={`Edit Validation Node ${validation?.id ?? job.validationNodeId}`} icon={<ShieldCheck className="size-3 text-secondary" />} value={validation?.id ?? job.validationNodeId} disabled={disabled || !validation} onClick={() => onSelection({ kind: "validation", id: job.validationNodeId })} />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {passEdge ? <WorkflowSelectionButton label={`Edit Pass Edge ${passEdge.id}`} icon={<CircleCheck className="size-3 text-secondary" />} value={passEdge.id} disabled={disabled} onClick={() => onSelection({ kind: "pass-edge", id: passEdge.id })} /> : null}
              {failEdge ? <WorkflowSelectionButton label={`Edit Fail Edge ${failEdge.id}`} icon={<CircleX className="size-3 text-destructive" />} value={failEdge.id} disabled={disabled} onClick={() => onSelection({ kind: "fail-edge", id: failEdge.id })} /> : null}
            </div>
          </div>;
        })}
        {loop.workflow.jobNodes.length === 0 ? <p className="text-xs text-muted-foreground">Add the first Job to atomically create its Validation, PassEdge→PASS, and FailEdge→FAIL.</p> : null}
      </section>
      <div className="flex items-center gap-2 border-t border-divider-strong pt-3 text-xs text-muted-foreground">
        <span className="flex-1">Connections outside this Workflow are governed in Graph Engineering.</span>
        <Button type="button" size="xs" variant="link" onClick={onBackToGraph}><ArrowLeft /> Open Graph Engineering</Button>
      </div>
    </form>
  );
}

const capabilityLines = (value: string) => [...new Set(value.split(/[\n,]/).map((entry) => entry.trim()).filter(Boolean))];

function WorkflowSelectionButton({ label, icon, value, disabled, onClick }: { label: string; icon: ReactNode; value: string; disabled: boolean; onClick: () => void }) {
  return <button type="button" aria-label={label} disabled={disabled} className="flex min-w-0 items-center gap-2 rounded border border-divider-strong bg-background px-2 py-1.5 text-left text-xs hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={onClick}>{icon}<span className="truncate font-mono">{value}</span></button>;
}
