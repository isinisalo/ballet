import type { PolicyPreviewResultV1 } from "@shared/api/workspace-contracts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PolicyProjectionView, formatCost } from "../policy/PolicyProjectionView";

export function PolicyPreviewDialog({ open, onOpenChange, result, loading }: {
  open: boolean; onOpenChange: (open: boolean) => void; result?: PolicyPreviewResultV1; loading: boolean;
}) {
  const preview = result?.preview;
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="h-[min(88svh,50rem)] max-w-[calc(100%-1rem)] grid-rows-[auto_minmax(0,1fr)_auto] p-0 sm:max-w-4xl">
    <DialogHeader className="border-b border-divider-strong p-4 pr-12"><DialogTitle>Policy Preview</DialogTitle><DialogDescription>Derived from the current unsaved Configure draft. This preview is neither persisted runtime truth nor a workflow plan.</DialogDescription></DialogHeader>
    <div className="min-h-0 overflow-auto p-4">
      {loading ? <p className="text-sm text-muted-foreground">Deriving bounded policy projection…</p> : null}
      {result?.issues.length ? <Alert variant="destructive"><AlertDescription><strong>Preview unavailable</strong><ul className="mt-2 list-disc pl-4">{result.issues.map((issue) => <li key={`${issue.path}:${issue.message}`}><span className="font-mono">{issue.path}</span> — {issue.message}</li>)}</ul></AlertDescription></Alert> : null}
      {preview ? <div className="grid gap-4">
        <div className="grid gap-2 sm:grid-cols-4"><Evidence label="Decision State" value={preview.state?.stateId ?? "invalid"} /><Evidence label="Solver" value={preview.solverStatus} /><Evidence label="Selected GraphNode" value={preview.selectedGraphNodeId ?? "none"} /><Evidence label="Expected remaining cost" value={preview.expectedRemainingCostMicros === undefined ? "unavailable" : formatCost(preview.expectedRemainingCostMicros)} /></div>
        <div className="rounded border border-divider-strong bg-card"><div className="border-b border-divider-strong px-3 py-2 font-mono text-[0.65rem] uppercase text-muted-foreground">Current action values</div>{[...preview.actionValues].sort((left, right) => left.qMicros - right.qMicros || left.graphNodeId.localeCompare(right.graphNodeId)).map((action) => <div key={action.graphNodeId} className={`flex justify-between border-b border-divider-strong px-3 py-2 text-xs last:border-0 ${action.graphNodeId === preview.selectedGraphNodeId ? "bg-secondary/5" : ""}`}><span className="font-mono text-tertiary">{action.graphNodeId}{action.graphNodeId === preview.selectedGraphNodeId ? " ← selected" : ""}</span><span className="font-mono">{formatCost(action.qMicros)}</span></div>)}</div>
        {preview.projection ? <div className="rounded border border-divider-strong bg-card p-3"><PolicyProjectionView projection={preview.projection} compact /></div> : null}
      </div> : null}
    </div>
    <DialogFooter className="border-t border-divider-strong p-3"><Button onClick={() => onOpenChange(false)}>Close</Button></DialogFooter>
  </DialogContent></Dialog>;
}
const Evidence = ({ label, value }: { label: string; value: string }) => <div className="rounded border border-divider-strong bg-card p-3"><div className="font-mono text-[0.625rem] uppercase text-muted-foreground">{label}</div><div className="mt-1 truncate font-mono text-xs">{value}</div></div>;
