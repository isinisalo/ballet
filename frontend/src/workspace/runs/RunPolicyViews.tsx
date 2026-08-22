import { useState } from "react";
import type { ReactNode } from "react";
import type {
  ExecutionGraphOccurrenceV1,
  PolicyDecisionRecordV1,
  RootRunDetail
} from "@shared/api/workspace-contracts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { PolicyProjectionView, formatCost, formatProbability } from "../policy/PolicyProjectionView";

export function RunPolicyViews({ detail }: { detail: RootRunDetail }) {
  const strategy = detail.executionSnapshot.graph.strategy;
  const decisions = detail.orchestration.policyDecisions;
  const latest = decisions.at(-1);
  const [selectedOccurrenceId, setSelectedOccurrenceId] = useState<string>();
  const occurrence = detail.orchestration.executionGraph.find(({ occurrenceId }) => occurrenceId === selectedOccurrenceId);
  if (strategy.kind !== "ssp_v1") return <AgentControlFlow detail={detail} />;
  return <div className="flex min-h-0 min-w-0 flex-1">
    <div className="min-h-0 min-w-0 flex-1 overflow-auto p-3 sm:p-4">
      <div className="grid gap-4">
        <RunPositionStrip detail={detail} />
        <RunPanel title="Capability Graph" truth="Immutable snapshot · what Ballet could choose">
          <div className="flex flex-wrap gap-2">{strategy.capabilityGraph.actions.map((action) => <div key={action.graphNodeId} className="rounded border border-divider-strong bg-background/45 px-3 py-2"><div className="font-mono text-xs text-tertiary">{action.graphNodeId}</div><div className="mt-1 text-[0.6875rem] text-muted-foreground">{action.guards.length ? action.guards.map((guard) => `${guard.featureId} ∈ ${guard.allowedValues.join("|")}`).join(" · ") : "No configured feature guard"}</div></div>)}</div>
        </RunPanel>
        <CurrentDecision decision={latest} />
        <RunPanel title="Policy Projection" truth="Derived · what policy predicts from the current Decision State">
          {detail.orchestration.policyProjection ? <PolicyProjectionView projection={detail.orchestration.policyProjection} /> : <p className="text-xs text-muted-foreground">A bounded projection is available after a converged policy decision with a valid Decision State.</p>}
        </RunPanel>
        <RunPanel title="Execution Graph" truth="Persisted facts · what Ballet selected and observed">
          {detail.orchestration.executionGraph.length ? <div className="execution-trajectory">{detail.orchestration.executionGraph.map((item, index) => <button type="button" key={item.occurrenceId} className="execution-occurrence" data-current={item.status === "running" ? "true" : "false"} aria-label={`Execution occurrence ${index + 1}, ${item.graphNodeId}, ${item.status}`} onClick={() => setSelectedOccurrenceId(item.occurrenceId)}>
            <span className="execution-occurrence-index">{item.epoch}</span>
            <span className="min-w-0 flex-1"><strong>{item.graphNodeId}</strong><small>{item.actualOutcome ? `observed ${item.actualOutcome}` : item.status}</small></span>
            <span className={item.actualOutcome === "PASS" ? "text-secondary" : item.actualOutcome === "FAIL" ? "text-destructive" : "text-tertiary"}>{item.actualOutcome === "PASS" ? "✓" : item.actualOutcome === "FAIL" ? "✕" : "←"}</span>
          </button>)}</div> : <p className="text-xs text-muted-foreground">No GraphNode execution occurrence has been selected yet.</p>}
          <p className="mt-3 text-[0.6875rem] text-muted-foreground">Repeated GraphNode IDs remain separate occurrences. Select one for decision and observation evidence.</p>
        </RunPanel>
        {detail.orchestration.policyTelemetry.length ? <RunPanel title="Observed telemetry" truth="Empirical samples · never automatic model updates">
          <div className="grid gap-2 md:grid-cols-2">{detail.orchestration.policyTelemetry.map((row) => <div key={`${row.graphNodeId}:${row.stateId}`} className="rounded border border-divider-strong bg-background/45 p-3 text-xs"><div className="font-mono text-tertiary">{row.graphNodeId}</div><div className="mt-1 text-muted-foreground">state class {row.stateId} · n={row.observationCount}</div><div className="mt-2 grid grid-cols-2 gap-1 font-mono text-[0.6875rem]"><span>PASS {row.outcomeCounts.PASS ?? 0}</span><span>FAIL {row.outcomeCounts.FAIL ?? 0}</span><span>mean duration {formatDuration(row.meanDurationMillis)}</span><span>mean actual cost {row.meanActualCostMicros === undefined ? "not recorded" : formatCost(row.meanActualCostMicros)}</span></div></div>)}</div>
        </RunPanel> : null}
      </div>
    </div>
    {occurrence ? <ExecutionEvidenceInspector occurrence={occurrence} onClose={() => setSelectedOccurrenceId(undefined)} /> : null}
  </div>;
}

