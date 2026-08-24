import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  CircleDot,
  LockKeyhole,
  Minus,
  Plus,
  Route,
  Sparkles,
  Target
} from "lucide-react";
import type {
  AcceptanceLedgerDefinitionV1,
  DecisionActionModelRowV4,
  PolicyPreviewResultV4,
  ProjectScopedRewardDecisionStrategyV4
} from "@shared/api/workspace-contracts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  exactMicros,
  exactPpm,
  expectedImmediateReward,
  formatProbabilityPpm,
  formatRewardMicros,
  rewardTone,
  rewardUnitMicros,
  transitionImpact,
  type ImpactTone
} from "./decisionModelPresentation";
import {
  decisionCellToneClass,
  PolicyMatrix,
  policyCellKey,
  shortDecisionId,
  type CompiledPolicy,
  type ScopeNode,
  type SelectedCell
} from "./DecisionPolicyMatrix";

export function DecisionModelWorkspace({
  scope,
  strategy,
  nodes,
  acceptance,
  issues,
  preview,
  loading,
  locked,
  onStrategyChange,
  onZoomNode
}: DecisionModelWorkspaceProps) {
  const view = useDecisionWorkspaceState({ scope, strategy, nodes, acceptance, preview, loading });
  const scopeName = scope === "graph" ? "Graph" : "Graph Node";
  const nodeName = scope === "graph" ? "Graph Node" : "Action Node";

  return <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-background p-3 sm:p-4" aria-label={`${scopeName} Decision Model`}>
    <div className="mx-auto grid w-full min-w-0 max-w-[112rem] grid-cols-[minmax(0,1fr)] gap-3">
      <header className="grid gap-3 rounded-lg border border-divider-strong bg-card p-4 xl:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="font-mono text-[0.625rem] uppercase">{scope === "graph" ? "Global policy" : "Local policy"}</Badge>
            <span className={cn("inline-flex items-center gap-1.5 font-mono text-[0.6875rem]", view.compiled?.status === "compiled" ? "text-secondary" : "text-tertiary")}>
              {view.compiled?.status === "compiled" ? <Check className="size-3.5" /> : <AlertTriangle className="size-3.5" />}{view.status}
            </span>
            {locked ? <span className="inline-flex items-center gap-1 font-mono text-[0.6875rem] text-tertiary"><LockKeyhole className="size-3.5" /> Run active</span> : null}
          </div>
          <h2 className="mt-2 font-heading text-lg font-medium">{nodes.length} states × {nodes.length} actions</h2>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
            Rows are the current {nodeName} state. Columns are the next selectable node. Terminal outcomes end the scope and never add matrix rows.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 self-start text-center">
          <Metric label="Modeled" value={`${view.modeledCells}/${view.totalCells}`} tone="primary" />
          <Metric label="Current" value={shortDecisionId(view.currentStateId)} tone="secondary" />
          <Metric label="Initial" value={shortDecisionId(strategy.model.initialStateId)} tone="tertiary" />
        </div>
      </header>

      <PolicyIssues issues={issues} />
      {scope === "graph" && acceptance ? <AcceptanceRail nodes={nodes} acceptance={acceptance} /> : null}

      <section className="min-w-0 overflow-hidden rounded-lg border border-divider-strong bg-card" aria-labelledby="q-matrix-title">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-divider-strong px-4 py-3">
          <div><h3 id="q-matrix-title" className="flex items-center gap-2 font-heading text-sm font-medium"><Route className="size-4 text-primary" /> Q(s,a) policy matrix</h3><p className="mt-1 text-xs text-muted-foreground">Select a cell to inspect its typed outcomes. Column headers zoom into local policies.</p></div>
          <div className="flex flex-wrap gap-3 font-mono text-[0.625rem] text-muted-foreground">
            <Legend tone="rewarding" label="+/reward" /><Legend tone="costly" label="−/cost" />
            <Legend tone="estimated" label="≈ estimate" /><Legend tone="neutral" label="unavailable" dashed />
          </div>
        </div>
        <PolicyMatrix
          nodes={nodes}
          rows={view.rows}
          compiled={view.compiled}
          currentStateId={view.currentStateId}
          selected={view.selected}
          progressByState={view.progressByState}
          strategy={strategy}
          onSelect={view.setSelected}
          onZoomNode={onZoomNode}
        />
      </section>

      <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1.45fr)_minmax(19rem,0.55fr)]">
        <TransitionInspector
          strategy={strategy}
          row={view.selectedRow}
          compiled={view.compiled}
          progressByState={view.progressByState}
        />
        <RewardProfile strategy={strategy} scope={scope} locked={locked} onChange={onStrategyChange} />
      </div>
    </div>
  </main>;
}

