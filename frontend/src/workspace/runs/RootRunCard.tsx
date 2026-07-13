import type { RootRunSummary } from "@shared/api/workspace-contracts";
import { Activity, CalendarClock, GitCommitHorizontal, Square } from "lucide-react";
import { OperationalStatus } from "@/components/shared/workspace-ui";
import { Button } from "@/components/ui/button";
import { changedFilesLabel, currentRunLabel, cancellableRunStatuses, runStatusTone, runSummaryPath } from "./runPresentation";

export function RootRunCard({ run, pending, navigate, onCancel }: {
  run: RootRunSummary;
  pending: boolean;
  navigate: (path: string) => void;
  onCancel?: (run: RootRunSummary) => void;
}) {
  const report = run.finalization?.report;
  return (
    <article className="grid gap-2 border-b border-divider-strong px-3 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <button type="button" className="min-w-0 text-left" onClick={() => navigate(runSummaryPath(run))}>
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <Activity className="size-3.5 text-muted-foreground" />
          <strong className="truncate font-mono text-xs">{run.targetId}</strong>
          <OperationalStatus compact label={run.status} tone={runStatusTone(run.status)} />
          <span className="flex items-center gap-1 font-mono text-[0.6rem] text-muted-foreground">
            {run.source === "schedule" ? <CalendarClock className="size-3" /> : null}{run.source}
          </span>
        </span>
        <span className="mt-1 block truncate font-mono text-[0.65rem] text-muted-foreground">{currentRunLabel(run)} · {run.rootRunId}</span>
        {run.finalization ? <span className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[0.6rem] text-muted-foreground">finalization: {run.finalization.status}{report?.commitSha ? <><GitCommitHorizontal className="size-3" />{report.commitSha}</> : null}{report ? ` · ${changedFilesLabel(report.changedFiles)}` : null}{report?.retained ? ` · retained ${report.worktreePath}` : null}</span> : null}
      </button>
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" size="xs" onClick={() => navigate(runSummaryPath(run))}>Monitor</Button>
        {onCancel && cancellableRunStatuses.has(run.status) ? <Button type="button" variant="destructive" size="xs" disabled={pending} onClick={() => onCancel(run)}><Square />Cancel</Button> : null}
      </div>
    </article>
  );
}
