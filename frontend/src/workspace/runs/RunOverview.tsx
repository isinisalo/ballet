import { useState } from "react";
import { Activity, History, Play } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Panel } from "@/components/shared/workspace-ui";
import { toErrorMessage } from "@/lib/errors";
import type { RootRunSummary, RunTarget } from "@shared/api/workspace-contracts";
import { runAgentPath, runLoopPath } from "../routing";
import type { RunDashboardState } from "./useRunDashboard";
import { runApi } from "./runApi";
import { RootRunCard } from "./RootRunCard";
import { RunTargetCard } from "./RunTargetCard";

export function RunOverview({ dashboard, navigate }: { dashboard: RunDashboardState; navigate: (path: string) => void }) {
  const [pending, setPending] = useState("");
  const [actionError, setActionError] = useState("");
  const openTarget = (target: RunTarget, rootRunId = target.activeRootRunId) => navigate(target.kind === "loop" ? runLoopPath(target.id, rootRunId) : runAgentPath(target.id, rootRunId));
  const start = async (target: RunTarget) => {
    setPending(`${target.kind}:${target.id}`);
    setActionError("");
    try {
      const run = await runApi.start(target.kind, target.id);
      await dashboard.refresh();
      openTarget(target, run.rootRunId);
    } catch (caught) {
      setActionError(toErrorMessage(caught, `Unable to start ${target.name}.`));
    } finally { setPending(""); }
  };
  const cancel = async (run: RootRunSummary) => {
    setPending(run.rootRunId);
    setActionError("");
    try { await dashboard.cancel(run); }
    catch (caught) { setActionError(toErrorMessage(caught, "Unable to cancel root run.")); }
    finally { setPending(""); }
  };

  return (
    <Panel title="Run Overview" icon={<Play />} contentClassName="grid gap-0 p-0" action={<span className="font-mono text-[0.62rem] text-muted-foreground">stream: {dashboard.streamStatus}</span>}>
      {dashboard.error || actionError ? <Alert variant="destructive" className="m-4 mb-0"><AlertDescription>{actionError || dashboard.error}</AlertDescription></Alert> : null}
      <RunListSection title="Active root runs" icon={<Activity />} empty={dashboard.loading ? "Loading active runs…" : "No active runs."} runs={dashboard.active} pending={pending} navigate={navigate} onCancel={cancel} />
      <TargetSection title="Configured Loops" targets={dashboard.targets.loops} pending={pending} onOpen={openTarget} onStart={start} />
      <TargetSection title="Launchable agents" targets={dashboard.targets.agents} pending={pending} onOpen={openTarget} onStart={start} />
      <RunListSection title="Recent runs" icon={<History />} empty={dashboard.loading ? "Loading recent runs…" : "No recent runs."} runs={dashboard.recent} pending={pending} navigate={navigate} />
    </Panel>
  );
}

function RunListSection({ title, icon, empty, runs, pending, navigate, onCancel }: { title: string; icon: React.ReactNode; empty: string; runs: RootRunSummary[]; pending: string; navigate: (path: string) => void; onCancel?: (run: RootRunSummary) => void }) {
  return <section className="border-b border-divider-strong last:border-b-0"><h2 className="flex h-10 items-center gap-2 bg-panel-section px-4 font-mono text-[0.66rem] font-semibold uppercase tracking-[0.05em] text-muted-foreground">{icon}{title}</h2>{runs.length ? runs.map((run) => <RootRunCard key={run.rootRunId} run={run} pending={pending === run.rootRunId} navigate={navigate} onCancel={onCancel} />) : <p className="px-4 py-5 text-xs text-muted-foreground">{empty}</p>}</section>;
}

function TargetSection({ title, targets, pending, onOpen, onStart }: { title: string; targets: RunTarget[]; pending: string; onOpen: (target: RunTarget) => void; onStart: (target: RunTarget) => void }) {
  return <section className="border-b border-divider-strong"><h2 className="h-10 bg-panel-section px-4 pt-3 font-mono text-[0.66rem] font-semibold uppercase tracking-[0.05em] text-muted-foreground">{title}</h2>{targets.length ? <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">{targets.map((target) => <RunTargetCard key={`${target.kind}:${target.id}`} target={target} pending={pending === `${target.kind}:${target.id}`} onOpen={() => onOpen(target)} onStart={() => onStart(target)} />)}</div> : <p className="px-4 py-5 text-xs text-muted-foreground">No {title.toLowerCase()}.</p>}</section>;
}
