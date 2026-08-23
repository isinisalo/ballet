import type { ReactNode } from "react";
import { AlertTriangle, ArrowRight, Check, CheckCircle2, CircleDashed, Minus, Plus, Target, X } from "lucide-react";
import type {
  PolicyPreviewResultV3,
  ProjectRewardDecisionStrategyV3,
  RewardModelV3
} from "@shared/api/workspace-contracts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  acceptanceStatus,
  exactMicros,
  exactPpm,
  formatProbabilityPpm,
  formatRewardMicros,
  relativeBarWidth,
  relativeValueBucket,
  rewardUnitMicros,
  transitionImpact,
  type AcceptanceStatus,
  type ImpactTone
} from "./decisionModelPresentation";

type CompiledPolicy = NonNullable<NonNullable<PolicyPreviewResultV3["preview"]>["compiledPolicy"]>;
type CompiledState = CompiledPolicy["states"][number];
type StateDefinition = ProjectRewardDecisionStrategyV3["model"]["states"][number];
type StateActionRow = ProjectRewardDecisionStrategyV3["model"]["stateActions"][number];

export function TransitionImpactPanel({ strategy, state, policyState, row, current }: {
  strategy: ProjectRewardDecisionStrategyV3;
  state?: StateDefinition;
  policyState?: CompiledState;
  row?: StateActionRow;
  current: boolean;
}) {
  return <section aria-labelledby="transition-impact-title" className="min-w-0 rounded-lg border border-divider-strong bg-card p-4">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <div><h2 id="transition-impact-title" className="font-heading text-sm font-medium">Transition impact</h2><p className="mt-1 text-xs text-muted-foreground">Branch width shows probability. Color and sign show immediate reward impact.</p></div>
      <div className="font-mono text-[0.625rem] text-muted-foreground">{current ? "projected state" : "read-only state exploration"}</div>
    </div>
    {state && policyState && row ? <div className="mt-4 grid min-w-0 items-center gap-3 lg:grid-cols-[minmax(9rem,0.75fr)_auto_minmax(9rem,0.65fr)_auto_minmax(18rem,1.8fr)]">
      <FlowNode eyebrow="State" value={state.id} tone="primary" />
      <FlowArrow muted={false} />
      <FlowNode eyebrow="Policy action" value={policyState.selectedActionId} tone="rewarding" icon={<Target className="size-4" />} />
      <FlowArrow muted />
      <div className="grid min-w-0 gap-2">
        {row.successors.map((branch) => {
          const next = strategy.model.states.find(({ id }) => id === branch.nextStateId);
          if (!next) return null;
          const impact = transitionImpact(strategy, state, next, branch.outcomeId);
          const probability = branch.probabilityPpm / 10_000;
          return <article key={`${branch.outcomeId}:${branch.nextStateId}`} className={cn("min-w-0 rounded-md border p-3", impactSurface(impact.tone))} aria-label={`${branch.outcomeId}, ${formatProbabilityPpm(branch.probabilityPpm)}, ${formatRewardMicros(impact.netRewardMicros, true)} reward units, next state ${branch.nextStateId}`}>
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0"><div className="truncate font-mono text-xs uppercase" title={branch.outcomeId}>{branch.outcomeId.replaceAll("-", " ")}</div><div className="mt-1 font-mono text-[0.625rem] text-muted-foreground">→ {branch.nextStateId}</div></div>
              <div className="shrink-0 text-right"><div className="font-mono text-sm" title={exactMicros(impact.netRewardMicros)}>{formatRewardMicros(impact.netRewardMicros, true)}</div><div className="text-[0.625rem] text-muted-foreground">{impactLabel(impact.tone)}</div></div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-background/70"><div className={cn("h-full", impactBar(impact.tone))} style={{ width: `${Math.max(probability, 3)}%` }} /></div>
              <span className="w-12 text-right font-mono text-xs" title={exactPpm(branch.probabilityPpm)}>{formatProbabilityPpm(branch.probabilityPpm)}</span>
            </div>
            <div className={cn("mt-2 flex items-center gap-1 font-mono text-[0.6rem] uppercase", branch.provenance === "default_prior" ? "text-tertiary" : "text-primary")}>
              {branch.provenance === "default_prior" ? <AlertTriangle className="size-3" /> : <Check className="size-3" />}{branch.provenance === "default_prior" ? "estimate · default prior" : "authored evidence"}
            </div>
          </article>;
        })}
      </div>
    </div> : <div className="mt-4 rounded-md border border-dashed border-tertiary/60 bg-tertiary/5 p-4 text-sm text-muted-foreground">No compiled transition is available for this state. Add a state/action row before the policy can select the GraphNode.</div>}
  </section>;
}

