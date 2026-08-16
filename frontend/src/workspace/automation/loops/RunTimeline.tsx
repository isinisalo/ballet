import type { RootRunDetail } from "@shared/api/workspace-contracts";
import { ArrowRight, BriefcaseBusiness, ShieldCheck, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildRunTimeline, type RunTimelineEntry } from "./runTimelineModel";

export function RunTimeline({ root }: { root: RootRunDetail }) {
  const entries = buildRunTimeline(root);
  return (
    <section className="grid min-w-0 gap-3 border border-divider-strong bg-card p-3" aria-labelledby="run-timeline-heading">
      <header className="flex items-center justify-between gap-2">
        <h2 id="run-timeline-heading" className="font-mono text-[0.66rem] font-semibold uppercase tracking-[0.05em] text-muted-foreground">Work Loop Node timeline</h2>
        <span className="font-mono text-[0.58rem] text-muted-foreground">{entries.length} canonical events</span>
      </header>
      <ol className="grid max-h-96 gap-2 overflow-auto">
        {entries.map((entry) => <TimelineRow key={entry.id} entry={entry} />)}
      </ol>
      {entries.length === 0 ? <p className="text-xs text-muted-foreground">No persisted outcomes or control-flow events yet.</p> : null}
    </section>
  );
}

function TimelineRow({ entry }: { entry: RunTimelineEntry }) {
  const Icon = entry.tone === "work" ? BriefcaseBusiness : entry.tone === "validation" ? ShieldCheck : entry.tone === "repair" ? Wrench : ArrowRight;
  return <li className="grid grid-cols-[auto_1fr_auto] items-start gap-2 border-l-2 border-divider-strong bg-background/50 p-2">
    <Icon className={cn("mt-0.5 size-3.5", entry.tone === "work" && "text-primary", entry.tone === "validation" && "text-secondary", entry.tone === "repair" && "text-tertiary", entry.tone === "terminal" && "text-destructive")} />
    <span className="min-w-0"><strong className="block font-mono text-[0.64rem]">{entry.title}</strong><span className="block text-xs text-muted-foreground">{entry.detail}</span><time className="font-mono text-[0.56rem] text-muted-foreground">{entry.at}</time></span>
    <span className="font-mono text-[0.58rem] text-muted-foreground">r{entry.stateRevision}</span>
  </li>;
}
