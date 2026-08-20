import type { ReactNode } from "react";
import {
  defaultLoopNodeStyle,
  type ProjectLoop,
  type ProjectLoopEdge,
  type RootRunDetail
} from "@shared/api/workspace-contracts";
import { ArrowRight, BriefcaseBusiness, GitBranch, Network, RotateCcw, ShieldCheck, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { LoopNodeArtwork } from "./LoopNodeArtwork";
import { loopThemeCssProperties } from "./loopTheme";

export function RunLoopMap({ root }: { root: RootRunDetail }) {
  const activeLoopId = root.current?.loopId;
  const activeEdgeId = root.repair.pendingRepair ? root.repair.routedTarget?.loopEdgeId : undefined;
  const flowEdges = root.executionSnapshot.graph.loopEdges.filter(({ kind }) => kind === "flow");
  const activeRepairEdge = root.executionSnapshot.graph.loopEdges.find(({ id }) => id === activeEdgeId);
  return (
    <section
      className="grid min-h-[28rem] content-start gap-4 overflow-hidden bg-background p-4"
      aria-labelledby="run-loop-map-heading"
      style={loopThemeCssProperties(root.executionSnapshot.theme)}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 id="run-loop-map-heading" className="font-mono text-[0.66rem] font-semibold uppercase tracking-[0.05em]">All Loops · focused Run map</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Immutable topology with the active Loop and repair route brought forward.</p>
        </div>
        <span className="font-mono text-[0.58rem] text-muted-foreground">{root.executionSnapshot.loops.length} Loops · {root.executionSnapshot.graph.loopEdges.length} routes</span>
      </header>
      <div className={cn(
        "flex flex-wrap items-center gap-2 border bg-card px-3 py-2 font-mono text-[0.6rem]",
        root.current?.nodeRole === "orchestrator" ? "border-tertiary text-tertiary ring-2 ring-tertiary/20" : "border-divider-strong text-muted-foreground"
      )} data-active-orchestrator={root.current?.nodeRole === "orchestrator" || undefined}>
        <span className="flex size-8 items-center justify-center rounded-full border border-tertiary/40 bg-background text-tertiary"><Network className="size-4" /></span>
        <span className="font-semibold text-foreground">Loop Orchestrator</span>
        <span>repair allowlist · max depth {root.executionSnapshot.orchestrator.maxRepairDepth}</span>
        {root.repair.routedTarget ? <span className="ml-auto">→ {root.repair.routedTarget.targetLoopId}</span> : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
        {root.executionSnapshot.loops.map((loop) => (
          <LoopPlanet key={loop.id} loop={loop} root={root} active={loop.id === activeLoopId} />
        ))}
      </div>
      <RouteStrip title="Flow routes" icon={<GitBranch className="size-3.5" />} edges={flowEdges} />
      {activeRepairEdge ? <RouteStrip title="Active repair route" icon={<Wrench className="size-3.5" />} edges={[activeRepairEdge]} active /> : null}
      <ReturnPath root={root} />
    </section>
  );
}

function LoopPlanet({ loop, root, active }: { loop: ProjectLoop; root: RootRunDetail; active: boolean }) {
  const startNode = loop.workflow.jobNodes.find(({ id }) => id === loop.workflow.startJobNodeId) ?? loop.workflow.jobNodes[0];
  const role = active ? root.current?.nodeRole : undefined;
  const RoleIcon = role === "validation" ? ShieldCheck : role === "job" ? BriefcaseBusiness : Network;
  return (
    <article
      data-active-loop={active || undefined}
      className={cn("grid min-w-0 grid-cols-[3rem_minmax(0,1fr)] gap-3 border bg-card p-3", active ? "border-secondary ring-2 ring-secondary/20" : "border-divider-strong")}
    >
      <span aria-hidden="true" className="loop-artwork-node relative block size-12 rounded-full" data-loop-node-size="medium">
        <LoopNodeArtwork nodeStyle={startNode?.nodeStyle ?? defaultLoopNodeStyle} />
      </span>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <strong className="truncate font-mono text-[0.68rem]" title={loop.id}>{loop.id}</strong>
          {active ? <Badge variant="secondary" className="shrink-0">Active</Badge> : null}
        </div>
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{loop.description}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[0.57rem] text-muted-foreground">
          <span>{loop.workflow.jobNodes.length} {loop.workflow.jobNodes.length === 1 ? "Job" : "Jobs"}</span>
          {active && root.current?.jobNodeId ? <span className="flex min-w-0 items-center gap-1 text-foreground"><RoleIcon className={cn("size-3", role === "validation" ? "text-secondary" : role === "orchestrator" ? "text-tertiary" : "text-primary")} /> <span className="truncate">{root.current.jobNodeId} · {roleLabel(role)}</span></span> : null}
        </div>
      </div>
    </article>
  );
}

function RouteStrip({ title, icon, edges, active = false }: { title: string; icon: ReactNode; edges: ProjectLoopEdge[]; active?: boolean }) {
  return (
    <div className={cn("grid gap-2 border bg-card px-3 py-2", active ? "border-tertiary/60 text-tertiary" : "border-divider-strong text-muted-foreground")}>
      <span className="flex items-center gap-1.5 font-mono text-[0.58rem] uppercase tracking-[0.05em]">{icon} {title}</span>
      <div className="flex flex-wrap gap-2">
        {edges.length ? edges.map((edge) => <span key={edge.id} data-active-repair-edge={active || undefined} className="flex items-center gap-1 font-mono text-[0.6rem]"><span>{edge.source}</span><ArrowRight className="size-3" /><span>{edge.target}</span>{active ? <span>· {edge.id}</span> : null}</span>) : <span className="font-mono text-[0.6rem]">No routes</span>}
      </div>
    </div>
  );
}

function ReturnPath({ root }: { root: RootRunDetail }) {
  const chain = root.repair.activeContinuationChain;
  const destination = root.repair.pendingRepair
    ? root.repair.returnDestination ?? root.current?.returnDestination
    : undefined;
  if (chain.length === 0 && !destination) return null;
  return <div className="flex flex-wrap items-center gap-2 border border-tertiary/40 bg-card px-3 py-2 font-mono text-[0.6rem] text-tertiary">
    <RotateCcw className="size-3.5" /> Return path (LIFO)
    {chain.slice().reverse().map((frame) => <span key={frame.frameId}>depth {frame.nestingDepth} → {frame.returnLoopId}/{frame.returnJobNodeId}/Validation</span>)}
    {chain.length === 0 && destination ? <span>→ {destination.loopId}/{destination.jobNodeId}/Validation</span> : null}
  </div>;
}

const roleLabel = (role?: NonNullable<RootRunDetail["current"]>["nodeRole"]): string =>
  role === "job" ? "Job" : role === "validation" ? "Validation" : role === "orchestrator" ? "Orchestrator" : "—";