export function PolicyLandscape({ strategy, compiled, currentStateId, selectedStateId, onSelect }: {
  strategy: ProjectRewardDecisionStrategyV3;
  compiled?: CompiledPolicy;
  currentStateId?: string;
  selectedStateId?: string;
  onSelect: (stateId: string) => void;
}) {
  const states = compiled?.states ?? [];
  const values = states.map(({ valueMicros }) => valueMicros);
  const minimum = values.length ? Math.min(...values) : 0;
  const maximum = values.length ? Math.max(...values) : 0;
  const selected = states.find(({ stateId }) => stateId === selectedStateId);
  const definition = strategy.model.states.find(({ id }) => id === selectedStateId);
  const actionValues = [...(selected?.actionValues ?? [])].sort((left, right) => right.qMicros - left.qMicros || left.actionId.localeCompare(right.actionId));
  const actionMinimum = actionValues.length ? Math.min(...actionValues.map(({ qMicros }) => qMicros)) : 0;
  const actionMaximum = actionValues.length ? Math.max(...actionValues.map(({ qMicros }) => qMicros)) : 0;

  return <section aria-labelledby="policy-landscape-title" className="min-w-0 rounded-lg border border-divider-strong bg-card p-4">
    <div className="flex flex-wrap items-baseline justify-between gap-2"><div><h2 id="policy-landscape-title" className="font-heading text-sm font-medium">Policy landscape <span className="font-mono text-xs text-muted-foreground">· {states.length} states</span></h2><p className="mt-1 text-xs text-muted-foreground">Select a tile to inspect its acceptance state, Q-values and transitions.</p></div><div className="font-mono text-[0.625rem] text-muted-foreground">relative long-run value</div></div>
    {states.length ? <>
      <div className="mt-3 flex max-h-64 flex-wrap gap-1 overflow-y-auto pr-1" role="group" aria-label="Compiled policy states">
        {states.map((state) => <LandscapeTile key={state.stateId} state={state} currentStateId={currentStateId} selectedStateId={selectedStateId} minimum={minimum} maximum={maximum} onSelect={onSelect} />)}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 font-mono text-[0.625rem] text-muted-foreground">
        <LegendSwatch className="bg-destructive/75" label="costly" /><LegendSwatch className="bg-tertiary/70" label="neutral" /><LegendSwatch className="bg-secondary/70" label="rewarding" /><LegendSwatch className="border-primary ring-1 ring-primary" label="selected" />
      </div>
      <div className="mt-4 grid min-w-0 gap-4 border-t border-divider-strong pt-4 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <AcceptanceDetails strategy={strategy} definition={definition} selectedStateId={selectedStateId} />
        <ActionValues values={actionValues} selectedActionId={selected?.selectedActionId} minimum={actionMinimum} maximum={actionMaximum} />
      </div>
    </> : <div className="mt-4 rounded border border-dashed border-divider-strong p-4 text-sm text-muted-foreground">No compiled policy landscape is available.</div>}
  </section>;
}

export function RewardTuning({ strategy, locked, onChange }: {
  strategy: ProjectRewardDecisionStrategyV3;
  locked: boolean;
  onChange: (key: keyof Omit<RewardModelV3, "outcomePenaltyMicros">, value: number) => void;
}) {
  const controls: Array<{ key: keyof Omit<RewardModelV3, "outcomePenaltyMicros">; label: string; sign: "cost" | "reward" }> = [
    { key: "actionCostMicros", label: "Action cost", sign: "cost" },
    { key: "completionBonusMicros", label: "Completion", sign: "reward" },
    { key: "progressPotentialScaleMicros", label: "Progress", sign: "reward" }
  ];
  const penalties = Object.entries(strategy.model.reward.outcomePenaltyMicros);
  return <section aria-labelledby="reward-tuning-title" className="min-w-0 rounded-lg border border-divider-strong bg-card p-4">
    <div className="flex flex-wrap items-baseline justify-between gap-2"><div><h2 id="reward-tuning-title" className="font-heading text-sm font-medium">Reward tuning</h2><p className="mt-1 text-xs text-muted-foreground">Human-scale reward units. Exact integer micros remain in the model.</p></div><div className="font-mono text-[0.625rem] text-muted-foreground" title={exactPpm(strategy.model.discountPpm)}>γ {(strategy.model.discountPpm / 1_000_000).toFixed(2)}</div></div>
    <div className="mt-3 grid gap-2 sm:grid-cols-3">
      {controls.map((control) => <RewardControl key={control.key} control={control} strategy={strategy} locked={locked} onChange={onChange} />)}
    </div>
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between gap-3 font-mono text-[0.625rem] uppercase text-muted-foreground"><span>Outcome penalty spectrum</span><span>higher cost →</span></div>
      <div className="grid gap-1 sm:grid-cols-5">
        {penalties.map(([key, value]) => <div key={key} className={cn("min-w-0 rounded-sm border p-2.5 text-center", penaltySurface(key))}>
          <div className="truncate font-mono text-[0.56rem] uppercase" title={key.replaceAll("_", " ")}>{key.replaceAll("_", " ")}</div>
          <div className="mt-1 font-mono text-base" title={exactMicros(value)}>{formatRewardMicros(-value, false)}</div>
        </div>)}
      </div>
    </div>
  </section>;
}

