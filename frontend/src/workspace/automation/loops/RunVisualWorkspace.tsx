import { useState, type ReactNode } from "react";
import type { RootRunDetail } from "@shared/api/workspace-contracts";
import { Activity, GitBranch, Orbit, Radio, ShieldCheck, Sparkles, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { loopRunStatusVariant } from "./loopRunState";
import { RunLoopMap } from "./RunLoopMap";

type RunVisualMode = "mission" | "all-loops";

export function RunVisualWorkspace({ root, children }: { root: RootRunDetail; children: ReactNode }) {
  const [mode, setMode] = useState<RunVisualMode>(() =>
    root.current?.nodeRole === "orchestrator" || root.repair.pendingRepair ? "all-loops" : "mission");

  return (
    <section className="min-w-0 border-b border-divider-strong bg-panel" aria-labelledby="run-visual-workspace-heading">
      <header className="flex min-h-10 items-center justify-between gap-3 border-b border-divider-strong bg-card px-3 py-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <Orbit className="size-3.5 shrink-0 text-secondary" />
          <h2 id="run-visual-workspace-heading" className="truncate font-mono text-[0.66rem] font-semibold uppercase tracking-[0.05em]">
            Run mission control
          </h2>
        </div>
        <div role="tablist" aria-label="Run graph views" className="flex shrink-0 items-center gap-1">
          <Button type="button" role="tab" aria-selected={mode === "mission"} variant={mode === "mission" ? "secondary" : "ghost"} size="sm" className="h-7 px-2 text-[0.65rem]" onClick={() => setMode("mission")}>
            <Sparkles className="size-3" /> Mission
          </Button>
          <Button type="button" role="tab" aria-selected={mode === "all-loops"} variant={mode === "all-loops" ? "secondary" : "ghost"} size="sm" className="h-7 px-2 text-[0.65rem]" onClick={() => setMode("all-loops")}>
            <GitBranch className="size-3" /> All Loops
          </Button>
        </div>
      </header>
      <div className="grid min-w-0 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0">
          {mode === "mission" ? <>
            <MissionBrief root={root} />
            <div role="tabpanel" aria-label="Mission Loop canvas" className="grid min-h-[28rem] min-w-0 overflow-hidden">
              {children}
            </div>
          </> : <div role="tabpanel" aria-label="All Loops Run map"><RunLoopMap root={root} /></div>}
        </div>
        <RunLiveRail root={root} />
      </div>
    </section>
  );
}

function MissionBrief({ root }: { root: RootRunDetail }) {
  const role = root.current?.nodeRole;
  const Icon = role === "validation" ? ShieldCheck : role === "orchestrator" ? Wrench : Activity;
  return (
    <div className="flex min-w-0 items-center gap-3 border-b border-divider-strong bg-background/70 px-4 py-2.5" data-run-mission-role={role}>
      <span className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full border bg-card",
        role === "validation" ? "border-secondary text-secondary" : role === "orchestrator" ? "border-tertiary text-tertiary" : "border-primary text-primary"
      )}>
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[0.56rem] uppercase tracking-[0.08em] text-muted-foreground">Current mission</p>
        <p className="truncate text-sm" title={runMissionNarration(root)}>{runMissionNarration(root)}</p>
      </div>
      <Badge variant={loopRunStatusVariant(root.status)} className="shrink-0">{root.status}</Badge>
    </div>
  );
}

function RunLiveRail({ root }: { root: RootRunDetail }) {
  const current = root.current;
  const latestOutcome = current?.lastWorkOutcome?.summary
    ?? (current?.lastValidationDecision ? `Validation · ${current.lastValidationDecision}` : undefined)
    ?? rootOutcomeSummary(root);
  const fields = [
    ["Active node", current?.workLoopNodeId ?? "—"],
    ["Role", current?.nodeRole ? roleLabel(current.nodeRole) : "—"],
    ["Profile", current?.executionProfileId ?? "—"],
    ["State", `r${root.state.currentRevision}`],
    ["Local attempt", current?.localRetryAttempt?.toString() ?? "0"],
    ["Repair depth", current?.repairDepth?.toString() ?? "0"]
  ];
  return (
    <aside className="grid content-start border-t border-divider-strong bg-card xl:border-t-0 xl:border-l" aria-label="Live Run inspector">
      <div className="flex items-center justify-between gap-2 border-b border-divider-strong px-3 py-2">
        <span className="flex items-center gap-1.5 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.06em]"><Radio className="size-3 text-secondary" /> Live signal</span>
        <Badge variant={loopRunStatusVariant(root.status)}>{root.status}</Badge>
      </div>
      <dl className="grid grid-cols-2 gap-px bg-divider-strong sm:grid-cols-3 xl:grid-cols-2">
        {fields.map(([label, value]) => <div key={label} className="min-w-0 bg-card p-2.5"><dt className="font-mono text-[0.54rem] uppercase text-muted-foreground">{label}</dt><dd className="mt-1 truncate font-mono text-[0.62rem]" title={value}>{value}</dd></div>)}
      </dl>
      <div className="grid gap-3 border-t border-divider-strong p-3 text-xs">
        <SignalEvidence label="Latest outcome" value={latestOutcome} />
        <SignalEvidence label="Repair request" value={root.repair.pendingRepair
          ? `${root.repair.pendingRepair.repairRequestId} · ${root.repair.pendingRepair.reason}`
          : undefined} tone="repair" />
      </div>
    </aside>
  );
}

function SignalEvidence({ label, value, tone }: { label: string; value?: string; tone?: "repair" }) {
  return <div className="min-w-0"><p className={cn("font-mono text-[0.54rem] uppercase", tone === "repair" ? "text-tertiary" : "text-muted-foreground")}>{label}</p><p className="mt-1 line-clamp-3 text-muted-foreground" title={value}>{value ?? "—"}</p></div>;
}

export function runMissionNarration(root: RootRunDetail): string {
  const current = root.current;
  const subject = current?.workLoopNodeDescription ?? current?.workLoopNodeId ?? current?.loopDescription ?? current?.loopId;
  if (current?.nodeRole === "orchestrator") {
    return root.repair.pendingRepair
      ? `Routing ${root.repair.pendingRepair.repairRequestId} through the explicit repair allowlist.`
      : "Resolving the next explicit repair route.";
  }
  if (current?.nodeRole === "validation") return subject ? sentenceWithSubject("Validating", subject) : "Validating the current Work outcome.";
  if (current?.nodeRole === "work") return subject ? sentenceWithSubject("Working on", subject) : "Executing the current Work phase.";
  if (root.status === "finalizing") return "Finalizing canonical Run evidence.";
  if (["completed", "blocked", "failed", "cancelled"].includes(root.status)) return `Run ${root.status}.`;
  return "Waiting for the Run to claim its next canonical position.";
}

const roleLabel = (role: NonNullable<RootRunDetail["current"]>["nodeRole"]): string => role === "work" ? "Work" : role === "validation" ? "Validation" : "Orchestrator";

const sentenceWithSubject = (verb: string, subject: string): string => `${verb} “${subject}”${/[.!?]$/.test(subject) ? "" : "."}`;

const rootOutcomeSummary = (root: RootRunDetail): string | undefined => {
  if (!root.outcome) return undefined;
  if ("summary" in root.outcome) return root.outcome.summary;
  return root.outcome.role === "orchestrator" && root.outcome.state === "completed" ? root.outcome.routeReason : undefined;
};
