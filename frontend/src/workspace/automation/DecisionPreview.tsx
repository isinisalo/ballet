import { Ban, CheckCircle2, LoaderCircle } from "lucide-react";
import type { PolicyPreviewResultV2 } from "@shared/api/workspace-contracts";
import { Badge } from "@/components/ui/badge";
import { formatCost } from "../policy/PolicyProjectionView";
import { rankPreviewActions, type DecisionActionView } from "./decisionModelView";

export function DecisionPreview({ actions, result, loading }: {
  actions: DecisionActionView[];
  result?: PolicyPreviewResultV2;
  loading: boolean;
}) {
  const preview = result?.preview;
  const ranked = rankPreviewActions(actions, preview);
  return <section className="grid min-w-0 gap-3 rounded-lg border border-divider-strong bg-card p-4" aria-labelledby="decision-preview-title">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div><h2 id="decision-preview-title" className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.05em]">Current Decision Preview</h2><p className="text-xs text-muted-foreground">Read-only solver evidence for the projected current state.</p></div>
      {loading ? <Badge variant="outline"><LoaderCircle className="animate-spin" /> Compiling</Badge> : <SolverBadge status={preview?.solverStatus} />}
    </div>
    <div className="grid gap-2 sm:grid-cols-3">
      <Evidence label="Projected current state" value={preview?.state?.stateId ?? "Unavailable"} />
      <Evidence label="Recommended action" value={preview?.selectedActionId ?? "None"} accent={Boolean(preview?.selectedActionId)} />
      <Evidence label="V(s) · expected total cost" value={preview?.expectedRemainingCostMicros === undefined ? "Unavailable" : formatCost(preview.expectedRemainingCostMicros)} />
    </div>
    {preview ? <>
      <div>
        <div className="mb-2 font-mono text-[0.625rem] uppercase text-muted-foreground">Admissible actions · lowest Q(s,a) first</div>
        {ranked.length ? <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))] gap-2">{ranked.map((action) => <div key={action.actionId} className={`min-w-0 rounded border p-3 ${action.recommended ? "border-secondary/60 bg-secondary/5" : "border-divider-strong bg-background/40"}`}>
          <div className="flex min-w-0 items-center justify-between gap-2"><span className="truncate font-mono text-xs text-tertiary" title={action.actionId}>{action.actionId}</span>{action.recommended ? <Badge variant="secondary"><CheckCircle2 /> Recommended</Badge> : null}</div>
          <div className="mt-2 font-mono text-xs"><span className="text-muted-foreground">Q(s,a) </span>{action.qMicros === undefined ? "Unavailable" : formatCost(action.qMicros)}</div>
        </div>)}</div> : <p className="rounded border border-dashed border-divider-strong p-3 text-xs text-muted-foreground">No admissible actions are available for this projected state.</p>}
      </div>
      {preview.excludedActions.length ? <div><div className="mb-2 font-mono text-[0.625rem] uppercase text-muted-foreground">Excluded actions</div><div className="flex flex-wrap gap-2">{preview.excludedActions.map(({ actionId, reasonCode }) => <Badge key={actionId} variant="destructive" title={`${actionId}: ${exclusionLabel(reasonCode)}`}><Ban /> <span className="max-w-48 truncate font-mono">{actionId}</span> · {exclusionLabel(reasonCode)}</Badge>)}</div></div> : null}
      {preview.message ? <p className="text-xs text-destructive">{preview.message}</p> : null}
    </> : <p className="rounded border border-dashed border-divider-strong p-4 text-xs text-muted-foreground">Decision evidence becomes available when the current draft can be projected.</p>}
  </section>;
}

function Evidence({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return <div className="min-w-0 rounded border border-divider-strong bg-background/40 p-3"><div className="font-mono text-[0.625rem] uppercase text-muted-foreground">{label}</div><div className={`mt-1 truncate font-mono text-xs ${accent ? "text-secondary" : ""}`} title={value}>{value}</div></div>;
}

function SolverBadge({ status }: { status?: string }) {
  if (!status) return <Badge variant="outline">Preview unavailable</Badge>;
  if (status === "converged" || status === "terminal") return <Badge variant="secondary">{status === "converged" ? "Solver converged" : "Terminal state"}</Badge>;
  return <Badge variant="destructive">{status.replaceAll("_", " ")}</Badge>;
}

const exclusionLabel = (reason: string) => ({
  guard_denied: "Guard denied", outside_snapshot: "Outside snapshot",
  outside_capability_model: "Not in capability model", outside_state_model: "Not in state model"
}[reason] ?? reason.replaceAll("_", " "));