function FlowArrow({ muted }: { muted: boolean }) {
  return <ArrowRight className={cn("mx-auto size-5 rotate-90 lg:rotate-0", muted ? "text-divider-strong" : "text-primary")} aria-hidden="true" />;
}

function FlowNode({ eyebrow, value, tone, icon }: { eyebrow: string; value: string; tone: "primary" | "rewarding"; icon?: ReactNode }) {
  return <div className={cn("grid min-h-24 min-w-0 content-center rounded-md border p-3", tone === "rewarding" ? "border-secondary/60 bg-secondary/10" : "border-primary/60 bg-primary/10")}>
    <div className="font-mono text-[0.625rem] uppercase text-muted-foreground">{eyebrow}</div>
    <div className={cn("mt-2 flex min-w-0 items-center gap-2 font-mono text-sm", tone === "rewarding" ? "text-secondary" : "text-primary")}>{icon}<span className="truncate" title={value}>{value}</span></div>
  </div>;
}

function LandscapeTile({ state, currentStateId, selectedStateId, minimum, maximum, onSelect }: {
  state: CompiledState;
  currentStateId?: string;
  selectedStateId?: string;
  minimum: number;
  maximum: number;
  onSelect: (stateId: string) => void;
}) {
  const bucket = relativeValueBucket(state.valueMicros, minimum, maximum);
  return <button type="button" onClick={() => onSelect(state.stateId)} aria-pressed={state.stateId === selectedStateId} aria-current={state.stateId === currentStateId ? "true" : undefined}
    aria-label={`${state.stateId}, selected action ${state.selectedActionId}, V ${formatRewardMicros(state.valueMicros, true)} reward units${state.stateId === currentStateId ? ", projected state" : ""}`}
    title={`${state.stateId} · ${state.selectedActionId} · V ${formatRewardMicros(state.valueMicros, true)} (${exactMicros(state.valueMicros)})`}
    className={cn("relative size-10 rounded-sm border transition-colors motion-reduce:transition-none sm:size-7", landscapeBucket(bucket), state.stateId === selectedStateId ? "ring-2 ring-primary ring-offset-1 ring-offset-card" : "border-transparent", state.stateId === currentStateId && "after:absolute after:right-0.5 after:top-0.5 after:size-1.5 after:rounded-full after:bg-primary")} />;
}

function AcceptanceDetails({ strategy, definition, selectedStateId }: { strategy: ProjectRewardDecisionStrategyV3; definition?: StateDefinition; selectedStateId?: string }) {
  return <div className="min-w-0">
    <div className="font-mono text-[0.625rem] uppercase text-muted-foreground">Explored state</div>
    <div className="mt-1 truncate font-mono text-sm text-primary" title={selectedStateId}>{selectedStateId}</div>
    <div className="mt-3 grid gap-1.5">
      {strategy.model.acceptance.obligations.map((obligation) => {
        const status = acceptanceStatus(definition, obligation.obligationId);
        return <div key={obligation.obligationId} className="flex min-w-0 items-center gap-2 text-xs" title={obligation.description}><AcceptanceIcon status={status} /><span className="min-w-0 flex-1 truncate font-mono">{obligation.obligationId}</span><span className={cn("font-mono text-[0.6rem] uppercase", acceptanceTone(status))}>{status}</span></div>;
      })}
    </div>
  </div>;
}