type DecisionModelWorkspaceProps = {
  scope: "graph" | "graph_node";
  strategy: ProjectScopedRewardDecisionStrategyV4;
  nodes: ScopeNode[];
  acceptance?: AcceptanceLedgerDefinitionV1;
  issues: Array<{ path: string; message: string }>;
  preview?: PolicyPreviewResultV4;
  loading: boolean;
  locked: boolean;
  onStrategyChange: (strategy: ProjectScopedRewardDecisionStrategyV4) => void;
  onZoomNode?: (nodeId: string) => void;
};

function useDecisionWorkspaceState({
  scope,
  strategy,
  nodes,
  acceptance,
  preview,
  loading
}: Pick<DecisionModelWorkspaceProps, "scope" | "strategy" | "nodes" | "acceptance" | "preview" | "loading">) {
  const compiled = preview?.preview?.compiledPolicy;
  const currentStateId = preview?.preview?.state.stateId ?? strategy.model.initialStateId;
  const rows = useMemo(() => new Map(strategy.model.stateActions.map((row) => [policyCellKey(row.stateId, row.actionId), row])), [strategy]);
  const currentCompiled = compiled?.states.find(({ stateId }) => stateId === currentStateId);
  const [selected, setSelected] = useState<SelectedCell>();
  useEffect(() => {
    const actionId = currentCompiled?.selectedActionId ?? nodes.find(({ id }) => rows.has(policyCellKey(currentStateId, id)))?.id;
    if (actionId) setSelected((value) => value && rows.has(policyCellKey(value.stateId, value.actionId))
      ? value : { stateId: currentStateId, actionId });
  }, [currentCompiled?.selectedActionId, currentStateId, nodes, rows]);
  const progressByState = useMemo(() => progressCatalog(scope, nodes, acceptance), [acceptance, nodes, scope]);
  const selectedRow = selected ? rows.get(policyCellKey(selected.stateId, selected.actionId)) : undefined;
  const modeledCells = strategy.model.stateActions.length;
  const totalCells = nodes.length * nodes.length;
  const status = loading ? "Compiling" : compiled?.status === "compiled" ? "Run ready" : "Run blocked";
  return {
    compiled,
    currentStateId,
    rows,
    selected,
    setSelected,
    progressByState,
    selectedRow,
    modeledCells,
    totalCells,
    status
  };
}

function PolicyIssues({ issues }: Pick<DecisionModelWorkspaceProps, "issues">) {
  if (issues.length === 0) return null;
  return <Alert variant="destructive"><AlertTriangle /><AlertDescription>
    <span className="font-medium">Policy is incomplete.</span> {issues[0]!.message}
    {issues.length > 1 ? <span className="ml-1 text-xs opacity-80">+ {issues.length - 1} more</span> : null}
  </AlertDescription></Alert>;
}

