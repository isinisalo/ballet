import type { LoopScheduleState } from "@shared/api/workspace-contracts";
import { CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function LoopScheduleStatus({ state, timeZone }: { state?: LoopScheduleState; timeZone: string }) {
  return (
    <section aria-label="Schedule status" className="grid gap-1.5 border-y border-divider-strong py-2 font-mono text-[0.62rem] leading-4">
      <div className="flex items-center gap-1.5 text-muted-foreground"><CalendarClock className="size-3" /> Scheduler</div>
      <dl className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-2 gap-y-1">
        <dt className="text-muted-foreground">Next</dt>
        <dd className="break-words">{formatTimestamp(state?.nextRunAt, timeZone) ?? "Not scheduled"}</dd>
        <dt className="text-muted-foreground">Last</dt>
        <dd className="flex min-w-0 flex-wrap items-center gap-1.5">
          {state?.lastStatus ? <Badge variant={state.lastStatus === "started" ? "secondary" : "outline"} className={state.lastStatus === "started" ? "" : "border-tertiary/45 text-tertiary"}>{state.lastStatus}</Badge> : "No occurrence yet"}
          {state?.lastScheduledAt ? <span>{formatTimestamp(state.lastScheduledAt, timeZone)}</span> : null}
        </dd>
        {state?.lastRunId ? <><dt className="text-muted-foreground">Run</dt><dd className="break-all">{state.lastRunId}</dd></> : null}
      </dl>
      {state?.lastError ? <p className="break-words text-destructive">{state.lastError}</p> : null}
    </section>
  );
}

const formatTimestamp = (value: string | undefined, timeZone: string) => {
  if (!value) return undefined;
  try {
    return new Date(value).toLocaleString(undefined, { timeZone, timeZoneName: "short" });
  } catch {
    return new Date(value).toLocaleString();
  }
};
