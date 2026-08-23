import { useState, type ReactNode } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, Target } from "lucide-react";
import type {
  PolicyPreviewResultV3,
  ProjectRewardDecisionStrategyV3,
  RewardModelV3
} from "@shared/api/workspace-contracts";
import { OperationalStatus } from "@/components/shared/workspace-ui";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import {
  acceptanceStatus,
  exactMicros,
  exactPpm,
  formatRewardMicros,
  resolveDecisionModelView,
  type AcceptanceStatus,
  type DecisionCompiledState,
  type DecisionStateDefinition
} from "./decisionModelPresentation";
import { PolicyLandscape, RewardTuning, TransitionImpactPanel } from "./DecisionModelPanels";

export function DecisionModelWorkspace({ strategy, actionOrder, issues, preview, loading, locked, onStrategyChange }: {
  strategy: ProjectRewardDecisionStrategyV3;
  actionOrder?: string[];
  issues: Array<{ path: string; message: string }>;
  preview?: PolicyPreviewResultV3;
  loading: boolean;
  locked: boolean;
  onStrategyChange: (strategy: ProjectRewardDecisionStrategyV3) => void;
}) {
  const [exploredStateId, setExploredStateId] = useState<string>();
  const view = resolveDecisionModelView(strategy, preview, exploredStateId);
  const ready = view.compiled?.status === "compiled" && issues.length === 0;
  const setReward = (key: keyof Omit<RewardModelV3, "outcomePenaltyMicros">, value: number) =>
    onStrategyChange({ ...strategy, model: { ...strategy.model, reward: { ...strategy.model.reward, [key]: value } } });

  return <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-3 sm:p-4">
    <div className="mx-auto grid min-w-0 max-w-[96rem] gap-3 sm:gap-4">
      {locked ? <Alert><AlertDescription>The immutable Run snapshot locks this model.</AlertDescription></Alert> : null}
      {issues.length ? <Alert variant="destructive"><AlertDescription>{issues[0]!.message}</AlertDescription></Alert> : null}
      <DecisionPulse
        strategy={strategy}
        currentDefinition={view.currentDefinition}
        currentPolicyState={view.compiled?.states.find(({ stateId }) => stateId === view.currentStateId)}
        selectedActionId={view.selectedActionId}
        expectedReturnMicros={view.expectedReturnMicros}
        ready={ready}
        loading={loading}
      />
      <PolicyHorizon strategy={strategy} actionOrder={actionOrder} state={view.selectedPolicyState} selectedStateId={view.selectedStateId} />
      <TransitionImpactPanel
        strategy={strategy}
        state={view.selectedDefinition}
        policyState={view.selectedPolicyState}
        row={view.selectedRow}
        current={view.selectedStateId === view.currentStateId}
      />
      <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1.05fr)_minmax(28rem,0.95fr)]">
        <PolicyLandscape
          strategy={strategy}
          compiled={view.compiled}
          currentStateId={view.currentStateId}
          selectedStateId={view.selectedStateId}
          onSelect={setExploredStateId}
        />
        <RewardTuning strategy={strategy} locked={locked} onChange={setReward} />
      </div>
    </div>
  </div>;
}

