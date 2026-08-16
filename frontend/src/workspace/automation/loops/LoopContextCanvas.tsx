import { ArrowDown, ArrowRight, Boxes, CircleDot, Flag, FolderKanban } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { LoopContextProjection } from "./loopEngineerProjections";

export function LoopContextCanvas({ projection }: { projection: LoopContextProjection }) {
  return (
    <section
      data-loop-canvas
      data-loop-engineer-level="context"
      aria-label="Context level read-only Loop system canvas"
      className="relative min-w-0 overflow-hidden border border-divider-strong bg-background p-4 sm:p-6"
    >
      <div className="pointer-events-none absolute inset-0 opacity-40 bg-[image:linear-gradient(to_right,var(--divider-strong)_1px,transparent_1px),linear-gradient(to_bottom,var(--divider-strong)_1px,transparent_1px)] bg-[size:24px_24px]" />
      <div className="relative z-10 grid min-h-[30rem] items-stretch gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center">
        <ContextNode title="Project intent" icon={<FolderKanban />}>
          <p className="font-mono text-sm font-semibold text-foreground">{projection.projectIntent.name || "Unnamed project"}</p>
          {projection.projectIntent.description
            ? <p className="line-clamp-3 text-xs leading-5 text-muted-foreground">{projection.projectIntent.description}</p>
            : <p className="text-xs text-tertiary">Project description is missing.</p>}
          <Metric label="Entry Loops" value={projection.projectIntent.entryLoopCount} />
        </ContextNode>
        <ContextArrow />
        <ContextNode title="Ballet Loop system" icon={<Boxes />}>
          <div className="grid grid-cols-2 gap-2">
            <Metric label="Loops" value={projection.system.loopCount} />
            <Metric label="Installed" value={projection.system.installedModuleCount} />
            <Metric label="Custom" value={projection.system.customLoopCount} />
            <Metric label="Active Runs" value={projection.system.activeRunCount} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline"><ArrowRight /> {projection.system.flowConnectionCount} flow</Badge>
            <Badge variant="outline"><CircleDot /> {projection.system.repairConnectionCount} repair</Badge>
          </div>
        </ContextNode>
        <ContextArrow />
        <ContextNode title="Declared outcomes" icon={<Flag />}>
          {projection.declaredOutcomes.length ? (
            <ul className="grid gap-2 text-xs text-muted-foreground">
              {projection.declaredOutcomes.map((outcome) => <li key={outcome} className="flex min-w-0 gap-2"><CircleDot className="mt-0.5 size-3 shrink-0 text-secondary" /><span className="min-w-0 break-words">{outcome}</span></li>)}
            </ul>
          ) : <p className="text-xs text-tertiary">No module capabilities or leaf Loop descriptions are declared.</p>}
          {projection.hiddenOutcomeCount > 0 ? <p className="font-mono text-[0.68rem] text-muted-foreground">+{projection.hiddenOutcomeCount} more</p> : null}
        </ContextNode>
      </div>
    </section>
  );
}

function ContextNode({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <article className="grid min-h-52 content-start gap-4 rounded-lg border border-divider-strong bg-card p-4">
      <header className="flex items-center gap-2 border-b border-divider-strong pb-3 font-mono text-xs font-semibold uppercase tracking-[0.08em] text-foreground">
        <span className="text-primary [&_svg]:size-4">{icon}</span>{title}
      </header>
      {children}
    </article>
  );
}

function ContextArrow() {
  return (
    <div className="flex items-center justify-center text-loop-flow" aria-hidden="true">
      <ArrowDown className="size-5 md:hidden" />
      <ArrowRight className="hidden size-5 md:block" />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <span className="flex min-w-0 items-baseline justify-between gap-2 rounded border border-divider-strong bg-background px-2 py-1.5"><span className="text-[0.68rem] text-muted-foreground">{label}</span><strong className="font-mono text-xs text-foreground">{value}</strong></span>;
}
import type { ReactNode } from "react";
