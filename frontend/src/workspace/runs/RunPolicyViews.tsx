import { useState, type ReactNode } from "react";
import type { PolicyDecisionRecordV3, RootRunDetail } from "@shared/api/workspace-contracts";
import { Badge } from "@/components/ui/badge";
import { ExecutionEvidenceInspector } from "./ExecutionEvidenceInspector";

export function RunPolicyViews({ detail }: { detail: RootRunDetail }) {
  const [selectedObservationId, setSelectedObservationId] = useState<string>();
  const observation = detail.orchestration.policyObservations.find(
    ({ policyObservationId }) => policyObservationId === selectedObservationId
  );
  const latest = detail.orchestration.policyDecisions.at(-1);
  const compiled = detail.orchestration.compiledPolicy;
  return <div className="flex min-h-0 min-w-0 flex-1">
    <div className="min-h-0 min-w-0 flex-1 overflow-auto p-3 sm:p-4"><div className="grid gap-4">
      <RunPositionStrip detail={detail} />
      <RunPanel title="Current decision" truth="Immutable compiled policy lookup">
        {latest ? <CurrentDecision decision={latest} /> : <p className="text-xs text-muted-foreground">Waiting for the first policy decision.</p>}
      </RunPanel>
      <RunPanel title="Compiled Q / V table" truth={`Reward-MDP v3 · ${compiled.iterations} deterministic iterations`}>
        <div className="grid gap-2">{compiled.states.map((state) => <div key={state.stateId} className="rounded border border-divider-strong bg-background/45 p-3"><div className="flex flex-wrap justify-between gap-2"><span className="font-mono text-xs">{state.stateId}</span><span className="font-mono text-xs text-primary">{state.selectedActionId} · V {formatMicros(state.valueMicros)}</span></div><div className="mt-2 font-mono text-[0.65rem] text-muted-foreground">{state.actionValues.map(({ actionId, qMicros }) => `${actionId}=${formatMicros(qMicros)}`).join(" · ")}</div></div>)}</div>
      </RunPanel>
      <RunPanel title="Acceptance progress" truth="Factual Validation evidence only">
        <div className="grid gap-2 sm:grid-cols-2">{detail.orchestration.acceptanceLedger.entries.map((entry) => <div key={entry.obligationId} className="rounded border border-divider-strong bg-background/45 p-3"><div className="flex justify-between gap-2"><span className="font-mono text-xs">{entry.obligationId}</span><Badge variant={entry.status === "verified" ? "secondary" : entry.status === "invalidated" ? "destructive" : "outline"}>{entry.status}</Badge></div><div className="mt-2 text-xs text-muted-foreground">weight {entry.weight} · {entry.evidenceRefs.join(" · ") || "no evidence"}</div></div>)}</div>
      </RunPanel>
      <RunPanel title="Execution observations" truth="Persisted semantic outcomes and realized rewards">
        {detail.orchestration.policyObservations.length ? <div className="execution-trajectory">{detail.orchestration.policyObservations.map((item, index) => <button type="button" key={item.policyObservationId} className="execution-occurrence" aria-label={`Policy observation ${index + 1}, ${item.actionId}`} onClick={() => setSelectedObservationId(item.policyObservationId)}><span className="execution-occurrence-index">{index + 1}</span><span className="min-w-0 flex-1"><strong>{item.actionId}</strong><small>{item.observedOutcomeId} · {item.verifiedResult} · reward {formatMicros(item.realizedRewardMicros)}</small></span><span className={item.modelMatch === "match" ? "text-secondary" : "text-destructive"}>{item.modelMatch === "match" ? "✓" : "!"}</span></button>)}</div> : <p className="text-xs text-muted-foreground">No completed Graph Node option has been observed.</p>}
      </RunPanel>
    </div></div>
    {observation ? <ExecutionEvidenceInspector observation={observation} onClose={() => setSelectedObservationId(undefined)} /> : null}
  </div>;
}

function CurrentDecision({ decision }: { decision: PolicyDecisionRecordV3 }) {
  return <div className="grid gap-3"><div className="grid gap-2 sm:grid-cols-4"><Evidence label="State" value={decision.state?.stateId ?? "invalid"} /><Evidence label="Selected action" value={decision.selectedActionId ?? "none"} /><Evidence label="V(s)" value={decision.stateValueMicros === undefined ? "unavailable" : formatMicros(decision.stateValueMicros)} /><Evidence label="Status" value={decision.solverStatus} /></div><div className="rounded border border-divider-strong">{[...decision.actionValues].sort((left, right) => right.qMicros - left.qMicros || left.actionId.localeCompare(right.actionId)).map((action) => <div key={action.actionId} className={`grid grid-cols-[minmax(0,1fr)_auto] border-b border-divider-strong px-3 py-2 text-xs last:border-0 ${action.actionId === decision.selectedActionId ? "bg-secondary/5" : ""}`}><span className="font-mono text-tertiary">{action.actionId}{action.actionId === decision.selectedActionId ? " ← selected" : ""}</span><span className="font-mono">Q {formatMicros(action.qMicros)}</span></div>)}</div>{decision.excludedActions.length ? <p className="text-xs text-muted-foreground">Hard-excluded: {decision.excludedActions.map(({ actionId, reasonCode }) => `${actionId} (${reasonCode})`).join(" · ")}</p> : null}<p className="font-mono text-[0.65rem] text-muted-foreground">model {short(decision.modelSha256)} · policy {short(decision.policySha256 ?? "unavailable")}</p></div>;
}

function RunPositionStrip({ detail }: { detail: RootRunDetail }) {
  return <div className="grid gap-2 rounded border border-divider-strong bg-card p-3 sm:grid-cols-2 lg:grid-cols-6"><Evidence label="Status" value={detail.status} /><Evidence label="Strategy" value={detail.executionSnapshot.decisionModel.strategyKind} /><Evidence label="Current Graph Node" value={detail.current?.graphNodeId ?? "decision epoch"} /><Evidence label="Current Action Node" value={detail.current?.actionNodeId ?? "ordered option"} /><Evidence label="State revision" value={String(detail.stateRevision)} /><Evidence label="Snapshot" value={short(detail.executionSnapshot.project.snapshotHash)} /></div>;
}

function RunPanel({ title, truth, children }: { title: string; truth: string; children: ReactNode }) {
  return <section className="rounded border border-divider-strong bg-card"><div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-divider-strong px-3 py-2"><h2 className="text-sm font-medium">{title}</h2><Badge variant="outline" className="font-mono text-[0.6rem] font-normal text-muted-foreground">{truth}</Badge></div><div className="p-3">{children}</div></section>;
}

const Evidence = ({ label, value }: { label: string; value: string }) => <div className="min-w-0 rounded border border-divider-strong bg-background/45 p-2"><div className="font-mono text-[0.6rem] uppercase text-muted-foreground">{label}</div><div className="mt-1 truncate font-mono text-xs">{value}</div></div>;
const formatMicros = (value: number) => (value / 1_000_000).toFixed(3);
const short = (value: string) => value.length > 14 ? `${value.slice(0, 12)}…` : value;