function DecisionPulse({ strategy, currentDefinition, currentPolicyState, selectedActionId, expectedReturnMicros, ready, loading }: {
  strategy: ProjectRewardDecisionStrategyV3;
  currentDefinition?: DecisionStateDefinition;
  currentPolicyState?: DecisionCompiledState;
  selectedActionId?: string;
  expectedReturnMicros?: number;
  ready: boolean;
  loading: boolean;
}) {
  const statuses = strategy.model.acceptance.obligations.map(({ obligationId }) =>
    acceptanceStatus(currentDefinition, obligationId));
  const verified = statuses.filter((status) => status === "verified").length;
  const allBranches = strategy.model.stateActions.flatMap(({ successors }) => successors);
  const defaultPriorCount = allBranches.filter(({ provenance }) => provenance === "default_prior").length;
  const decision = selectedActionId ?? currentPolicyState?.selectedActionId ?? "unavailable";
  const score = expectedReturnMicros ?? currentPolicyState?.valueMicros;

  return <section aria-labelledby="decision-pulse-title" className="overflow-hidden rounded-lg border border-divider-strong bg-card">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-divider-strong bg-panel-header px-4 py-3">
      <div className="min-w-0">
        <h2 id="decision-pulse-title" className="font-heading text-base font-medium">Decision pulse</h2>
        <p className="mt-0.5 break-words text-xs text-muted-foreground">{strategy.description}</p>
      </div>
      <OperationalStatus label={ready ? "Policy compiled" : loading ? "Compiling" : "Run blocked"} tone={ready ? "healthy" : loading ? "attention" : "danger"} />
    </div>
    <div className="grid divide-y divide-divider-strong sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-[1.05fr_0.8fr_1fr_0.9fr_1.15fr]">
      <PulseMetric label="Projected state" className="sm:col-span-2 xl:col-span-1">
        <div className="truncate font-mono text-lg text-primary" title={currentDefinition?.id}>{currentDefinition?.id ?? "unavailable"}</div>
        <div className="mt-1 font-mono text-[0.625rem] text-muted-foreground">draft preview · not a live Run</div>
      </PulseMetric>
      <PulseMetric label="Acceptance">
        <div className="flex items-center gap-3">
          <AcceptanceRing statuses={statuses} />
          <div><div className="font-mono text-lg">{verified} / {statuses.length}</div><div className="text-[0.65rem] text-muted-foreground">verified</div></div>
        </div>
      </PulseMetric>
      <PulseMetric label="Next decision">
        <div className="flex items-center gap-2 text-secondary"><Target className="size-5" /><span className="truncate font-mono text-xl font-medium uppercase" title={decision}>{decision}</span></div>
        <div className="mt-1 text-[0.65rem] text-muted-foreground">highest admissible Q-value</div>
      </PulseMetric>
      <PulseMetric label="Long-run score">
        <div className={cn("font-mono text-xl", score !== undefined && score >= 0 ? "text-secondary" : "text-destructive")} title={score === undefined ? undefined : exactMicros(score)}>
          {score === undefined ? "—" : formatRewardMicros(score, true)}
        </div>
        <div className="mt-1 text-[0.65rem] text-muted-foreground">reward units · V(s)</div>
      </PulseMetric>
      <PulseMetric label="Model confidence" className="sm:col-span-2 xl:col-span-1">
        {defaultPriorCount ? <div className="flex items-start gap-2 text-tertiary"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><div><div className="font-mono text-xs uppercase">Default prior</div><div className="mt-1 text-[0.65rem] text-muted-foreground">{defaultPriorCount} uncalibrated branches</div></div></div>
          : <div className="flex items-center gap-2 text-secondary"><CheckCircle2 className="size-4" /><span className="font-mono text-xs uppercase">Authored evidence</span></div>}
      </PulseMetric>
    </div>
    <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-divider-strong px-4 py-2 font-mono text-[0.625rem] text-muted-foreground">
      <span>{strategy.id}</span><span>Reward-MDP v3</span><span title={exactPpm(strategy.model.discountPpm)}>γ {(strategy.model.discountPpm / 1_000_000).toFixed(2)}</span>
    </div>
  </section>;
}

