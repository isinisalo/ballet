import type {
  PolicyPreviewResultV3,
  ProjectRewardDecisionStrategyV3,
  RewardModelV3
} from "@shared/api/workspace-contracts";
import { OperationalStatus } from "@/components/shared/workspace-ui";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function DecisionModelWorkspace({ strategy, issues, preview, loading, locked, onStrategyChange }: {
  strategy: ProjectRewardDecisionStrategyV3;
  issues: Array<{ path: string; message: string }>;
  preview?: PolicyPreviewResultV3;
  loading: boolean;
  locked: boolean;
  onStrategyChange: (strategy: ProjectRewardDecisionStrategyV3) => void;
}) {
  const compiled = preview?.preview?.compiledPolicy;
  const ready = compiled?.status === "compiled" && issues.length === 0;
  const setReward = (key: keyof Omit<RewardModelV3, "outcomePenaltyMicros">, value: number) =>
    onStrategyChange({ ...strategy, model: { ...strategy.model, reward: { ...strategy.model.reward, [key]: value } } });
  return <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4"><div className="grid min-w-0 gap-4">
    <section className="flex min-w-0 flex-wrap items-start justify-between gap-3 rounded-lg border border-divider-strong bg-card p-4">
      <div className="min-w-0 flex-1"><h2 className="break-words font-heading text-base font-medium">{strategy.description}</h2><p className="font-mono text-[0.65rem] text-tertiary">{strategy.id} · Reward-MDP v3 · γ {(strategy.model.discountPpm / 1_000_000).toFixed(2)}</p></div>
      <OperationalStatus label={ready ? "Compiled" : loading ? "Compiling" : "Run blocked"} tone={ready ? "healthy" : loading ? "attention" : "danger"} />
      {locked ? <Alert className="basis-full"><AlertDescription>The immutable Run snapshot locks this model.</AlertDescription></Alert> : null}
      {issues.length ? <Alert variant="destructive" className="basis-full"><AlertDescription>{issues[0]!.message}</AlertDescription></Alert> : null}
    </section>
    <section className="min-w-0 rounded-lg border border-divider-strong bg-card p-4"><h3 className="font-heading text-sm font-medium">Reward contract · integer micros</h3><div className="mt-3 grid gap-3 sm:grid-cols-3">
      <RewardInput label="Action cost" value={strategy.model.reward.actionCostMicros} disabled={locked} onChange={(value) => setReward("actionCostMicros", value)} />
      <RewardInput label="Completion bonus" value={strategy.model.reward.completionBonusMicros} disabled={locked} onChange={(value) => setReward("completionBonusMicros", value)} />
      <RewardInput label="Progress potential scale" value={strategy.model.reward.progressPotentialScaleMicros} disabled={locked} onChange={(value) => setReward("progressPotentialScaleMicros", value)} />
    </div><div className="mt-3 grid gap-2 sm:grid-cols-5">{Object.entries(strategy.model.reward.outcomePenaltyMicros).map(([key, value]) => <div key={key} className="rounded border border-divider-subtle p-2"><div className="font-mono text-[0.6rem] uppercase text-tertiary">{key.replaceAll("_", " ")}</div><div className="mt-1 font-mono text-xs">−{value.toLocaleString()}</div></div>)}</div></section>
    <section className="min-w-0 rounded-lg border border-divider-strong bg-card p-4"><h3 className="font-heading text-sm font-medium">Acceptance ledger contract</h3><Table><TableHeader><TableRow><TableHead>Obligation</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Weight</TableHead></TableRow></TableHeader><TableBody>{strategy.model.acceptance.obligations.map((entry) => <TableRow key={entry.obligationId}><TableCell className="font-mono text-xs">{entry.obligationId}</TableCell><TableCell>{entry.description}</TableCell><TableCell className="text-right font-mono">{entry.weight}</TableCell></TableRow>)}</TableBody></Table></section>
    <section className="min-w-0 rounded-lg border border-divider-strong bg-card p-4"><h3 className="font-heading text-sm font-medium">Transition branches</h3><Table><TableHeader><TableRow><TableHead>State / action</TableHead><TableHead>Outcome → state</TableHead><TableHead className="text-right">Probability</TableHead><TableHead>Provenance</TableHead></TableRow></TableHeader><TableBody>{strategy.model.stateActions.flatMap((row) => row.successors.map((branch) => <TableRow key={`${row.stateId}:${row.actionId}:${branch.outcomeId}:${branch.nextStateId}`}><TableCell className="font-mono text-xs">{row.stateId} / {row.actionId}</TableCell><TableCell className="font-mono text-xs">{branch.outcomeId} → {branch.nextStateId}</TableCell><TableCell className="text-right font-mono">{branch.probabilityPpm.toLocaleString()} ppm</TableCell><TableCell><span className={branch.provenance === "default_prior" ? "text-warning" : "text-primary"}>{branch.provenance}</span></TableCell></TableRow>))}</TableBody></Table></section>
    <section className="min-w-0 rounded-lg border border-divider-strong bg-card p-4"><h3 className="font-heading text-sm font-medium">Compiled Q / V policy</h3>{compiled?.states.length ? <Table><TableHeader><TableRow><TableHead>State</TableHead><TableHead>Selected action</TableHead><TableHead className="text-right">V micros</TableHead><TableHead>Q values</TableHead></TableRow></TableHeader><TableBody>{compiled.states.map((state) => <TableRow key={state.stateId}><TableCell className="font-mono text-xs">{state.stateId}</TableCell><TableCell className="font-mono text-xs text-primary">{state.selectedActionId}</TableCell><TableCell className="text-right font-mono">{state.valueMicros.toLocaleString()}</TableCell><TableCell className="font-mono text-[0.65rem]">{state.actionValues.map(({ actionId, qMicros }) => `${actionId}=${qMicros}`).join(" · ")}</TableCell></TableRow>)}</TableBody></Table> : <p className="mt-3 text-sm text-muted-foreground">No compiled policy is available.</p>}</section>
  </div></div>;
}

function RewardInput({ label, value, disabled, onChange }: { label: string; value: number; disabled: boolean; onChange: (value: number) => void }) {
  return <label className="grid gap-1 font-mono text-[0.65rem] uppercase text-tertiary">{label}<Input type="number" min={0} step={1} value={value} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} className="font-mono text-foreground" /></label>;
}
