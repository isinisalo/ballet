import { useState } from "react";
import { ArrowLeft, Play, RefreshCw, Square } from "lucide-react";
import type { AppData, RootRunDetail, RunTarget } from "@shared/api/workspace-contracts";
import type { AppStreamStatus } from "../../app/useAppStream";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/workspace-ui";
import type { RouteState } from "../types";
import type { WorkspaceNavigation } from "../useWorkspaceNavigation";
import { runOverviewPath } from "../routing";
import { RunOverview } from "./RunOverview";
import { runApi } from "./runApi";
import type { RunDashboardState } from "./useRunDashboard";

export function RunWorkspace({ route, data, appStreamStatus, dashboard, navigate }: {
  route: RouteState; data: AppData; appStreamStatus: AppStreamStatus;
  dashboard: RunDashboardState; navigate: WorkspaceNavigation["navigate"];
}) {
  void data;
  void appStreamStatus;
  if (!route.runTargetKind || !route.runTargetId) return <RunOverview dashboard={dashboard} navigate={navigate} />;
  const target = route.runTargetKind === "graph"
    ? dashboard.targets.graph
    : dashboard.targets.graphNodes.find((candidate) => candidate.id === route.runTargetId);
  if (!target) return <div className="p-4"><EmptyState title="Run target not found" action="Return to the Run overview." /></div>;
  return <RunTargetWorkspace target={target} detail={route.rootRunId === dashboard.detail?.rootRunId ? dashboard.detail : undefined} navigate={navigate} refresh={dashboard.refresh} />;
}

function RunTargetWorkspace({ target, detail, navigate, refresh }: {
  target: RunTarget; detail?: RootRunDetail; navigate: (path: string) => void; refresh: () => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const start = async () => {
    setPending(true);
    try { await runApi.start(target.kind, target.id); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to start Run."); }
    finally { setPending(false); }
  };
  return <section className="flex min-h-0 min-w-0 flex-1 flex-col">
    <header className="flex items-center gap-2 border-b border-divider-strong bg-card px-3 py-2"><Button variant="ghost" size="sm" onClick={() => navigate(runOverviewPath())}><ArrowLeft /> Runs</Button><div className="min-w-0 flex-1"><div className="truncate font-mono text-xs text-tertiary">{target.id}</div><div className="truncate text-xs text-muted-foreground">{target.kind === "graph" ? "Graph Run" : "Graph Node Run"}</div></div><Button size="sm" variant="outline" onClick={() => void refresh()}><RefreshCw /> Refresh</Button>{detail && ["queued", "running", "waiting_for_input"].includes(detail.status) ? <Button size="sm" variant="outline" onClick={() => void runApi.cancel(detail).then(refresh)}><Square /> Cancel</Button> : <Button size="sm" disabled={!target.ready || pending} onClick={() => void start()}><Play /> Start</Button>}</header>
    {error ? <Alert variant="destructive" className="m-3"><AlertDescription>{error}</AlertDescription></Alert> : null}
    {detail ? <RunDetail detail={detail} /> : <div className="grid flex-1 place-items-center p-8"><EmptyState title="No selected Run" action="Start a new immutable snapshot or open an existing Run from the overview." /></div>}
  </section>;
}
function RunDetail({ detail }: { detail: RootRunDetail }) {
  return <div className="min-h-0 flex-1 overflow-auto p-4"><div className="grid gap-3 lg:grid-cols-3"><Evidence label="Status" value={detail.status} /><Evidence label="State revision" value={String(detail.stateRevision)} /><Evidence label="Transitions" value={String(detail.controlFlowEvents.length)} /></div><div className="mt-4 rounded border border-divider-strong bg-card"><h2 className="border-b border-divider-strong px-3 py-2 font-mono text-[0.65rem] uppercase text-muted-foreground">Control flow</h2>{detail.controlFlowEvents.length ? detail.controlFlowEvents.map((event) => <div key={event.id} className="border-b border-divider-strong px-3 py-2 text-xs last:border-0"><span className="font-mono text-tertiary">{event.sequence}</span> · {event.kind}</div>) : <p className="p-3 text-xs text-muted-foreground">Waiting for the first routing decision.</p>}</div></div>;
}
function Evidence({ label, value }: { label: string; value: string }) { return <div className="rounded border border-divider-strong bg-card p-3"><div className="font-mono text-[0.65rem] uppercase text-muted-foreground">{label}</div><div className="mt-1 text-sm">{value}</div></div>; }