function RunPositionStrip({ detail }: { detail: RootRunDetail }) {
  const snapshot = detail.executionSnapshot;
  return <div className="grid gap-2 rounded border border-divider-strong bg-card p-3 sm:grid-cols-2 lg:grid-cols-6">
    <Evidence label="Status" value={detail.status} /><Evidence label="Strategy" value={snapshot.graphDecision.strategyKind} /><Evidence label="Current GraphNode" value={detail.current?.graphNodeId ?? "decision epoch"} /><Evidence label="Role" value={detail.current?.nodeRole ?? "policy"} /><Evidence label="State revision" value={String(detail.stateRevision)} /><Evidence label="Snapshot" value={short(snapshot.project.snapshotHash)} />
  </div>;
}

function CurrentDecision({ decision }: { decision?: PolicyDecisionRecordV1 }) {
  return <RunPanel title="Current Decision" truth="Persisted decision record · why this GraphNode is next">
    {!decision ? <p className="text-xs text-muted-foreground">Waiting for the first policy decision record.</p> : <div className="grid gap-4">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><Evidence label="Decision State" value={decision.state?.stateId ?? "invalid"} /><Evidence label="State revision" value={String(decision.state?.sourceStateRevision ?? "—")} /><Evidence label="Solver status" value={decision.solverStatus} /><Evidence label="Expected remaining cost" value={decision.stateValueMicros === undefined ? "unavailable" : formatCost(decision.stateValueMicros)} /></div>
      {decision.state ? <div><div className="mb-2 font-mono text-[0.65rem] uppercase text-muted-foreground">Bounded state features used by policy</div><div className="flex flex-wrap gap-2">{Object.entries(decision.state.features).map(([key, value]) => <span key={key} className="rounded border border-divider-strong bg-background/45 px-2 py-1 font-mono text-[0.6875rem]"><span className="text-muted-foreground">{key}=</span>{value}</span>)}</div></div> : null}
      <div className="rounded border border-divider-strong"><div className="grid grid-cols-[minmax(0,1fr)_auto] border-b border-divider-strong bg-background/45 px-3 py-2 font-mono text-[0.625rem] uppercase text-muted-foreground"><span>Admissible action</span><span>Expected remaining cost</span></div>{[...decision.actionValues].sort((left, right) => left.qMicros - right.qMicros || left.graphNodeId.localeCompare(right.graphNodeId)).map((action) => <div key={action.graphNodeId} className={`grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-divider-strong px-3 py-2 text-xs last:border-0 ${action.graphNodeId === decision.selectedGraphNodeId ? "bg-secondary/5" : ""}`}><span className="font-mono text-tertiary">{action.graphNodeId}{action.graphNodeId === decision.selectedGraphNodeId ? " ← selected" : ""}</span><span className="font-mono">{formatCost(action.qMicros)}</span></div>)}</div>
      {decision.excludedActions.length ? <div className="text-xs text-muted-foreground"><span className="font-mono text-[0.65rem] uppercase">Excluded by hard controls:</span> {decision.excludedActions.map(({ graphNodeId, reasonCode }) => `${graphNodeId} (${reasonCode})`).join(" · ")}</div> : null}
      <div className="grid gap-2 border-t border-divider-strong pt-3 font-mono text-[0.6875rem] text-muted-foreground sm:grid-cols-2 lg:grid-cols-4"><span>decision {short(decision.policyDecisionId)}</span><span>model v{decision.modelVersion} · {short(decision.modelSha256)}</span><span>policy {short(decision.policySha256 ?? "unavailable")}</span><span>iterations {decision.iterations} · residual {decision.residual}</span></div>
      <p className="text-[0.6875rem] text-muted-foreground">Q-values derive from configured transition priors and scalar costs. They are model expectations, not empirical certainty.</p>
    </div>}
  </RunPanel>;
}

