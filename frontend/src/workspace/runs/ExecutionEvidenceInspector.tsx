import type { ExecutionGraphOccurrenceV3, PolicyCostMeasureV1, PolicyProjectionV2 } from "@shared/api/workspace-contracts";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { PolicyProjectionView, formatCost, formatProbability } from "../policy/PolicyProjectionView";

export function ExecutionEvidenceInspector({ occurrence, localProjection, onClose }: {
  occurrence: ExecutionGraphOccurrenceV3; localProjection?: PolicyProjectionV2; onClose: () => void;
}) {
  const mobile = useIsMobile();
  const body = <ScrollArea className="min-h-0 flex-1"><div className="grid gap-4 p-4">
    <EvidenceGroup label="Scope" value={`${occurrence.scope} · ${occurrence.scopeKey}`} />
    <EvidenceGroup label="Decision State before" value={occurrence.decisionStateBefore ? JSON.stringify(occurrence.decisionStateBefore.features, null, 2) : "Unavailable"} />
    <EvidenceGroup label="Selected action" value={occurrence.actionId} />
    <EvidenceGroup label="Q(s,a) / V(s)" value={`${occurrence.selectedActionValueMicros === undefined ? "Unavailable" : formatCost(occurrence.selectedActionValueMicros)} / ${occurrence.expectedRemainingCostMicros === undefined ? "Unavailable" : formatCost(occurrence.expectedRemainingCostMicros)}`} />
    <EvidenceGroup label="Configured action cost" value={occurrence.configuredExpectedCostMicros === undefined ? "Unavailable" : formatCost(occurrence.configuredExpectedCostMicros)} />
    <EvidenceGroup label="Configured P(outcome,next state|state,action)" value={occurrence.expectedOutcomeDistribution.length ? occurrence.expectedOutcomeDistribution.map(({ outcomeId, expectedNextStateId, probabilityPpm }) => `${outcomeId} → ${expectedNextStateId}: ${formatProbability(probabilityPpm)}`).join("\n") : "Unavailable"} />
    <EvidenceGroup label="Observed semantic outcome" value={`${occurrence.observedOutcomeId ?? "Not observed"} · ${occurrence.verifiedResult ?? "—"}`} />
    <EvidenceGroup label="Canonical actual projected state" value={occurrence.actualState ? `${occurrence.actualState.stateId}\n${JSON.stringify(occurrence.actualState.features, null, 2)}` : "Projection unavailable"} />
    <EvidenceGroup label="Model support" value={occurrence.modelMatch ?? "Not classified"} />
    <EvidenceGroup label="Observed provider-neutral cost dimensions" value={formatObservedCost(occurrence.observedCost)} />
    <EvidenceGroup label="Provenance" value={`decision ${occurrence.policyDecisionId}\nmodel ${occurrence.modelSha256}\nsnapshot ${occurrence.snapshotSha256}${formatAttribution(occurrence)}`} />
    {localProjection ? <div><div className="mb-2 font-mono text-[0.625rem] uppercase tracking-wide text-muted-foreground">GraphNode local Policy Projection</div><PolicyProjectionView projection={localProjection} compact /></div> : null}
  </div></ScrollArea>;
  if (mobile) return <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}><SheetContent side="right" className="w-[92vw] max-w-[28rem] gap-0 border-divider-strong p-0"><SheetHeader className="border-b border-divider-strong"><SheetTitle>{occurrence.actionId}</SheetTitle><SheetDescription>Execution observation {occurrence.epoch}</SheetDescription></SheetHeader>{body}</SheetContent></Sheet>;
  return <aside className="flex min-h-0 w-[26rem] shrink-0 flex-col border-l border-divider-strong bg-card" aria-label={`${occurrence.actionId} execution evidence inspector`}><div className="flex items-start justify-between border-b border-divider-strong px-4 py-3"><div><div className="font-heading text-sm font-medium">{occurrence.actionId}</div><div className="mt-0.5 font-mono text-[0.65rem] text-muted-foreground">Execution observation {occurrence.epoch}</div></div><Button variant="ghost" size="xs" onClick={onClose}>Close</Button></div>{body}</aside>;
}

const EvidenceGroup = ({ label, value }: { label: string; value: string }) => <div><div className="font-mono text-[0.625rem] uppercase tracking-wide text-muted-foreground">{label}</div><pre className="mt-1 whitespace-pre-wrap rounded border border-divider-strong bg-background/45 p-2 font-mono text-[0.6875rem] leading-5">{value}</pre></div>;
const formatDuration = (milliseconds: number) => milliseconds < 1_000 ? `${Math.round(milliseconds)} ms` : `${(milliseconds / 1_000).toFixed(1)} s`;
const formatMeasure = (measure: PolicyCostMeasureV1, unit = "") => measure.status === "known"
  ? `${measure.value.toLocaleString()}${unit}` : `unknown (${measure.reason})`;
const formatObservedCost = (cost: ExecutionGraphOccurrenceV3["observedCost"]) => {
  if (!cost) return "Not observed";
  const dimensions = cost.dimensions;
  const duration = dimensions.durationMillis.status === "known"
    ? formatDuration(dimensions.durationMillis.value) : formatMeasure(dimensions.durationMillis);
  return [
    `duration: ${duration}`,
    `input tokens: ${formatMeasure(dimensions.inputTokens)}`,
    `output tokens: ${formatMeasure(dimensions.outputTokens)}`,
    `cached input tokens: ${formatMeasure(dimensions.cachedInputTokens)}`,
    `work retries: ${formatMeasure(dimensions.workRetryCount)}`,
    `repair attempts: ${formatMeasure(dimensions.repairAttemptCount)}`,
    `monetary: ${formatMeasure(dimensions.monetaryMicros, " µ")}`,
    `utility: ${formatMeasure(dimensions.utilityMicros, " µ")}`
  ].join("\n");
};
const formatAttribution = (occurrence: ExecutionGraphOccurrenceV3) => occurrence.observedCost
  ? `\nattribution ${occurrence.observedCost.attribution.mode} (${occurrence.observedCost.attribution.scope})`
    + `\nexecution tasks ${occurrence.observedCost.attribution.executionTaskIds.join(", ") || "none"}`
    + `\nchild observations ${occurrence.observedCost.attribution.childPolicyObservationIds.join(", ") || "none"}`
  : "";
