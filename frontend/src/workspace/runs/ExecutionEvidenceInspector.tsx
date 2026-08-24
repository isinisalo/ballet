import type { PolicyCostMeasureV1, PolicyOptionObservationV5 } from "@shared/api/workspace-contracts";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

export function ExecutionEvidenceInspector({ observation, onClose }: {
  observation: PolicyOptionObservationV5;
  onClose: () => void;
}) {
  const mobile = useIsMobile();
  const body = <ScrollArea className="min-h-0 flex-1"><div className="grid gap-4 p-4">
    <EvidenceGroup label="Decision state before" value={`${observation.stateBefore.scope}${observation.stateBefore.graphNodeId ? ` · ${observation.stateBefore.graphNodeId}` : ""}\n${observation.stateBefore.stateId}`} />
    <EvidenceGroup label="Selected action" value={observation.actionId} />
    <EvidenceGroup label="Configured P(outcome,target|state,action)" value={observation.expectedOutcomeDistribution.map(({ outcomeId, target, probabilityPpm, provenance }) => `${outcomeId} → ${target.kind === "state" ? target.stateId : `${target.terminal}${target.emitOutcomeId ? ` · emit ${target.emitOutcomeId}` : ""}`}: ${formatProbability(probabilityPpm)} · ${provenance}`).join("\n")} />
    <EvidenceGroup label="Observed semantic outcome" value={`${observation.observedOutcomeId} · ${observation.verifiedResult}`} />
    <EvidenceGroup label="Deterministic branch result" value={observation.actualState ? observation.actualState.stateId : observation.terminal ? `terminal · ${observation.terminal}` : "Unavailable"} />
    <EvidenceGroup label="Acceptance ledger" value={observation.acceptanceLedgerAfter.entries.map(({ obligationId, status, weight }) => `${obligationId}: ${status} (${weight})`).join("\n")} />
    <EvidenceGroup label="Realized reward" value={`${formatMicros(observation.realizedRewardMicros)} · ${observation.modelMatch}`} />
    <EvidenceGroup label="Observed provider-neutral cost" value={formatObservedCost(observation)} />
    <EvidenceGroup label="Provenance" value={`decision ${observation.policyDecisionId}\nmodel ${observation.modelSha256}\nsnapshot ${observation.snapshotSha256}`} />
  </div></ScrollArea>;
  if (mobile) return <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}><SheetContent side="right" className="w-[92vw] max-w-[28rem] gap-0 border-divider-strong p-0"><SheetHeader className="border-b border-divider-strong"><SheetTitle>{observation.actionId}</SheetTitle><SheetDescription>Policy observation</SheetDescription></SheetHeader>{body}</SheetContent></Sheet>;
  return <aside className="flex min-h-0 w-[26rem] shrink-0 flex-col border-l border-divider-strong bg-card" aria-label={`${observation.actionId} execution evidence inspector`}><div className="flex items-start justify-between border-b border-divider-strong px-4 py-3"><div><div className="font-heading text-sm font-medium">{observation.actionId}</div><div className="mt-0.5 font-mono text-[0.65rem] text-muted-foreground">Policy observation</div></div><Button variant="ghost" size="xs" onClick={onClose}>Close</Button></div>{body}</aside>;
}

const EvidenceGroup = ({ label, value }: { label: string; value: string }) => <div><div className="font-mono text-[0.625rem] uppercase tracking-wide text-muted-foreground">{label}</div><pre className="mt-1 whitespace-pre-wrap rounded border border-divider-strong bg-background/45 p-2 font-mono text-[0.6875rem] leading-5">{value}</pre></div>;
const formatProbability = (ppm: number) => `${(ppm / 10_000).toFixed(2)}%`;
const formatMicros = (micros: number) => `${(micros / 1_000_000).toFixed(3)} reward`;
const formatMeasure = (measure: PolicyCostMeasureV1, unit = "") => measure.status === "known"
  ? `${measure.value.toLocaleString()}${unit}` : `unknown (${measure.reason})`;
const formatObservedCost = ({ observedCost }: PolicyOptionObservationV5) => {
  const dimensions = observedCost.dimensions;
  return [
    `duration: ${formatMeasure(dimensions.durationMillis, " ms")}`,
    `input tokens: ${formatMeasure(dimensions.inputTokens)}`,
    `output tokens: ${formatMeasure(dimensions.outputTokens)}`,
    `cached input tokens: ${formatMeasure(dimensions.cachedInputTokens)}`,
    `work retries: ${formatMeasure(dimensions.workRetryCount)}`,
    `monetary: ${formatMeasure(dimensions.monetaryMicros, " µ")}`
  ].join("\n");
};
