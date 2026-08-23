import { GitBranch, ShieldAlert } from "lucide-react";
import type {
  PolicyPreviewResultV2, ProjectGraphDecisionStrategyV2, ProjectGraphNodeDecisionStrategyV2,
  ProjectIntrinsicOutcome, ProjectRepairNode
} from "@shared/api/workspace-contracts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { OperationalStatus } from "@/components/shared/workspace-ui";
import { PolicyProjectionView, formatCost } from "../policy/PolicyProjectionView";
import { DecisionCapabilityEditor } from "./DecisionCapabilityEditor";
import { DecisionModelCatalog } from "./DecisionModelCatalog";
import { DecisionModelSettings } from "./DecisionModelSettings";
import { DecisionTransitionEditor } from "./DecisionTransitionEditor";
import { createSspDraft } from "./decisionModelDraft";

type Strategy = ProjectGraphDecisionStrategyV2 | ProjectGraphNodeDecisionStrategyV2;
type ActionContract = { id: string; outcomes: ProjectIntrinsicOutcome[] };

export function DecisionModelWorkspace({ scopeKey, strategy, actionContracts, repair, issues, preview, loading, locked, onStrategyChange, onRepairChange }: {
  scopeKey: string; strategy: Strategy; actionContracts: ActionContract[]; repair?: ProjectRepairNode;
  issues: Array<{ path: string; message: string }>; preview?: PolicyPreviewResultV2; loading: boolean; locked: boolean;
  onStrategyChange: (strategy: Strategy) => void; onRepairChange: (repair: ProjectRepairNode) => void;
}) {
  if (strategy.kind === "agent_v1") return <div className="grid flex-1 place-items-center overflow-auto p-4 sm:p-8"><section className="grid max-w-2xl gap-4 rounded-lg border border-divider-strong bg-card p-6">
    <div className="flex items-start gap-3"><GitBranch className="mt-0.5 size-5 text-primary" /><div><h2 className="font-heading text-lg font-medium">Local agent routing is active</h2><p className="mt-1 text-sm text-muted-foreground">Port A keeps agent_v1 as an explicit alternative. There is no runtime fallback between strategies.</p></div></div>
    <Alert><ShieldAlert /><AlertDescription>Creating an SSP draft replaces this scope’s agent routing configuration. Outcome IDs can be scaffolded, but no transition probabilities or costs will be invented.</AlertDescription></Alert>
    <Button disabled={locked} onClick={() => onStrategyChange(createSspDraft(scopeKey, actionContracts))}>Create outcome-aware SSP v2 draft</Button>
  </section></div>;
  const actionIds = actionContracts.map(({ id }) => id);
  const actionOutcomes = Object.fromEntries(actionContracts.map(({ id, outcomes }) => [id, outcomes.map(({ outcomeId }) => outcomeId)]));
  const ready = issues.length === 0 && preview?.preview?.solverStatus === "converged";
  return <div className="min-h-0 flex-1 overflow-auto">
    <div className="grid gap-4 p-4">
      <section className="grid gap-3 rounded-lg border border-divider-strong bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-heading text-base font-medium">{strategy.description}</h2><p className="font-mono text-[0.65rem] text-tertiary">{strategy.id} · ssp_v2 · scoped P(o,s′|s,a)</p></div><OperationalStatus label={ready ? "Compiled" : loading ? "Compiling" : "Draft — Run blocked"} tone={ready ? "healthy" : loading ? "attention" : "danger"} /></div>
        {locked ? <Alert><AlertDescription>This scope is locked while an active Run uses its immutable snapshot.</AlertDescription></Alert> : null}
        {issues.length ? <Alert variant="destructive"><AlertDescription><strong>{issues.length} readiness issue{issues.length === 1 ? "" : "s"}</strong><ul className="mt-2 max-h-40 list-disc overflow-auto pl-4 text-xs">{issues.map((issue) => <li key={`${issue.path}:${issue.message}`}><span className="font-mono">{issue.path}</span> — {issue.message}</li>)}</ul></AlertDescription></Alert> : null}
      </section>
      <DecisionCapabilityEditor strategy={strategy} actionIds={actionIds} locked={locked} onChange={(next) => onStrategyChange(next)} />
      <DecisionModelCatalog strategy={strategy} locked={locked} onChange={(next) => onStrategyChange(next)} />
      <DecisionTransitionEditor strategy={strategy} actionOutcomes={actionOutcomes} locked={locked} onChange={(next) => onStrategyChange(next)} />
      <DecisionModelSettings strategy={strategy} repair={repair} locked={locked} onStrategyChange={(next) => onStrategyChange(next)} onRepairChange={onRepairChange} />
      <PolicyPreview result={preview} loading={loading} />
    </div>
  </div>;
}

function PolicyPreview({ result, loading }: { result?: PolicyPreviewResultV2; loading: boolean }) {
  const preview = result?.preview;
  return <section className="grid gap-3 rounded-lg border border-divider-strong bg-card p-4"><div><h2 className="text-sm font-medium">Policy Projection</h2><p className="text-xs text-muted-foreground">Derived preview from this draft. Most Likely Rollout compares full bounded trajectories by cumulative probability.</p></div>{loading ? <p className="text-xs text-muted-foreground">Compiling policy projection…</p> : null}{preview ? <><div className="grid gap-2 sm:grid-cols-4"><Evidence label="Current State" value={preview.state?.stateId ?? "invalid"} /><Evidence label="Current Decision" value={preview.selectedActionId ?? "none"} /><Evidence label="Solver" value={preview.solverStatus} /><Evidence label="V(s)" value={preview.expectedRemainingCostMicros === undefined ? "unavailable" : formatCost(preview.expectedRemainingCostMicros)} /></div>{preview.projection ? <PolicyProjectionView projection={preview.projection} /> : null}</> : <p className="rounded border border-dashed border-divider-strong p-4 text-xs text-muted-foreground">Projection becomes available when the scoped model compiles.</p>}</section>;
}
const Evidence = ({ label, value }: { label: string; value: string }) => <div className="rounded border border-divider-strong bg-background/40 p-3"><div className="font-mono text-[0.625rem] uppercase text-muted-foreground">{label}</div><div className="mt-1 truncate font-mono text-xs">{value}</div></div>;
