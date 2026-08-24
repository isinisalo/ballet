import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { ArrowDownRight, ChevronRight } from "lucide-react";
import type {
  DecisionActionModelRowV4,
  PolicyPreviewResultV4,
  ProjectScopedRewardDecisionStrategyV4
} from "@shared/api/workspace-contracts";
import { cn } from "@/lib/utils";
import {
  exactMicros,
  expectedImmediateReward,
  formatRewardMicros,
  rewardTone,
  type ImpactTone
} from "./decisionModelPresentation";

export type ScopeNode = {
  id: string;
  description: string;
  acceptanceObligationId?: string;
};
export type SelectedCell = { stateId: string; actionId: string };
export type CompiledPolicy = NonNullable<NonNullable<PolicyPreviewResultV4["preview"]>["compiledPolicy"]>;

export function PolicyMatrix({
  nodes,
  rows,
  compiled,
  currentStateId,
  selected,
  progressByState,
  strategy,
  onSelect,
  onZoomNode
}: {
  nodes: ScopeNode[];
  rows: ReadonlyMap<string, DecisionActionModelRowV4>;
  compiled?: CompiledPolicy;
  currentStateId: string;
  selected?: SelectedCell;
  progressByState: Readonly<Record<string, number>>;
  strategy: ProjectScopedRewardDecisionStrategyV4;
  onSelect: (cell: SelectedCell) => void;
  onZoomNode?: (nodeId: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ scrollTop: 0, height: 560 });
  const virtual = nodes.length > 20;
  const rowHeight = 58;
  const overscan = 5;
  const start = virtual ? Math.max(0, Math.floor(viewport.scrollTop / rowHeight) - overscan) : 0;
  const count = virtual ? Math.ceil(viewport.height / rowHeight) + overscan * 2 : nodes.length;
  const end = virtual ? Math.min(nodes.length, start + count) : nodes.length;
  const visible = nodes.slice(start, end);
  const requestCellFocus = useRenderedCellFocus(container, start, end);
  const gridTemplateColumns = `minmax(10rem, 13rem) repeat(${nodes.length}, minmax(7rem, 1fr))`;
  const moveFocus = (rowIndex: number, columnIndex: number, event: KeyboardEvent) => {
    const delta = event.key === "ArrowDown" ? [1, 0] : event.key === "ArrowUp" ? [-1, 0]
      : event.key === "ArrowRight" ? [0, 1] : event.key === "ArrowLeft" ? [0, -1] : undefined;
    if (!delta) return;
    event.preventDefault();
    let nextRow = rowIndex;
    let nextColumn = columnIndex;
    for (let step = 0; step < nodes.length * nodes.length; step += 1) {
      nextRow = Math.max(0, Math.min(nodes.length - 1, nextRow + delta[0]));
      nextColumn = Math.max(0, Math.min(nodes.length - 1, nextColumn + delta[1]));
      const stateId = nodes[nextRow]!.id;
      const actionId = nodes[nextColumn]!.id;
      if (rows.has(policyCellKey(stateId, actionId))) {
        onSelect({ stateId, actionId });
        requestCellFocus(nextRow, nextColumn);
        if (virtual) {
          const top = Math.max(0, nextRow * rowHeight - rowHeight);
          setViewport((current) => ({ ...current, scrollTop: top }));
          container.current?.scrollTo?.({ top, behavior: "auto" });
        }
        return;
      }
      if (atNavigationBoundary(nextRow, nextColumn, delta, nodes.length)) return;
    }
  };
  return <div
    ref={container}
    className="max-h-[min(62svh,42rem)] min-h-72 overflow-auto overscroll-contain"
    onScroll={(event) => setViewport({
      scrollTop: event.currentTarget.scrollTop,
      height: event.currentTarget.clientHeight
    })}
  >
    <div
      role="grid"
      aria-rowcount={nodes.length + 1}
      aria-colcount={nodes.length + 1}
      className="grid min-w-max"
      style={{ gridTemplateColumns }}
    >
      <div role="row" className="contents">
        <div role="columnheader" className="sticky left-0 top-0 z-30 grid min-h-16 place-content-center border-b border-r border-divider-strong bg-card px-3 font-mono text-[0.625rem] uppercase text-muted-foreground">
          current s <ArrowDownRight className="mx-auto mt-1 size-3.5" /> action a
        </div>
        {nodes.map((node) => <div key={node.id} role="columnheader" className="sticky top-0 z-20 min-h-16 border-b border-r border-divider-strong bg-card/95 p-1 backdrop-blur-sm">
          {onZoomNode ? <button type="button" className="group flex h-full w-full min-w-0 items-center justify-center gap-1 rounded px-2 text-center font-mono text-[0.6875rem] text-foreground hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={() => onZoomNode(node.id)} title={`Open ${node.description} local Decision Model`}>
            <span className="max-w-24 truncate">{shortDecisionId(node.id)}</span><ChevronRight className="size-3 opacity-50 group-hover:opacity-100" />
          </button> : <div className="grid h-full place-content-center px-2 text-center font-mono text-[0.6875rem] text-foreground" title={node.description}>{shortDecisionId(node.id)}</div>}
        </div>)}
      </div>
      {start > 0 ? <div role="presentation" style={{ gridColumn: "1 / -1", height: start * rowHeight }} /> : null}
      {visible.map((stateNode, visibleIndex) => <PolicyRow
        key={stateNode.id}
        stateNode={stateNode}
        rowIndex={start + visibleIndex}
        nodes={nodes}
        rows={rows}
        compiled={compiled}
        currentStateId={currentStateId}
        selected={selected}
        progressByState={progressByState}
        strategy={strategy}
        onSelect={onSelect}
        onMoveFocus={moveFocus}
      />)}
      {end < nodes.length ? <div role="presentation" style={{ gridColumn: "1 / -1", height: (nodes.length - end) * rowHeight }} /> : null}
    </div>
  </div>;
}

