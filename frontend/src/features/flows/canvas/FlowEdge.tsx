import type { FlowVisualEdge, FlowVisualNode } from "./flow-layout";

export function FlowEdge({
  edge,
  from,
  to,
  dense
}: {
  edge: FlowVisualEdge;
  from?: FlowVisualNode;
  to?: FlowVisualNode;
  dense?: boolean;
}) {
  if (!from || !to) return null;
  const rowDelta = to.row - from.row;
  return (
    <div
      className="pointer-events-none hidden items-center xl:flex"
      style={{
        gridColumn: `${from.column + 2} / ${to.column + 2}`,
        gridRow: `${from.row + 1} / ${to.row + 2}`
      }}
      aria-label={edge.label}
    >
      <div className="relative h-full min-h-24 w-full">
        <div className="absolute left-2 right-2 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-white/15 via-cyan-200/50 to-white/15" />
        {rowDelta !== 0 ? <div className="absolute right-2 top-1/2 w-px bg-cyan-200/35" style={{ height: `${Math.abs(rowDelta) * (dense ? 7 : 10)}rem`, transform: rowDelta > 0 ? "none" : "translateY(-100%)" }} /> : null}
        <div className="absolute right-1 top-1/2 size-2 -translate-y-1/2 rotate-45 border-r border-t border-cyan-200/70" />
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[calc(50%+0.9rem)] rounded-sm border border-white/10 bg-background/90 px-1.5 py-0.5 font-mono text-[0.62rem] uppercase text-muted-foreground">
          {edge.kind === "routing" ? "maps" : edge.label}
        </span>
      </div>
    </div>
  );
}
