import { AlertTriangle, Trash2 } from "lucide-react";
import type {
  DecisionOptionModelRowV2, DecisionStateDefinitionV2, PolicyPreviewV2
} from "@shared/api/workspace-contracts";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatCost } from "../policy/PolicyProjectionView";
import { DecisionBranchEditor } from "./DecisionBranchEditor";
import { DecisionRuleCreator } from "./DecisionRuleCreator";
import { DecisionScaledInput } from "./DecisionScaledInput";
import {
  costTextToMicros, decisionRuleIssues, isProbabilityTotalValid, microsToCostText,
  ppmToPercentageText, probabilityTotalPpm, type DecisionMatrixCellView
} from "./decisionModelView";

export function DecisionRuleInspector({ cell, preview, outcomes, states, issues, locked, onChange, onAdd, onRemove, onClose }: {
  cell?: DecisionMatrixCellView;
  preview?: PolicyPreviewV2;
  outcomes: string[];
  states: DecisionStateDefinitionV2[];
  issues: Array<{ path: string; message: string }>;
  locked: boolean;
  onChange: (row: DecisionOptionModelRowV2) => void;
  onAdd: (row: DecisionOptionModelRowV2) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const mobile = useIsMobile();
  if (!cell) return <aside className="hidden min-h-72 rounded-lg border border-dashed border-divider-strong bg-card p-4 text-xs text-muted-foreground xl:grid xl:place-items-center">Select a matrix cell to inspect its rule.</aside>;
  const title = `${cell.stateId} → ${cell.actionId}`;
  const body = <InspectorBody cell={cell} preview={preview} outcomes={outcomes} states={states} issues={issues} locked={locked} onChange={onChange} onAdd={onAdd} onRemove={onRemove} />;
  if (mobile) return <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}><SheetContent side="right" className="w-[92vw] max-w-[28rem] gap-0 border-divider-strong p-0"><SheetHeader className="border-b border-divider-strong"><SheetTitle>Selected rule</SheetTitle><SheetDescription className="truncate font-mono" title={title}>{title}</SheetDescription></SheetHeader>{body}</SheetContent></Sheet>;
  return <aside className="min-h-0 rounded-lg border border-divider-strong bg-card" aria-label={`${title} decision rule inspector`}><div className="border-b border-divider-strong p-4"><div className="font-mono text-[0.625rem] uppercase text-muted-foreground">Selected Rule</div><h2 className="mt-1 truncate font-mono text-sm text-tertiary" title={title}>{title}</h2></div>{body}</aside>;
}

function InspectorBody({ cell, preview, outcomes, states, issues, locked, onChange, onAdd, onRemove }: Omit<Parameters<typeof DecisionRuleInspector>[0], "onClose"> & { cell: DecisionMatrixCellView }) {
  const qValue = preview?.state?.stateId === cell.stateId ? preview.actionValues.find(({ actionId }) => actionId === cell.actionId)?.qMicros : undefined;
  if (cell.status === "unavailable" || cell.guardDenied && !cell.row) return <div className="p-4 text-xs text-muted-foreground"><p className="rounded border border-dashed border-divider-strong p-3">{cell.guardReason ?? "This action has no capability metadata and cannot be configured for this state."}</p></div>;
  if (!cell.row) return <div className="overflow-auto p-4"><DecisionRuleCreator stateId={cell.stateId} actionId={cell.actionId} outcomes={outcomes} states={states} locked={locked} onAdd={onAdd} /></div>;
  const row = cell.row;
  const total = probabilityTotalPpm(row);
  const validTotal = isProbabilityTotalValid(row);
  const ruleIssues = decisionRuleIssues(issues, cell);
  return <div className="grid max-h-[calc(100svh-12rem)] gap-4 overflow-auto p-4">
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1"><DecisionScaledInput label="Configured cost" suffix="units" value={row.expectedCostMicros} disabled={locked} format={microsToCostText} parse={costTextToMicros} onChange={(expectedCostMicros) => onChange({ ...row, expectedCostMicros })} help={`${row.expectedCostMicros.toLocaleString()} micro-units`} /><ReadOnly label="Derived Q(s,a)" value={qValue === undefined ? "Unavailable for this preview state" : formatCost(qValue)} /></div>
    <div><div className="mb-2 font-mono text-[0.625rem] uppercase text-muted-foreground">Outcome branches</div><DecisionBranchEditor row={row} outcomes={outcomes} states={states} locked={locked} onChange={onChange} /></div>
    <div className={`rounded border p-3 ${validTotal ? "border-secondary/50 bg-secondary/5" : "border-destructive/50 bg-destructive/5"}`}><div className="flex items-center justify-between gap-2"><span className="text-xs font-medium">Total probability</span><span className={`font-mono text-sm ${validTotal ? "text-secondary" : "text-destructive"}`}>{ppmToPercentageText(total)}%</span></div><div className="mt-1 font-mono text-[0.625rem] text-muted-foreground">{total.toLocaleString()} / 1,000,000 ppm</div>{!validTotal ? <p className="mt-2 text-xs text-destructive">Branch probabilities must total exactly 100%.</p> : null}</div>
    <div><div className="mb-2 font-mono text-[0.625rem] uppercase text-muted-foreground">Validation problems</div>{!validTotal || ruleIssues.length ? <ul className="grid gap-1 text-xs text-destructive">{!validTotal ? <li className="flex gap-2"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> Invalid transition total</li> : null}{ruleIssues.map((issue) => <li key={`${issue.path}:${issue.message}`} className="flex gap-2"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" /><span>{issue.message}<span className="block font-mono text-[0.625rem] text-muted-foreground">{issue.path}</span></span></li>)}</ul> : <p className="text-xs text-secondary">No rule-level problems detected.</p>}</div>
    <details className="rounded border border-divider-strong bg-background/30 p-3"><summary className="cursor-pointer text-xs font-medium">Advanced exact values</summary><pre className="mt-2 overflow-auto text-[0.625rem] text-muted-foreground">{JSON.stringify(row, null, 2)}</pre></details>
    <Button variant="destructive" disabled={locked} onClick={onRemove}><Trash2 /> Delete rule</Button>
  </div>;
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return <div className="rounded border border-divider-strong bg-background/40 p-3"><div className="font-mono text-[0.625rem] uppercase text-muted-foreground">{label}</div><div className="mt-1 font-mono text-xs">{value}</div><div className="mt-1 text-[0.6875rem] text-muted-foreground">Read-only solver evidence</div></div>;
}
