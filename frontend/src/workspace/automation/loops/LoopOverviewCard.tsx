import { isProjectNodeTerminalTarget, type LoopTheme, type ProjectAutomationConfig, type ProjectLoop } from "@shared/api/workspace-contracts";
import { ArrowRight, BriefcaseBusiness, CalendarClock, PanelTopOpen, ShieldCheck, Wrench } from "lucide-react";
import { DeleteAction } from "@/components/shared/workspace-ui";
import { Button } from "@/components/ui/button";
import { LoopRouteArtwork } from "./LoopRouteArtwork";

export function LoopOverviewCard({ loop, config, theme, locked, onOpen, onDelete }: {
  loop: ProjectLoop;
  config: ProjectAutomationConfig;
  theme: LoopTheme;
  locked: boolean;
  onOpen: () => void;
  onDelete?: () => unknown | Promise<unknown>;
}) {
  const outgoing = config.loopEdges.filter((edge) => edge.source === loop.id);
  return (
    <article className="grid min-h-52 min-w-0 grid-rows-[auto_1fr_auto] overflow-hidden rounded-lg border border-divider-strong bg-card" aria-labelledby={`loop-${loop.id}-heading`}>
      <header className="grid gap-1 border-b border-divider-strong p-4">
        <div className="flex min-w-0 items-center gap-2 font-mono text-xs text-foreground"><LoopRouteArtwork size={24} className="text-primary" /><h2 id={`loop-${loop.id}-heading`} className="truncate">{loop.id}</h2></div>
        <p className="line-clamp-2 text-xs text-muted-foreground">{loop.description}</p>
        <span className="font-mono text-[0.62rem] text-muted-foreground">start: {loop.startNodeId} · state: {loop.state.description}</span>
      </header>
      <div className="grid content-start gap-3 p-3">
        {loop.nodes.map((node) => {
          const edge = loop.edges.find((candidate) => candidate.source === node.id);
          const target = edge ? isProjectNodeTerminalTarget(edge.target) ? `terminal:${edge.target.terminal}` : edge.target.nodeId : "missing";
          return (
            <div key={node.id} className="grid gap-2 border-l-2 border-divider-strong bg-background/50 px-2 py-1.5" data-work-loop-node={node.id}>
              <div className="flex items-center justify-between gap-2"><strong className="truncate font-mono text-[0.68rem]">{node.id}</strong><span className="font-mono text-[0.6rem] text-muted-foreground">max {node.maxLocalAttempts}</span></div>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-[0.65rem]">
                <span className="flex items-center gap-1 rounded border border-primary/30 px-2 py-1 text-primary"><BriefcaseBusiness className="size-3" /> Work · {node.work.type}{node.work.type === "scheduled" ? <CalendarClock className="size-3" /> : null}</span>
                <ArrowRight className="size-3 text-muted-foreground" aria-label="Fixed Work completed to Validation edge" />
                <span className="flex items-center gap-1 rounded border border-secondary/30 px-2 py-1 text-secondary"><ShieldCheck className="size-3" /> Validation · {node.validation.type}</span>
              </div>
              <span className="font-mono text-[0.6rem] text-muted-foreground">OK → {target} · FAIL/local → Work (fixed)</span>
            </div>
          );
        })}
        {outgoing.map((edge) => (
          <div key={edge.id} className="flex items-start gap-2 border-t border-divider-strong pt-2 text-xs" data-loop-edge-kind={edge.kind}>
            {edge.kind === "repair" ? <Wrench className="mt-0.5 size-3.5 text-tertiary" /> : <ArrowRight className="mt-0.5 size-3.5 text-secondary" />}
            <span aria-hidden="true" className="mt-2 w-4 shrink-0 border-t-2" style={{ borderColor: theme.edge.color, borderTopStyle: edge.kind === "repair" ? theme.edge.repairStyle : theme.edge.crossLoopStyle }} />
            <span><strong className="font-mono text-[0.62rem] uppercase">{edge.kind}</strong> · {loop.id} → {edge.target}<span className="block text-muted-foreground">{edge.description}</span></span>
          </div>
        ))}
      </div>
      <footer className="flex items-center gap-2 border-t border-divider-strong p-2">
        <Button type="button" size="sm" className="flex-1" aria-label={`Open loop ${loop.id}`} onClick={onOpen}><PanelTopOpen /> Open loop</Button>
        {onDelete ? <DeleteAction deleteLabel={`Delete loop ${loop.id}`} deleteType="loop" resourceName={loop.id} disabled={locked} onDelete={onDelete} /> : null}
      </footer>
    </article>
  );
}
