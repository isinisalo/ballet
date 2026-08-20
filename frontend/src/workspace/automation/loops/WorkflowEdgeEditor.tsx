import type { ProjectFailEdge, ProjectLoop, ProjectPassEdge } from "@shared/api/workspace-contracts";
import { ArrowRight, CircleCheck, CircleX } from "lucide-react";
import { SelectField, TextField } from "@/components/shared/workspace-ui";
import { cn } from "@/lib/utils";
import { workflowEdgeIdError } from "./loopFormValidation";

export function WorkflowEdgeEditor({ edge, loop, disabled, onChange }: {
  edge: ProjectPassEdge | ProjectFailEdge;
  loop: ProjectLoop;
  disabled: boolean;
  onChange: (edge: ProjectPassEdge | ProjectFailEdge) => void;
}) {
  const isPass = "jobNodeId" in edge.target || edge.target.workflowResult === "PASS";
  const title = isPass ? "Pass Edge" : "Fail Edge";
  const Icon = isPass ? CircleCheck : CircleX;
  return (
    <form aria-label={`${title} ${edge.id}`} className="grid gap-4 p-4" onSubmit={(event) => event.preventDefault()}>
      <header className="flex items-start gap-2 border-b border-divider-strong pb-3">
        <Icon className={cn("mt-0.5 size-4", isPass ? "text-secondary" : "text-destructive")} aria-hidden="true" />
        <div><h2 className="font-mono text-sm font-semibold">{title}</h2><p className="mt-1 text-xs text-muted-foreground">Validation result route. Endpoints are fixed Workflow boundaries, not executable nodes.</p></div>
      </header>
      <TextField label={`${title} ID`} value={edge.id} error={workflowEdgeIdError(edge, loop)} required disabled={disabled} density="compact" maxLength={160} onChange={(id) => onChange({ ...edge, id })} />
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 rounded-lg border border-divider-strong bg-card p-3 font-mono text-xs">
        <span className="truncate">{edge.sourceValidationNodeId}</span><ArrowRight className={cn("size-4", isPass ? "text-secondary" : "text-destructive")} aria-hidden="true" /><strong>{isPass ? "PASS" : "FAIL"}</strong>
      </div>
      {isPass ? (
        <SelectField
          label="Pass target"
          value={"jobNodeId" in edge.target ? `job:${edge.target.jobNodeId}` : "result:PASS"}
          options={[
            ...loop.workflow.jobNodes.map((job) => ({ value: `job:${job.id}`, label: `Job Node · ${job.id}` })),
            { value: "result:PASS", label: "Workflow result · PASS" }
          ]}
          disabled={disabled}
          density="compact"
          onChange={(value) => onChange({
            ...(edge as ProjectPassEdge),
            target: value === "result:PASS" ? { workflowResult: "PASS" } : { jobNodeId: value.slice("job:".length) }
          })}
        />
      ) : <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-muted-foreground"><strong className="text-destructive">Fixed FAIL endpoint.</strong> After the local retry budget is exhausted, this edge escalates outside the Workflow to the Graph Engineering Orchestrator.</p>}
    </form>
  );
}
