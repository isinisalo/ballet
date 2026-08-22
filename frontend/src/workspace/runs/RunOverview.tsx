import { useState } from "react";
import { Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { RootRunSummary, RunTarget } from "@shared/api/workspace-contracts";
import { runGraphNodePath, runGraphPath } from "../routing";
import { runApi } from "./runApi";
import type { RunDashboardState } from "./useRunDashboard";

export function RunOverview({ dashboard, navigate }: { dashboard: RunDashboardState; navigate: (path: string) => void }) {
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const open = (target: RunTarget, rootRunId?: string) => navigate(target.kind === "graph"
    ? runGraphPath(target.id, rootRunId)
    : runGraphNodePath(target.id, rootRunId));
  const start = async (target: RunTarget) => {
    setPending(`${target.kind}:${target.id}`);
    try {
      const detail = await runApi.start(target.kind, target.id);
      open(target, detail.rootRunId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to start Run.");
    } finally { setPending(""); }
  };
  return <div className="min-w-0 flex-1 overflow-auto">
    {error ? <Alert variant="destructive" className="m-4"><AlertDescription>{error}</AlertDescription></Alert> : null}
    <TargetSection title="Graph Run" targets={[dashboard.targets.graph]} pending={pending} onOpen={open} onStart={start} />
    <TargetSection title="Graph Node Runs" targets={dashboard.targets.graphNodes} pending={pending} onOpen={open} onStart={start} />
    <RunSection title="Active" runs={dashboard.active} onOpen={(run) => navigate(run.kind === "graph" ? runGraphPath(run.targetId, run.rootRunId) : runGraphNodePath(run.targetId, run.rootRunId))} onCancel={dashboard.cancel} />
    <RunSection title="Recent" runs={dashboard.recent} onOpen={(run) => navigate(run.kind === "graph" ? runGraphPath(run.targetId, run.rootRunId) : runGraphNodePath(run.targetId, run.rootRunId))} />
  </div>;
}

function TargetSection({ title, targets, pending, onOpen, onStart }: {
  title: string; targets: RunTarget[]; pending: string;
  onOpen: (target: RunTarget) => void; onStart: (target: RunTarget) => void;
}) {
  return <section className="border-b border-divider-strong"><h2 className="bg-panel-section px-4 py-2 font-mono text-[0.65rem] uppercase tracking-wide text-muted-foreground">{title}</h2><div className="grid gap-2 p-4 sm:grid-cols-2 xl:grid-cols-3">{targets.map((target) => <div key={`${target.kind}:${target.id}`} className="rounded border border-divider-strong bg-card p-3"><div className="truncate font-mono text-xs text-tertiary">{target.id}</div><div className="mt-1 text-xs text-muted-foreground">{target.description ?? target.name}</div><div className="mt-3 flex gap-2"><Button size="sm" variant="outline" onClick={() => onOpen(target)}>Open</Button><Button size="sm" disabled={!target.ready || pending === `${target.kind}:${target.id}`} onClick={() => void onStart(target)}><Play /> Start</Button></div>{target.issues.length ? <p className="mt-2 text-xs text-destructive">{target.issues[0].message}</p> : null}</div>)}</div></section>;
}
function RunSection({ title, runs, onOpen, onCancel }: { title: string; runs: RootRunSummary[]; onOpen: (run: RootRunSummary) => void; onCancel?: (run: RootRunSummary) => Promise<void> }) {
  return <section className="border-b border-divider-strong"><h2 className="bg-panel-section px-4 py-2 font-mono text-[0.65rem] uppercase tracking-wide text-muted-foreground">{title}</h2>{runs.length ? runs.map((run) => <div key={run.rootRunId} className="flex items-center gap-3 border-t border-divider-strong px-4 py-3"><button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpen(run)}><div className="truncate font-mono text-xs">{run.targetId}</div><div className="text-xs text-muted-foreground">{run.status} · {run.updatedAt}</div></button>{onCancel ? <Button size="icon-sm" variant="ghost" aria-label={`Cancel ${run.targetId}`} onClick={() => void onCancel(run)}><X /></Button> : null}</div>) : <p className="px-4 py-5 text-xs text-muted-foreground">No {title.toLowerCase()} Runs.</p>}</section>;
}