function TransitionInspector({ strategy, row, compiled, progressByState }: {
  strategy: ProjectScopedRewardDecisionStrategyV4;
  row?: DecisionActionModelRowV4;
  compiled?: CompiledPolicy;
  progressByState: Readonly<Record<string, number>>;
}) {
  if (!row) return <section className="grid min-h-64 place-content-center rounded-lg border border-dashed border-divider-strong bg-card p-6 text-center text-sm text-muted-foreground"><Target className="mx-auto mb-2 size-5" />Select a modeled cell to inspect its branches.</section>;
  const compiledState = compiled?.states.find(({ stateId }) => stateId === row.stateId);
  const qMicros = compiledState?.actionValues.find(({ actionId }) => actionId === row.actionId)?.qMicros;
  const estimate = expectedImmediateReward(strategy, row, progressByState);
  return <section className="min-w-0 rounded-lg border border-divider-strong bg-card p-4" aria-labelledby="transition-inspector-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0"><div className="font-mono text-[0.625rem] uppercase text-muted-foreground">Selected transition</div><h3 id="transition-inspector-title" className="mt-1 flex min-w-0 items-center gap-2 font-mono text-sm"><span className="truncate text-primary">{row.stateId}</span><ChevronRight className="size-4 shrink-0 text-muted-foreground" /><span className="truncate text-foreground">{row.actionId}</span></h3></div>
      <div className={cn("rounded-md border px-3 py-2 text-right", decisionCellToneClass(rewardTone(qMicros ?? estimate, qMicros === undefined)))}>
        <div className="font-mono text-[0.55rem] uppercase">{qMicros === undefined ? "Immediate estimate" : "Long-run Q(s,a)"}</div>
        <div className="mt-0.5 font-mono text-lg font-semibold" title={exactMicros(qMicros ?? estimate)}>{qMicros === undefined ? "≈ " : ""}{formatRewardMicros(qMicros ?? estimate, true)}</div>
      </div>
    </div>
    {row.guards.length ? <div className="mt-3 flex flex-wrap gap-1.5">{row.guards.map((guard, index) => <Badge key={`${guard.source.kind}-${guard.source.pointer}-${index}`} variant="outline" className="font-mono text-[0.6rem]">guard · {guard.source.kind}:{guard.source.pointer || "/"}</Badge>)}</div> : <p className="mt-3 font-mono text-[0.625rem] text-muted-foreground">No guard · always admissible when the cell is modeled</p>}
    <div className="mt-3 grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
      {row.successors.map((branch) => {
        const impact = transitionImpact(strategy, row, branch, progressByState);
        return <article key={branch.outcomeId} className={cn("min-w-0 rounded-md border p-3", branchSurface(impact.netRewardMicros))}>
          <div className="flex min-w-0 items-center justify-between gap-2"><span className="truncate font-mono text-xs font-medium" title={branch.outcomeId}>{branch.outcomeId}</span><span className="shrink-0 rounded bg-tertiary/10 px-1.5 py-0.5 font-mono text-[0.6rem] text-tertiary" title={exactPpm(branch.probabilityPpm)}>≈ {formatProbabilityPpm(branch.probabilityPpm)}</span></div>
          <div className="mt-3 flex items-center gap-2"><CircleDot className="size-3.5 shrink-0" /><span className="min-w-0 flex-1 truncate text-xs" title={targetLabel(branch)}>{targetLabel(branch)}</span><span className="font-mono text-sm font-semibold" title={exactMicros(impact.netRewardMicros)}>{formatRewardMicros(impact.netRewardMicros, true)}</span></div>
          <div className="mt-2 flex flex-wrap gap-1 font-mono text-[0.55rem] uppercase opacity-75"><span>{branch.penaltyClass.replaceAll("_", " ")}</span><span>·</span><span>{branch.provenance === "authored_evidence" ? "evidence" : "prior estimate"}</span></div>
        </article>;
      })}
    </div>
    <details className="mt-3 rounded border border-divider-strong bg-background/50 px-3 py-2 text-xs text-muted-foreground">
      <summary className="cursor-pointer font-mono text-[0.625rem] uppercase">Exact model detail</summary>
      <div className="mt-2 grid gap-1 font-mono text-[0.625rem]">
        <span>action cost: {exactMicros(strategy.model.reward.actionCostMicros)}</span>
        <span>discount: {exactPpm(strategy.model.discountPpm)}</span>
        <span>probability total: {exactPpm(row.successors.reduce((sum, branch) => sum + branch.probabilityPpm, 0))}</span>
      </div>
    </details>
  </section>;
}

