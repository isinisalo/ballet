import type { ReactNode } from "react";
import { ArrowDown, ArrowRight, CircleDot } from "lucide-react";
import type { LoopNodeStyle, LoopTheme } from "@shared/api/workspace-contracts";
import { LoopNodeArtwork } from "./LoopNodeArtwork";
import type { LoopContextProjection } from "./loopEngineerProjections";
import { loopThemeCssProperties } from "./loopTheme";

export function LoopContextCanvas({ projection, theme }: { projection: LoopContextProjection; theme: LoopTheme }) {
  return (
    <section
      data-loop-canvas
      data-loop-engineer-level="context"
      aria-label="Context level read-only Loop system planet canvas"
      className="relative grid min-w-0 flex-1 self-stretch grid-rows-[minmax(0,1fr)_auto] overflow-hidden border border-divider-strong bg-background px-4 py-8 sm:px-6"
      style={loopThemeCssProperties(theme)}
    >
      <div className="pointer-events-none absolute inset-0 opacity-40 bg-[image:radial-gradient(circle,var(--divider-strong)_1px,transparent_1.5px),linear-gradient(to_right,var(--divider-strong)_1px,transparent_1px),linear-gradient(to_bottom,var(--divider-strong)_1px,transparent_1px)] bg-[size:48px_48px,24px_24px,24px_24px]" />
      <div className="pointer-events-none absolute inset-[12%] hidden rounded-[50%] border border-[color-mix(in_srgb,var(--loop-theme-edge-color)_24%,transparent)] md:block" />
      <div className="pointer-events-none absolute inset-[24%] hidden rounded-[50%] border border-dashed border-primary/20 md:block" />
      <div className="relative z-10 grid min-h-[30rem] items-center gap-10 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.2fr)_auto_minmax(0,1fr)] md:gap-4">
        <ContextPlanet title="Project intent" style="vector-planet" size="medium">
          <p className="font-mono text-sm font-semibold text-foreground">{projection.projectIntent.name || "Unnamed project"}</p>
          {projection.projectIntent.description
            ? <p className="text-xs leading-5 text-muted-foreground">{projection.projectIntent.description}</p>
            : <p className="text-xs text-tertiary">Project description is missing.</p>}
          <Metric label="Entry Loops" value={projection.projectIntent.entryLoopCount} />
        </ContextPlanet>
        <ContextArrow />
        <ContextPlanet title="Ballet Loop system" style="terra" size="large" primary>
          <p className="text-xs leading-5 text-muted-foreground">The project system turns declared intent into governed outcomes.</p>
          <div className="flex flex-wrap justify-center gap-1.5">
            <Metric label="Loops" value={projection.system.loopCount} />
            <Metric label="Installed" value={projection.system.installedModuleCount} />
            <Metric label="Custom" value={projection.system.customLoopCount} />
            <Metric label="Active" value={projection.system.activeRunCount} active={projection.system.activeRunCount > 0} />
            <Metric label="Flow" value={projection.system.flowConnectionCount} />
            <Metric label="Repair" value={projection.system.repairConnectionCount} repair />
          </div>
        </ContextPlanet>
        <ContextArrow />
        <ContextPlanet title="Declared outcomes" style="sol" size="medium">
          {projection.declaredOutcomes.length ? (
            <ul className="grid gap-1.5 text-left text-xs text-muted-foreground">
              {projection.declaredOutcomes.map((outcome) => <li key={outcome} className="flex min-w-0 gap-2"><CircleDot className="mt-0.5 size-3 shrink-0 text-secondary" /><span className="min-w-0 break-words">{outcome}</span></li>)}
            </ul>
          ) : <p className="text-xs text-tertiary">No module capabilities or leaf Loop descriptions are declared.</p>}
          {projection.hiddenOutcomeCount > 0 ? <p className="font-mono text-[0.68rem] text-muted-foreground">+{projection.hiddenOutcomeCount} more</p> : null}
        </ContextPlanet>
      </div>
      <p className="relative z-10 pt-4 text-right font-mono text-[0.62rem] text-muted-foreground">Read-only · tracked project Loop theme</p>
    </section>
  );
}

function ContextPlanet({ title, style, size, primary = false, children }: {
  title: string;
  style: LoopNodeStyle;
  size: "medium" | "large";
  primary?: boolean;
  children: ReactNode;
}) {
  return (
    <article data-context-planet={title} className="grid min-w-0 justify-items-center gap-3 text-center">
      <div className="relative grid place-items-center">
        <span aria-hidden="true" className={`loop-artwork-node relative block rounded-full ${size === "large" ? "size-28" : "size-20"}`} data-loop-node-size="large"><LoopNodeArtwork nodeStyle={style} /></span>
        <span aria-hidden="true" className={`pointer-events-none absolute -inset-3 rounded-[50%] border ${primary ? "border-secondary/40" : "border-primary/30"}`} />
        <span aria-hidden="true" className={`pointer-events-none absolute -inset-x-5 top-1/2 h-6 -translate-y-1/2 -rotate-12 rounded-[50%] border ${primary ? "border-[color-mix(in_srgb,var(--loop-theme-edge-color)_55%,transparent)]" : "border-divider-strong"}`} />
      </div>
      <div className="grid max-w-72 gap-2">
        <h2 className="text-base font-semibold">{title}</h2>
        {children}
      </div>
    </article>
  );
}

function ContextArrow() {
  return (
    <div className="flex items-center justify-center text-[var(--loop-theme-edge-color)]" aria-hidden="true">
      <ArrowDown className="size-5 md:hidden" />
      <ArrowRight className="hidden size-5 md:block" />
    </div>
  );
}

function Metric({ label, value, active = false, repair = false }: { label: string; value: number; active?: boolean; repair?: boolean }) {
  return <span className={`inline-flex items-baseline gap-1.5 rounded-full border bg-card/95 px-2 py-1 font-mono text-[0.62rem] ${active ? "border-secondary/50 text-secondary" : repair ? "border-tertiary/40 text-tertiary" : "border-divider-strong text-muted-foreground"}`}><span>{label}</span><strong className="text-foreground">{value}</strong></span>;
}
