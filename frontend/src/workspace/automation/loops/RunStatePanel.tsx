import type { NodeRun, RootRunDetail } from "@shared/api/workspace-contracts";
import { Database, FileDiff } from "lucide-react";

export function RunStatePanel({ root }: { root: RootRunDetail }) {
  const nodes = new Map(root.loopRuns.flatMap(({ nodeRuns }) => nodeRuns).map((node) => [node.nodeRunId, node]));
  return (
    <section className="grid min-w-0 gap-3 border border-divider-strong bg-card p-3" aria-labelledby="run-state-heading">
      <header className="flex items-center justify-between gap-2">
        <h2 id="run-state-heading" className="flex items-center gap-2 font-mono text-[0.66rem] font-semibold uppercase tracking-[0.05em] text-muted-foreground"><Database className="size-3.5" /> Canonical State</h2>
        <span className="font-mono text-[0.58rem] text-secondary">revision {root.state.currentRevision}</span>
      </header>
      <JsonEvidence label="Current JSON State" value={root.state.currentState} defaultOpen />
      <div className="grid gap-2">
        {[...root.state.revisions].reverse().map((revision) => (
          <details key={revision.revision} className="border border-divider-strong bg-background/50 p-2" open={revision.revision === root.state.currentRevision}>
            <summary className="cursor-pointer list-none font-mono text-[0.62rem]">
              r{revision.revision} · {sourceLabel(revision.sourceNodeRunId ? nodes.get(revision.sourceNodeRunId) : undefined)}
              <span className="ml-2 text-muted-foreground">{revision.createdAt}</span>
            </summary>
            <div className="mt-2 grid gap-2 text-xs text-muted-foreground">
              <span className="break-all font-mono text-[0.56rem]">state sha256: {revision.stateSha256}</span>
              {revision.patch ? <JsonEvidence label="Committed patch evidence" value={revision.patch.patch} /> : null}
              {revision.patchOmitted ? <p className="flex items-center gap-1 text-tertiary"><FileDiff className="size-3" /> Patch evidence omitted by the bounded read projection.</p> : null}
              {!revision.patch && !revision.patchOmitted ? <p>Initial revision or no state mutation.</p> : null}
            </div>
          </details>
        ))}
      </div>
      {root.state.historyTruncated ? <p className="text-xs text-tertiary">Showing {root.state.revisions.length} of {root.state.totalRevisionCount} revision records.</p> : null}
    </section>
  );
}

function JsonEvidence({ label, value, defaultOpen = false }: { label: string; value: unknown; defaultOpen?: boolean }) {
  const source = JSON.stringify(value ?? null, null, 2);
  const large = source.length > 4_096;
  return <details className="min-w-0 border border-divider-strong bg-background" open={defaultOpen && !large}>
    <summary className="cursor-pointer px-2 py-1.5 font-mono text-[0.62rem] text-muted-foreground">{label} · {source.length} chars{large ? " · collapsed" : ""}</summary>
    <pre className="max-h-80 min-w-0 overflow-auto border-t border-divider-strong p-2 font-mono text-[0.62rem] leading-4 text-foreground">{source}</pre>
  </details>;
}

const sourceLabel = (node?: NodeRun): string => node ? `${roleLabel(node.role)} · ${node.nodeDefinitionId}` : "Root initialization";
const roleLabel = (role: NodeRun["role"]): string => role === "work" ? "Work" : role === "validation" ? "Validation" : "Orchestrator";
