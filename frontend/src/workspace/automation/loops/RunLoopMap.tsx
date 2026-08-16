import type { ProjectLoopEdge, RootRunDetail } from "@shared/api/workspace-contracts";
import { ArrowRight, BriefcaseBusiness, Network, RotateCcw, ShieldCheck, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

export function RunLoopMap({ root }: { root: RootRunDetail }) {
  const activeLoopId = root.current?.loopId;
  const activeNodeId = root.current?.workLoopNodeId;
  const activeEdgeId = root.repair.pendingRepair ? root.repair.routedTarget?.loopEdgeId : undefined;
  return (
    <section className="grid gap-3 border-b border-divider-strong bg-panel p-3" aria-labelledby="run-loop-map-heading">
      <header className="flex items-center justify-between gap-2">
        <h2 id="run-loop-map-heading" className="font-mono text-[0.66rem] font-semibold uppercase tracking-[0.05em] text-muted-foreground">All Loops · immutable Run graph</h2>
        <span className="font-mono text-[0.58rem] text-muted-foreground">root {root.executionSnapshot.rootLoopId}</span>
      </header>
      <div className={cn("flex flex-wrap items-center gap-2 border bg-card px-3 py-2 font-mono text-[0.6rem]", root.current?.nodeRole === "orchestrator" ? "border-tertiary text-tertiary ring-2 ring-tertiary/20" : "border-divider-strong text-muted-foreground")} data-active-orchestrator={root.current?.nodeRole === "orchestrator" || undefined}>
        <Network className="size-3.5" /> Loop Orchestrator
        <span>repair allowlist · max depth {root.executionSnapshot.orchestrator.maxRepairDepth}</span>
        {root.repair.routedTarget ? <span>→ {root.repair.routedTarget.targetLoopId}</span> : null}
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {root.executionSnapshot.loops.map((loop) => (
          <article key={loop.id} data-active-loop={loop.id === activeLoopId || undefined} className={cn("grid gap-2 border bg-card p-3", loop.id === activeLoopId ? "border-secondary ring-2 ring-secondary/20" : "border-divider-strong")}>
            <header><strong className="font-mono text-[0.68rem]">{loop.id}</strong><p className="line-clamp-2 text-xs text-muted-foreground">{loop.description}</p></header>
            <div className="grid gap-1.5">
              {loop.nodes.map((node) => <CompositePhase key={node.id} nodeId={node.id} active={loop.id === activeLoopId && node.id === activeNodeId} role={root.current?.nodeRole} />)}
            </div>
            <div className="grid gap-1">{root.executionSnapshot.loopEdges.filter(({ source }) => source === loop.id).map((edge) => <RuntimeEdge key={edge.id} edge={edge} active={edge.id === activeEdgeId} />)}</div>
          </article>
        ))}
      </div>
      <ReturnPath root={root} />
    </section>
  );
}

function CompositePhase({ nodeId, active, role }: {
  nodeId: string; active: boolean; role?: "work" | "validation" | "orchestrator";
}) {
  return <div className={cn("grid gap-1 border-l-2 bg-background/60 p-2", active ? "border-secondary" : "border-divider-strong")} data-active-work-loop-node={active || undefined}>
    <span className="font-mono text-[0.61rem]">{nodeId}</span>
    <span className="grid grid-cols-[1fr_auto_1fr] items-center gap-1 text-[0.58rem]">
      <span className={cn("flex items-center gap-1 border px-1.5 py-1 text-primary", active && role === "work" ? "border-primary ring-1 ring-primary/30" : "border-primary/30")}><BriefcaseBusiness className="size-3" /> Work</span>
      <ArrowRight className="size-3 text-muted-foreground" aria-label="Fixed Work completed to Validation edge" />
      <span className={cn("flex items-center gap-1 border px-1.5 py-1 text-secondary", active && role === "validation" ? "border-secondary ring-1 ring-secondary/30" : "border-secondary/30")}><ShieldCheck className="size-3" /> Validation</span>
    </span>
  </div>;
}

function RuntimeEdge({ edge, active }: { edge: ProjectLoopEdge; active: boolean }) {
  const Icon = edge.kind === "repair" ? Wrench : ArrowRight;
  return <span className={cn("flex items-center gap-1.5 border-t pt-1 font-mono text-[0.58rem]", active ? "border-tertiary text-tertiary" : "border-divider-strong text-muted-foreground")} data-active-repair-edge={active || undefined}>
    <Icon className="size-3" /> {edge.kind} · {edge.source} → {edge.target}{active ? " · active" : ""}
  </span>;
}

function ReturnPath({ root }: { root: RootRunDetail }) {
  const chain = root.repair.activeContinuationChain;
  const destination = root.repair.pendingRepair
    ? root.repair.returnDestination ?? root.current?.returnDestination
    : undefined;
  if (chain.length === 0 && !destination) return null;
  return <div className="flex flex-wrap items-center gap-2 border border-tertiary/40 bg-card px-3 py-2 font-mono text-[0.6rem] text-tertiary">
    <RotateCcw className="size-3.5" /> Return path (LIFO)
    {chain.slice().reverse().map((frame) => <span key={frame.frameId}>depth {frame.nestingDepth} → {frame.returnLoopId}/{frame.returnWorkLoopNodeId}/Validation</span>)}
    {chain.length === 0 && destination ? <span>→ {destination.loopId}/{destination.workLoopNodeId}/Validation</span> : null}
  </div>;
}