function RewardProfile({ strategy, scope, locked, onChange }: {
  strategy: ProjectScopedRewardDecisionStrategyV4;
  scope: "graph" | "graph_node";
  locked: boolean;
  onChange: (strategy: ProjectScopedRewardDecisionStrategyV4) => void;
}) {
  const controls = [
    { key: "actionCostMicros" as const, label: "Action cost", sign: -1 },
    { key: "terminalSuccessBonusMicros" as const, label: "Success", sign: 1 },
    ...(scope === "graph" ? [{ key: "acceptanceProgressPotentialScaleMicros" as const, label: "Progress", sign: 1 }] : [])
  ];
  const update = (key: typeof controls[number]["key"], delta: number) => onChange({
    ...strategy,
    model: {
      ...strategy.model,
      reward: { ...strategy.model.reward, [key]: Math.max(0, strategy.model.reward[key] + delta) }
    }
  });
  return <section className="min-w-0 rounded-lg border border-divider-strong bg-card p-4" aria-labelledby="reward-profile-title">
    <div className="flex items-center gap-2"><Sparkles className="size-4 text-secondary" /><h3 id="reward-profile-title" className="font-heading text-sm font-medium">Reward profile</h3></div>
    <p className="mt-1 text-xs text-muted-foreground">Human-scale units; exact micros stay available in details.</p>
    <div className="mt-3 grid gap-2">
      {controls.map((control) => {
        const value = strategy.model.reward[control.key];
        const shown = value * control.sign;
        return <article key={control.key} className={cn("grid grid-cols-[1fr_auto] items-center gap-3 rounded-md border p-3", control.sign > 0 ? "border-secondary/35 bg-secondary/5" : "border-destructive/35 bg-destructive/5")}>
          <div><div className="font-mono text-[0.6rem] uppercase text-muted-foreground">{control.label}</div><div className={cn("mt-1 font-mono text-xl", control.sign > 0 ? "text-secondary" : "text-destructive")} title={exactMicros(value)}>{formatRewardMicros(shown, true)}</div></div>
          <div className="grid grid-cols-2 gap-1"><Button type="button" size="icon-sm" variant="outline" disabled={locked || value === 0} aria-label={`Decrease ${control.label}`} onClick={() => update(control.key, -rewardUnitMicros)}><Minus /></Button><Button type="button" size="icon-sm" variant="outline" disabled={locked} aria-label={`Increase ${control.label}`} onClick={() => update(control.key, rewardUnitMicros)}><Plus /></Button></div>
        </article>;
      })}
    </div>
    <div className="mt-4"><div className="mb-2 font-mono text-[0.6rem] uppercase text-muted-foreground">Outcome cost spectrum</div><div className="flex h-2 overflow-hidden rounded-full border border-divider-strong" aria-label="Outcome cost spectrum">{Object.entries(strategy.model.reward.outcomePenaltyMicros).map(([key, value]) => <span key={key} title={`${key}: ${exactMicros(value)}`} className={cn("flex-1", value === 0 ? "bg-secondary" : value <= 2_000_000 ? "bg-tertiary" : "bg-destructive", value > 10_000_000 && "opacity-90")} />)}</div></div>
  </section>;
}

