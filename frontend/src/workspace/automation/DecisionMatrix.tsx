import { Ban, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { microsToCostText, type DecisionMatrixCellView, type DecisionMatrixView } from "./decisionModelView";

export interface DecisionSelection { stateId: string; actionId: string; }

export function DecisionMatrix({ matrix, selection, onSelect }: {
  matrix: DecisionMatrixView;
  selection?: DecisionSelection;
  onSelect: (selection: DecisionSelection) => void;
}) {
  return <section className="min-w-0 rounded-lg border border-divider-strong bg-card" aria-labelledby="decision-matrix-title">
    <div className="border-b border-divider-strong p-4"><h2 id="decision-matrix-title" className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.05em]">Decision Matrix</h2><p className="text-xs text-muted-foreground">Rows are configured states; columns are the complete scoped action set. Costs are configured immediate cost units.</p></div>
    <div className="max-h-[34rem] max-w-full overflow-auto" role="region" aria-label="Scrollable state and action decision matrix" tabIndex={0}>
      <table className="w-max min-w-full border-separate border-spacing-0 text-xs">
        <thead><tr>
          <th scope="col" className="sticky top-0 left-0 z-30 min-w-40 border-r border-b border-divider-strong bg-card px-3 py-2 text-left font-mono text-[0.625rem] uppercase text-muted-foreground">State</th>
          {matrix.actions.map((action) => <th key={action.id} scope="col" className="sticky top-0 z-20 min-w-40 max-w-40 border-b border-divider-strong bg-card px-3 py-2 text-left"><span className="block truncate font-mono text-[0.6875rem] text-tertiary" title={action.id}>{action.id}</span>{action.description ? <span className="mt-0.5 block truncate font-sans text-[0.625rem] font-normal text-muted-foreground" title={action.description}>{action.description}</span> : null}</th>)}
        </tr></thead>
        <tbody>{matrix.rows.length === 0 ? <tr><td colSpan={matrix.actions.length + 1} className="p-6 text-center text-xs text-muted-foreground">No decision states are defined. Add state definitions in Advanced Model.</td></tr> : matrix.rows.map((row, rowIndex) => <tr key={row.state.id}>
          <th scope="row" className="sticky left-0 z-10 max-w-48 border-r border-b border-divider-strong bg-card px-3 py-2 text-left"><span className="block truncate font-mono text-[0.6875rem]" title={row.state.id}>{row.state.id}</span>{row.state.terminal ? <Badge className="mt-1" variant={row.state.terminal === "success" ? "secondary" : "destructive"}>{row.state.terminal} terminal</Badge> : null}</th>
          {row.state.terminal ? <td colSpan={Math.max(matrix.actions.length, 1)} className="border-b border-divider-strong bg-background/25 px-3 py-3 text-muted-foreground"><span className="font-mono text-[0.6875rem] uppercase">{row.state.terminal} terminal state</span><span className="ml-2">No decision rule is evaluated.</span></td> : row.cells.map((cell, columnIndex) => <td key={cell.actionId} className="border-b border-divider-strong p-1.5"><MatrixCell cell={cell} selected={selection?.stateId === cell.stateId && selection.actionId === cell.actionId} rowIndex={rowIndex} columnIndex={columnIndex} onSelect={onSelect} /></td>)}
        </tr>)}</tbody>
      </table>
    </div>
  </section>;
}

function MatrixCell({ cell, selected, rowIndex, columnIndex, onSelect }: {
  cell: DecisionMatrixCellView; selected: boolean; rowIndex: number; columnIndex: number;
  onSelect: (selection: DecisionSelection) => void;
}) {
  const disabled = cell.status === "unavailable" || (cell.status === "missing" && cell.guardDenied);
  const label = cell.status === "configured" ? `Edit rule for state ${cell.stateId} and action ${cell.actionId}` : `Add rule for state ${cell.stateId} and action ${cell.actionId}`;
  return <button type="button" disabled={disabled} aria-label={disabled ? `${cell.actionId} unavailable for state ${cell.stateId}${cell.guardDenied ? ": guard denied" : ""}` : label}
    title={cell.guardReason ?? label} data-matrix-cell={`${rowIndex}:${columnIndex}`}
    className={cn("flex min-h-12 w-full min-w-36 items-center justify-between gap-2 rounded border px-2.5 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
      selected ? "border-primary bg-primary/10" : "border-transparent hover:border-divider-strong hover:bg-background/50",
      disabled && "cursor-not-allowed border-dashed border-divider-strong bg-background/20 text-muted-foreground")}
    onClick={() => onSelect({ stateId: cell.stateId, actionId: cell.actionId })}
    onKeyDown={(event) => moveCellFocus(event, rowIndex, columnIndex)}>
    {cell.status === "configured" ? <><span><span className="block font-mono text-sm">{microsToCostText(cell.row!.expectedCostMicros)}</span><span className="block text-[0.625rem] text-muted-foreground">Configured cost</span></span>{cell.guardDenied ? <Badge variant="destructive"><Ban /> Guard denied</Badge> : null}</>
      : cell.guardDenied ? <span className="flex items-center gap-1.5 text-[0.6875rem]"><Ban className="size-3.5" /> Guard denied</span>
        : cell.status === "unavailable" ? <span className="text-[0.6875rem]">Not configured</span>
          : <span className="flex items-center gap-1.5 text-[0.6875rem] text-primary"><Plus className="size-3.5" /> Add rule</span>}
  </button>;
}

function moveCellFocus(event: React.KeyboardEvent<HTMLButtonElement>, row: number, column: number) {
  const delta = event.key === "ArrowRight" ? [0, 1] : event.key === "ArrowLeft" ? [0, -1] : event.key === "ArrowDown" ? [1, 0] : event.key === "ArrowUp" ? [-1, 0] : undefined;
  if (!delta) return;
  const next = event.currentTarget.closest("table")?.querySelector<HTMLButtonElement>(`[data-matrix-cell="${row + delta[0]!}:${column + delta[1]!}"]`);
  if (next && !next.disabled) { event.preventDefault(); next.focus(); }
}
