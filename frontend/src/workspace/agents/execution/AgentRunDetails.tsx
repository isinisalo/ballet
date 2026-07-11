import { GitBranch, GitCompare, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AgentOutcome, AgentRun } from "./types";

export function AgentRunDetails({ run }: { run: AgentRun }) {
  return (
    <div className="grid gap-3 border-t border-divider-strong bg-panel-section p-4 text-xs">
      <Snapshot run={run} />
      <Outcome outcome={run.outcome} />
      <BranchDiff run={run} />
    </div>
  );
}

function Snapshot({ run }: { run: AgentRun }) {
  return <section className="grid gap-2" aria-label="Run snapshot"><h3 className="font-mono text-[0.62rem] font-semibold uppercase tracking-[0.05em] text-muted-foreground">Immutable snapshot</h3><dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2 xl:grid-cols-4"><Meta label="Computer" value={run.runtime.deviceName} /><Meta label="Provider" value={run.runtime.provider} /><Meta label="Model / reasoning" value={`${run.runtime.model} · ${run.runtime.reasoning}`} /><Meta label="Base revision" value={run.project.headSha} /><Meta label="Repository" value={run.project.repositoryUrl} /><Meta label="Worktree" value={run.worktreePath ?? "Created when execution starts"} /><Meta label="Network" value={run.runtime.policy.network ? "allowed" : "denied"} /><Meta label="Read-only roots" value={run.runtime.policy.readOnlyRoots.join(" · ") || "none"} /></dl></section>;
}

function Outcome({ outcome }: { outcome?: AgentOutcome }) {
  if (!outcome) return null;
  const destructive = outcome.outcome === "failed" || outcome.outcome === "blocked";
  return <section className="grid gap-2 border-t border-divider-strong pt-3" aria-label="Run outcome"><div className="flex items-center gap-2"><ShieldCheck className="size-3.5 text-secondary" /><h3 className="font-semibold">Outcome</h3><Badge variant={destructive ? "destructive" : "secondary"}>{outcome.outcome}</Badge></div><p className="text-muted-foreground">{outcome.summary}</p>{outcome.checks.length ? <ul className="grid gap-1 font-mono text-[0.65rem]">{outcome.checks.map((check) => <li key={check.name} className="flex justify-between gap-3"><span>{check.name}</span><span className={check.status === "failed" ? "text-destructive" : check.status === "passed" ? "text-secondary" : "text-muted-foreground"}>{check.status}</span></li>)}</ul> : null}</section>;
}

function BranchDiff({ run }: { run: AgentRun }) {
  const branch = run.branch ?? run.outcome?.artifacts?.branch;
  const diff = run.outcome?.artifacts?.diff;
  const files = run.outcome?.artifacts?.changed_files ?? [];
  if (!branch && !diff && files.length === 0) return null;
  return <section className="grid gap-2 border-t border-divider-strong pt-3" aria-label="Branch and diff"><div className="flex flex-wrap gap-4 font-mono text-[0.68rem]"><span className="flex items-center gap-1.5"><GitBranch className="size-3.5 text-muted-foreground" /> {branch ?? "No branch"}</span><span className="flex items-center gap-1.5"><GitCompare className="size-3.5 text-muted-foreground" /> {files.length} changed files</span></div>{files.length ? <p className="break-words font-mono text-[0.65rem] text-muted-foreground">{files.join(" · ")}</p> : null}{diff ? <pre className="max-h-72 overflow-auto border border-divider-strong bg-background p-3 font-mono text-[0.65rem] whitespace-pre">{diff}</pre> : null}</section>;
}

function Meta({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="font-mono text-[0.56rem] uppercase text-muted-foreground">{label}</dt><dd className="truncate font-mono text-[0.68rem]" title={value}>{value}</dd></div>;
}