function AcceptanceRail({ nodes, acceptance }: { nodes: ScopeNode[]; acceptance: AcceptanceLedgerDefinitionV1 }) {
  const obligations = new Map(acceptance.obligations.map((item) => [item.obligationId, item]));
  return <section className="rounded-lg border border-divider-strong bg-card p-4" aria-labelledby="acceptance-rail-title">
    <div className="flex flex-wrap items-baseline justify-between gap-2"><div><h3 id="acceptance-rail-title" className="font-heading text-sm font-medium">Acceptance is a gate, not a policy state</h3><p className="mt-1 text-xs text-muted-foreground">Only explicit bindings contribute Graph progress. Adding a node does not create a ledger obligation.</p></div><span className="font-mono text-[0.625rem] text-muted-foreground">{acceptance.obligations.length} ledger obligations</span></div>
    <div className="mt-3 flex min-w-0 items-stretch overflow-x-auto pb-1">
      {nodes.map((node, index) => {
        const obligation = node.acceptanceObligationId ? obligations.get(node.acceptanceObligationId) : undefined;
        return <div key={node.id} className="flex min-w-[9rem] flex-1 items-center">
          <div className={cn("grid min-h-20 min-w-0 flex-1 content-center rounded-md border px-3", obligation ? "border-secondary/40 bg-secondary/5" : "border-dashed border-divider-strong bg-background/50")}>
            <span className="truncate font-mono text-xs text-foreground">{shortDecisionId(node.id)}</span><span className={cn("mt-1 truncate font-mono text-[0.58rem]", obligation ? "text-secondary" : "text-muted-foreground")} title={obligation?.description}>{obligation ? `${obligation.obligationId} · w${obligation.weight}` : "unbound · +0 progress"}</span>
          </div>
          {index < nodes.length - 1 ? <ChevronRight className="mx-1 size-4 shrink-0 text-divider-strong" /> : null}
        </div>;
      })}
    </div>
  </section>;
}

function Metric({ label, value, tone }: { label: string; value: string; tone: "primary" | "secondary" | "tertiary" }) {
  return <div className={cn("min-w-24 rounded-md border px-3 py-2", tone === "primary" ? "border-primary/35 bg-primary/5" : tone === "secondary" ? "border-secondary/35 bg-secondary/5" : "border-tertiary/35 bg-tertiary/5")}><div className="font-mono text-[0.55rem] uppercase text-muted-foreground">{label}</div><div className={cn("mt-1 truncate font-mono text-sm", tone === "primary" ? "text-primary" : tone === "secondary" ? "text-secondary" : "text-tertiary")} title={value}>{value}</div></div>;
}

function Legend({ tone, label, dashed = false }: { tone: ImpactTone; label: string; dashed?: boolean }) {
  return <span className="inline-flex items-center gap-1.5"><span className={cn("size-3 rounded-sm border", dashed ? "border-dashed border-divider-strong bg-background" : decisionCellToneClass(tone))} />{label}</span>;
}

function progressCatalog(scope: "graph" | "graph_node", nodes: ScopeNode[], acceptance?: AcceptanceLedgerDefinitionV1) {
  if (scope === "graph_node" || !acceptance) return Object.fromEntries(nodes.map(({ id }) => [id, 0]));
  const weights = new Map(acceptance.obligations.map(({ obligationId, weight }) => [obligationId, weight]));
  const bound = nodes.map(({ acceptanceObligationId }) => acceptanceObligationId ? weights.get(acceptanceObligationId) ?? 0 : 0);
  const total = bound.reduce((sum, value) => sum + value, 0);
  let completed = 0;
  return Object.fromEntries(nodes.map((node, index) => {
    const value = total === 0 ? 0 : Math.round(completed * 1_000_000 / total);
    completed += bound[index] ?? 0;
    return [node.id, value];
  }));
}

function branchSurface(value: number): string {
  return value > 0 ? "border-secondary/40 bg-secondary/5 text-secondary"
    : value < 0 ? "border-destructive/40 bg-destructive/5 text-destructive"
      : "border-divider-strong bg-background/60 text-muted-foreground";
}
function targetLabel(branch: DecisionActionModelRowV4["successors"][number]): string {
  return branch.target.kind === "state" ? `state · ${branch.target.stateId}`
    : `${branch.target.terminal}${branch.target.emitOutcomeId ? ` · emit ${branch.target.emitOutcomeId}` : ""}`;
}