function PolicyRow({
  stateNode,
  rowIndex,
  nodes,
  rows,
  compiled,
  currentStateId,
  selected,
  progressByState,
  strategy,
  onSelect,
  onMoveFocus
}: {
  stateNode: ScopeNode;
  rowIndex: number;
  nodes: ScopeNode[];
  rows: ReadonlyMap<string, DecisionActionModelRowV4>;
  compiled?: CompiledPolicy;
  currentStateId: string;
  selected?: SelectedCell;
  progressByState: Readonly<Record<string, number>>;
  strategy: ProjectScopedRewardDecisionStrategyV4;
  onSelect: (cell: SelectedCell) => void;
  onMoveFocus: (row: number, column: number, event: KeyboardEvent) => void;
}) {
  const compiledState = compiled?.states.find(({ stateId }) => stateId === stateNode.id);
  return <div role="row" className="contents" aria-rowindex={rowIndex + 2}>
    <div role="rowheader" className={cn(
      "sticky left-0 z-10 flex min-h-[3.625rem] min-w-0 items-center gap-2 border-b border-r border-divider-strong bg-card px-3",
      stateNode.id === currentStateId && "bg-primary/10"
    )} title={stateNode.description}>
      <span className={cn(
        "size-2 shrink-0 rounded-full",
        stateNode.id === currentStateId ? "bg-primary shadow-[0_0_10px_var(--primary)]" : "bg-divider-strong"
      )} />
      <span className="min-w-0">
        <span className="block truncate font-mono text-[0.6875rem] text-foreground">{shortDecisionId(stateNode.id)}</span>
        <span className="block truncate text-[0.625rem] text-muted-foreground">
          {stateNode.id === currentStateId ? "current state" : stateNode.description}
        </span>
      </span>
    </div>
    {nodes.map((actionNode, columnIndex) => <PolicyCell
      key={actionNode.id}
      rowIndex={rowIndex}
      columnIndex={columnIndex}
      stateNode={stateNode}
      actionNode={actionNode}
      row={rows.get(policyCellKey(stateNode.id, actionNode.id))}
      compiledState={compiledState}
      currentStateId={currentStateId}
      selected={selected}
      progressByState={progressByState}
      strategy={strategy}
      onSelect={onSelect}
      onMoveFocus={onMoveFocus}
    />)}
  </div>;
}