function ExecutionEvidenceInspector({ occurrence, onClose }: { occurrence: ExecutionGraphOccurrenceV1; onClose: () => void }) {
  const mobile = useIsMobile();
  const body = <ScrollArea className="min-h-0 flex-1"><div className="grid gap-4 p-4">
    <EvidenceGroup label="Decision State before" value={occurrence.decisionStateBefore ? JSON.stringify(occurrence.decisionStateBefore.features, null, 2) : "Unavailable"} />
    <EvidenceGroup label="Selected action" value={occurrence.graphNodeId} />
    <EvidenceGroup label="Expected remaining cost" value={occurrence.expectedRemainingCostMicros === undefined ? "Unavailable" : formatCost(occurrence.expectedRemainingCostMicros)} />
    <EvidenceGroup label="Selected Q(s,a)" value={occurrence.selectedActionValueMicros === undefined ? "Unavailable" : formatCost(occurrence.selectedActionValueMicros)} />
    <EvidenceGroup label="Configured option cost" value={occurrence.configuredExpectedCostMicros === undefined ? "Unavailable" : formatCost(occurrence.configuredExpectedCostMicros)} />
    <EvidenceGroup label="Configured outcome prior" value={occurrence.expectedOutcomeDistribution.length ? occurrence.expectedOutcomeDistribution.map(({ nextStateId, probabilityPpm }) => `${nextStateId}: ${formatProbability(probabilityPpm)}`).join("\n") : "Unavailable"} />
    <EvidenceGroup label="Actual bounded outcome" value={occurrence.actualOutcome ?? "Not observed yet"} />
    <EvidenceGroup label="Decision State after" value={occurrence.decisionStateAfter ? JSON.stringify(occurrence.decisionStateAfter.features, null, 2) : "Not observed yet"} />
    <EvidenceGroup label="Actual cost" value={occurrence.actualCostMicros === undefined ? "Not recorded" : formatCost(occurrence.actualCostMicros)} />
    <EvidenceGroup label="Duration" value={occurrence.durationMillis === undefined ? "Not observed yet" : formatDuration(occurrence.durationMillis)} />
    <EvidenceGroup label="Provenance" value={`decision ${occurrence.policyDecisionId}\nmodel ${occurrence.modelSha256}\nsnapshot ${occurrence.snapshotSha256}`} />
  </div></ScrollArea>;
  if (mobile) return <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}><SheetContent side="right" className="w-[92vw] max-w-[24rem] gap-0 border-divider-strong p-0"><SheetHeader className="border-b border-divider-strong"><SheetTitle>{occurrence.graphNodeId}</SheetTitle><SheetDescription>Execution occurrence {occurrence.epoch}</SheetDescription></SheetHeader>{body}</SheetContent></Sheet>;
  return <aside className="flex min-h-0 w-[23rem] shrink-0 flex-col border-l border-divider-strong bg-card" aria-label={`${occurrence.graphNodeId} execution evidence inspector`}><div className="flex items-start justify-between border-b border-divider-strong px-4 py-3"><div><div className="font-heading text-sm font-medium">{occurrence.graphNodeId}</div><div className="mt-0.5 font-mono text-[0.65rem] text-muted-foreground">Execution occurrence {occurrence.epoch}</div></div><Button variant="ghost" size="xs" onClick={onClose}>Close</Button></div>{body}</aside>;
}

function AgentControlFlow({ detail }: { detail: RootRunDetail }) { return <div className="min-h-0 flex-1 overflow-auto p-4"><RunPositionStrip detail={detail} /><div className="mt-4 rounded border border-divider-strong bg-card"><h2 className="border-b border-divider-strong px-3 py-2 font-mono text-[0.65rem] uppercase text-muted-foreground">Agent routing control flow</h2>{detail.controlFlowEvents.length ? detail.controlFlowEvents.map((event) => <div key={event.id} className="border-b border-divider-strong px-3 py-2 text-xs last:border-0"><span className="font-mono text-tertiary">{event.sequence}</span> · {event.kind}</div>) : <p className="p-3 text-xs text-muted-foreground">Waiting for the first routing decision.</p>}</div></div>; }
function RunPanel({ title, truth, children }: { title: string; truth: string; children: ReactNode }) { return <section className="rounded border border-divider-strong bg-card"><div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-divider-strong px-3 py-2"><h2 className="text-sm font-medium">{title}</h2><Badge variant="outline" className="font-mono text-[0.6rem] font-normal text-muted-foreground">{truth}</Badge></div><div className="p-3">{children}</div></section>; }
function Evidence({ label, value }: { label: string; value: string }) { return <div className="min-w-0 rounded border border-divider-strong bg-background/45 p-2"><div className="font-mono text-[0.6rem] uppercase text-muted-foreground">{label}</div><div className="mt-1 truncate font-mono text-xs">{value}</div></div>; }
function EvidenceGroup({ label, value }: { label: string; value: string }) { return <div><div className="font-mono text-[0.625rem] uppercase tracking-wide text-muted-foreground">{label}</div><pre className="mt-1 whitespace-pre-wrap rounded border border-divider-strong bg-background/45 p-2 font-mono text-[0.6875rem] leading-5">{value}</pre></div>; }
const short = (value: string) => value.length > 14 ? `${value.slice(0, 12)}…` : value;
const formatDuration = (milliseconds: number) => milliseconds < 1_000 ? `${Math.round(milliseconds)} ms` : `${(milliseconds / 1_000).toFixed(1)} s`;