function ActionValues({ values, selectedActionId, minimum, maximum }: { values: CompiledState["actionValues"]; selectedActionId?: string; minimum: number; maximum: number }) {
  return <div className="min-w-0">
    <div className="font-mono text-[0.625rem] uppercase text-muted-foreground">Action value · Q(s,a)</div>
    <div className="mt-2 grid max-h-44 gap-2 overflow-y-auto pr-1">
      {values.map(({ actionId, qMicros }) => <div key={actionId} className="min-w-0">
        <div className="mb-1 flex min-w-0 justify-between gap-3 font-mono text-[0.65rem]"><span className={cn("truncate", actionId === selectedActionId ? "text-secondary" : "text-muted-foreground")}>{actionId}{actionId === selectedActionId ? " · selected" : ""}</span><span className="shrink-0" title={exactMicros(qMicros)}>{formatRewardMicros(qMicros, true)}</span></div>
        <div className="h-1 overflow-hidden rounded-full bg-background"><div className={cn("h-full", actionId === selectedActionId ? "bg-secondary" : "bg-primary/55")} style={{ width: `${relativeBarWidth(qMicros, minimum, maximum)}%` }} /></div>
      </div>)}
    </div>
  </div>;
}

function RewardControl({ control, strategy, locked, onChange }: {
  control: { key: keyof Omit<RewardModelV3, "outcomePenaltyMicros">; label: string; sign: "cost" | "reward" };
  strategy: ProjectRewardDecisionStrategyV3;
  locked: boolean;
  onChange: (key: keyof Omit<RewardModelV3, "outcomePenaltyMicros">, value: number) => void;
}) {
  const value = strategy.model.reward[control.key];
  const shown = control.sign === "cost" ? -value : value;
  return <article className={cn("rounded-md border p-3", control.sign === "cost" ? "border-destructive/45 bg-destructive/5" : "border-secondary/40 bg-secondary/5")}>
    <div className={cn("font-mono text-[0.625rem] uppercase", control.sign === "cost" ? "text-destructive" : "text-secondary")}>{control.label}</div>
    <div className={cn("mt-2 font-mono text-2xl", control.sign === "cost" ? "text-destructive" : "text-secondary")} title={exactMicros(value)}>{formatRewardMicros(shown, true)}</div>
    <div className="mt-3 grid grid-cols-2 gap-1">
      <Button type="button" size="icon-sm" variant="outline" className="size-10 w-full md:h-7" disabled={locked || value === 0} aria-label={`Decrease ${control.label.toLowerCase()} by 1 reward unit`} onClick={() => onChange(control.key, Math.max(0, value - rewardUnitMicros))}><Minus /></Button>
      <Button type="button" size="icon-sm" variant="outline" className="size-10 w-full md:h-7" disabled={locked} aria-label={`Increase ${control.label.toLowerCase()} by 1 reward unit`} onClick={() => onChange(control.key, value + rewardUnitMicros)}><Plus /></Button>
    </div>
  </article>;
}

function LegendSwatch({ className, label }: { className: string; label: string }) {
  return <span className="flex items-center gap-1.5"><span className={cn("size-3 rounded-sm border border-transparent", className)} />{label}</span>;
}

function AcceptanceIcon({ status }: { status: AcceptanceStatus }) {
  if (status === "verified") return <CheckCircle2 className="size-3.5 shrink-0 text-secondary" />;
  if (status === "invalidated") return <X className="size-3.5 shrink-0 text-destructive" />;
  return <CircleDashed className="size-3.5 shrink-0 text-muted-foreground" />;
}

function impactLabel(tone: ImpactTone): string {
  if (tone === "rewarding") return "reward";
  if (tone === "costly") return "cost";
  return "neutral";
}

function impactSurface(tone: ImpactTone): string {
  if (tone === "rewarding") return "border-secondary/60 bg-secondary/10 text-secondary";
  if (tone === "costly") return "border-destructive/60 bg-destructive/10 text-destructive";
  return "border-tertiary/60 bg-tertiary/10 text-tertiary";
}

function impactBar(tone: ImpactTone): string {
  if (tone === "rewarding") return "bg-secondary";
  if (tone === "costly") return "bg-destructive";
  return "bg-tertiary";
}

function landscapeBucket(bucket: 0 | 1 | 2 | 3 | 4): string {
  return ["bg-destructive/80", "bg-destructive/45", "bg-tertiary/70", "bg-secondary/45", "bg-secondary/75"][bucket]!;
}

function acceptanceTone(status: AcceptanceStatus): string {
  if (status === "verified") return "text-secondary";
  if (status === "invalidated") return "text-destructive";
  return "text-muted-foreground";
}

function penaltySurface(key: string): string {
  if (key === "none") return "border-divider-strong bg-background/70 text-muted-foreground";
  if (key === "transient") return "border-tertiary/35 bg-tertiary/5 text-tertiary";
  if (key === "implementation_defect") return "border-tertiary/60 bg-tertiary/10 text-tertiary";
  if (key === "invalid_plan") return "border-destructive/40 bg-destructive/5 text-destructive";
  return "border-destructive/70 bg-destructive/15 text-destructive";
}