function PolicyCell({
  rowIndex,
  columnIndex,
  stateNode,
  actionNode,
  row,
  compiledState,
  currentStateId,
  selected,
  progressByState,
  strategy,
  onSelect,
  onMoveFocus
}: {
  rowIndex: number;
  columnIndex: number;
  stateNode: ScopeNode;
  actionNode: ScopeNode;
  row?: DecisionActionModelRowV4;
  compiledState?: CompiledPolicy["states"][number];
  currentStateId: string;
  selected?: SelectedCell;
  progressByState: Readonly<Record<string, number>>;
  strategy: ProjectScopedRewardDecisionStrategyV4;
  onSelect: (cell: SelectedCell) => void;
  onMoveFocus: (row: number, column: number, event: KeyboardEvent) => void;
}) {
  if (!row) return <div role="gridcell" aria-disabled="true" aria-label={`${stateNode.id} to ${actionNode.id}: unavailable`} className="grid min-h-[3.625rem] place-content-center border-b border-r border-divider-strong bg-background/40 p-1">
    <span className="h-5 w-8 rounded-sm border border-dashed border-divider-strong" aria-hidden="true" />
  </div>;
  const qMicros = compiledState?.actionValues.find(({ actionId }) => actionId === actionNode.id)?.qMicros;
  const estimate = expectedImmediateReward(strategy, row, progressByState);
  const shown = qMicros ?? estimate;
  const policySelected = compiledState?.selectedActionId === actionNode.id;
  const cellSelected = selected?.stateId === stateNode.id && selected.actionId === actionNode.id;
  return <div role="gridcell" className="min-h-[3.625rem] border-b border-r border-divider-strong bg-background/20 p-1">
    <button
      type="button"
      data-policy-cell={`${rowIndex}-${columnIndex}`}
      tabIndex={cellSelected ? 0 : -1}
      aria-pressed={cellSelected}
      aria-label={`${stateNode.id} to ${actionNode.id}: ${qMicros === undefined ? "estimated " : ""}${formatRewardMicros(shown, true)} reward units${policySelected ? ", policy selection" : ""}`}
      title={`${qMicros === undefined ? "Estimated immediate" : "Q(s,a)"} ${formatRewardMicros(shown, true)} · ${exactMicros(shown)}`}
      onClick={() => onSelect({ stateId: stateNode.id, actionId: actionNode.id })}
      onKeyDown={(event) => onMoveFocus(rowIndex, columnIndex, event)}
      className={cn(
        "relative grid h-full min-h-12 w-full place-content-center rounded-sm border px-2 font-mono transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        decisionCellToneClass(rewardTone(shown, qMicros === undefined)),
        cellSelected && "ring-2 ring-primary",
        policySelected && "border-secondary"
      )}
    >
      <span className="text-sm font-semibold">{qMicros === undefined ? "≈ " : ""}{formatRewardMicros(shown, true)}</span>
      {policySelected ? <span className="mt-0.5 text-[0.5rem] uppercase tracking-wide">policy</span> : null}
      {stateNode.id === currentStateId ? <span className="absolute right-1 top-1 size-1.5 rounded-full bg-primary" /> : null}
    </button>
  </div>;
}

function atNavigationBoundary(row: number, column: number, delta: number[], size: number): boolean {
  return (row === 0 && delta[0]! < 0) || (row === size - 1 && delta[0]! > 0)
    || (column === 0 && delta[1]! < 0) || (column === size - 1 && delta[1]! > 0);
}

function useRenderedCellFocus(
  container: RefObject<HTMLDivElement | null>,
  visibleStart: number,
  visibleEnd: number
) {
  const [pending, setPending] = useState<{ row: number; column: number }>();
  useEffect(() => {
    if (!pending || pending.row < visibleStart || pending.row >= visibleEnd) return;
    const frame = window.requestAnimationFrame(() => {
      const cell = container.current
        ?.querySelector<HTMLElement>(`[data-policy-cell="${pending.row}-${pending.column}"]`);
      if (cell) {
        cell.focus();
        setPending(undefined);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [container, pending, visibleEnd, visibleStart]);
  return (row: number, column: number) => setPending({ row, column });
}

export function decisionCellToneClass(tone: ImpactTone): string {
  if (tone === "rewarding") return "border-secondary/55 bg-secondary/12 text-secondary";
  if (tone === "costly") return "border-destructive/55 bg-destructive/12 text-destructive";
  if (tone === "estimated") return "border-tertiary/55 bg-tertiary/10 text-tertiary";
  return "border-divider-strong bg-background/70 text-muted-foreground";
}

export const policyCellKey = (stateId: string, actionId: string) => `${stateId}\u0000${actionId}`;
export const shortDecisionId = (id: string) => id.length > 22 ? `${id.slice(0, 19)}…` : id;
