import type { PolicyProjectionV1 } from "@shared/api/workspace-contracts";

export function PolicyProjectionView({ projection, compact = false }: { projection: PolicyProjectionV1; compact?: boolean }) {
  const incoming = new Map(projection.edges.map((edge) => [edge.toProjectionNodeId, edge]));
  return <div className="policy-projection" data-compact={compact ? "true" : "false"} aria-label="Derived Policy Projection">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
      <span>Derived from Decision State <code className="text-tertiary">{projection.sourceDecisionStateId}</code></span>
      <span className="font-mono">≤ {projection.maxDecisionEpochs} epochs · ≤ {projection.maxProjectionNodes} nodes{projection.truncated ? " · truncated" : ""}</span>
    </div>
    <div className="grid gap-2">{projection.nodes.map((node) => {
      const edge = incoming.get(node.projectionNodeId);
      return <div key={node.projectionNodeId} className="grid min-w-0 grid-cols-[2.5rem_minmax(0,1fr)] gap-2" style={{ paddingLeft: `${Math.min(node.depth, 8) * (compact ? 8 : 14)}px` }}>
        <div className="flex flex-col items-center">
          {edge ? <><span className="font-mono text-[0.6rem] text-muted-foreground">{formatProbability(edge.probabilityPpm)}</span><span className="my-1 h-3 w-px bg-canvas-flow" /></> : <span className="mt-2 size-1.5 rounded-full bg-primary" />}
        </div>
        <div className="rounded border border-divider-strong bg-background/45 p-2.5">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-mono text-[0.65rem] text-muted-foreground">{node.stateId}</span>
            {node.selectedGraphNodeId ? <><span aria-hidden="true">→</span><strong className="font-mono text-xs text-tertiary">{node.selectedGraphNodeId}</strong></> : null}
            {node.terminal ? <span className={node.terminal === "success" ? "text-secondary" : "text-destructive"}>{node.terminal}</span> : null}
            {node.cutoff ? <span className="font-mono text-[0.65rem] text-tertiary">{cutoffLabel(node.cutoff)}</span> : null}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[0.65rem] text-muted-foreground">
            {node.expectedRemainingCostMicros !== undefined ? <span>expected remaining cost {formatCost(node.expectedRemainingCostMicros)}</span> : null}
            {node.configuredExpectedCostMicros !== undefined ? <span>configured option cost {formatCost(node.configuredExpectedCostMicros)}</span> : null}
            <span>cumulative configured prior {formatProbability(node.cumulativeProbabilityPpm)}</span>
          </div>
          {node.message ? <p className="mt-1 text-xs text-destructive">{node.message}</p> : null}
        </div>
      </div>;
    })}</div>
    <p className="mt-3 text-[0.6875rem] text-muted-foreground">Expected, not committed. Re-derived at every decision epoch. Branch percentages are configured priors.</p>
  </div>;
}

export const formatCost = (micros: number) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(micros / 1_000_000);
export const formatProbability = (ppm: number) => `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(ppm / 10_000)}%`;
const cutoffLabel = (value: string) => value === "cycle" ? "cycle continues" : value === "epoch_limit" ? "epoch horizon" : value === "node_limit" ? "node horizon" : "solver stopped";