function PulseMetric({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return <div className={cn("min-w-0 px-4 py-3", className)}>
    <div className="mb-2 font-mono text-[0.625rem] uppercase tracking-wide text-muted-foreground">{label}</div>
    {children}
  </div>;
}

function AcceptanceRing({ statuses }: { statuses: AcceptanceStatus[] }) {
  const segment = statuses.length ? Math.max(2, 100 / statuses.length - 2.5) : 0;
  return <svg viewBox="0 0 48 48" className="size-11 shrink-0 -rotate-90" role="img" aria-label={`${statuses.filter((status) => status === "verified").length} of ${statuses.length} acceptance obligations verified`}>
    <circle cx="24" cy="24" r="18" pathLength="100" fill="none" stroke="var(--divider-strong)" strokeWidth="6" opacity="0.55" />
    {statuses.map((status, index) => <circle
      key={`${status}:${index}`}
      cx="24" cy="24" r="18" pathLength="100" fill="none" strokeWidth="6" strokeLinecap="butt"
      stroke={status === "verified" ? "var(--secondary)" : status === "invalidated" ? "var(--destructive)" : "var(--outline)"}
      strokeDasharray={`${segment} ${100 - segment}`}
      strokeDashoffset={-(index * 100 / Math.max(statuses.length, 1))}
    />)}
  </svg>;
}

function PolicyHorizon({ strategy, actionOrder, state, selectedStateId }: {
  strategy: ProjectRewardDecisionStrategyV3;
  actionOrder?: string[];
  state?: DecisionCompiledState;
  selectedStateId?: string;
}) {
  const qValues = new Map(state?.actionValues.map(({ actionId, qMicros }) => [actionId, qMicros]));
  const globallyModeled = new Set(strategy.model.stateActions.map(({ actionId }) => actionId));
  const capabilityIds = strategy.capabilityModel.actions.map(({ actionId }) => actionId);
  const capabilitySet = new Set(capabilityIds);
  const orderedActionIds = [...(actionOrder ?? []).filter((actionId) => capabilitySet.has(actionId)),
    ...capabilityIds.filter((actionId) => !actionOrder?.includes(actionId))];
  return <section aria-labelledby="policy-horizon-title" className="min-w-0 rounded-lg border border-divider-strong bg-card p-4">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <div><h2 id="policy-horizon-title" className="font-heading text-sm font-medium">Policy horizon</h2><p className="mt-1 text-xs text-muted-foreground">Configured GraphNode options. The policy may jump or return when evidence changes.</p></div>
      <div className="font-mono text-[0.625rem] text-muted-foreground">exploring {selectedStateId ?? "unavailable"}</div>
    </div>
    <div className="mt-3 overflow-x-auto pb-1">
      <div className="flex min-w-max items-stretch">
        {orderedActionIds.map((actionId, index) => {
          const qMicros = qValues.get(actionId);
          const selected = state?.selectedActionId === actionId;
          const modeled = globallyModeled.has(actionId);
          return <div key={actionId} className="flex items-center">
            <article className={cn(
              "grid min-h-28 w-40 content-between rounded-md border p-3",
              selected ? "border-secondary bg-secondary/10" : qMicros !== undefined ? "border-primary/50 bg-primary/5" : modeled ? "border-divider-strong bg-background/45" : "border-dashed border-tertiary/60 bg-tertiary/5"
            )}>
              <div className="flex min-w-0 items-start justify-between gap-2">
                <div className="font-mono text-[0.625rem] text-muted-foreground">{String(index + 1).padStart(2, "0")}</div>
                {selected ? <span className="font-mono text-[0.6rem] uppercase text-secondary">next</span> : null}
              </div>
              <div className={cn("truncate font-mono text-sm uppercase", selected ? "text-secondary" : "text-foreground")} title={actionId}>{actionId}</div>
              <div className="font-mono text-[0.625rem] text-muted-foreground" title={qMicros === undefined ? undefined : exactMicros(qMicros)}>
                {qMicros !== undefined ? `Q ${formatRewardMicros(qMicros, true)}` : modeled ? "available in another state" : "needs transition model"}
              </div>
            </article>
            {index < orderedActionIds.length - 1 ? <ArrowRight className="mx-1.5 size-4 text-divider-strong" aria-hidden="true" /> : null}
          </div>;
        })}
      </div>
    </div>
  </section>;
}
