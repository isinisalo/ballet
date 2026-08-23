import { useEffect, useMemo, useState } from "react";
import { GitBranch, ShieldAlert } from "lucide-react";
import type {
  PolicyPreviewResultV2, ProjectGraphDecisionStrategyV2, ProjectGraphNodeDecisionStrategyV2,
  ProjectIntrinsicOutcome, ProjectRepairNode
} from "@shared/api/workspace-contracts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { OperationalStatus } from "@/components/shared/workspace-ui";
import { DecisionAdvancedPanel } from "./DecisionAdvancedPanel";
import { DecisionMatrix, type DecisionSelection } from "./DecisionMatrix";
import { DecisionModelHealth } from "./DecisionModelHealth";
import { DecisionPreview } from "./DecisionPreview";
import { DecisionRuleInspector } from "./DecisionRuleInspector";
import { decisionActionsFromContracts, findDecisionCell, projectDecisionMatrix } from "./decisionModelView";
import { createSspDraft } from "./decisionModelDraft";

type Strategy = ProjectGraphDecisionStrategyV2 | ProjectGraphNodeDecisionStrategyV2;
type ActionContract = { id: string; description?: string; outcomes: ProjectIntrinsicOutcome[] };

export function DecisionModelWorkspace({ scopeKey, strategy, actionContracts, repair, issues, preview, loading, locked, onStrategyChange, onRepairChange }: {
  scopeKey: string;
  strategy: Strategy;
  actionContracts: ActionContract[];
  repair?: ProjectRepairNode;
  issues: Array<{ path: string; message: string }>;
  preview?: PolicyPreviewResultV2;
  loading: boolean;
  locked: boolean;
  onStrategyChange: (strategy: Strategy) => void;
  onRepairChange: (repair: ProjectRepairNode) => void;
}) {
  const [selection, setSelection] = useState<DecisionSelection>();
  useEffect(() => setSelection(undefined), [scopeKey]);
  if (strategy.kind === "agent_v1") return <AgentStrategy scopeKey={scopeKey} actionContracts={actionContracts} locked={locked} onStrategyChange={onStrategyChange} />;
  return <SspWorkspace strategy={strategy} actionContracts={actionContracts} repair={repair} issues={issues} preview={preview} loading={loading} locked={locked} selection={selection} onSelectionChange={setSelection} onStrategyChange={onStrategyChange} onRepairChange={onRepairChange} />;
}

function SspWorkspace({ strategy, actionContracts, repair, issues, preview, loading, locked, selection, onSelectionChange, onStrategyChange, onRepairChange }: {
  strategy: Extract<Strategy, { kind: "ssp_v2" }>;
  actionContracts: ActionContract[];
  repair?: ProjectRepairNode;
  issues: Array<{ path: string; message: string }>;
  preview?: PolicyPreviewResultV2;
  loading: boolean;
  locked: boolean;
  selection?: DecisionSelection;
  onSelectionChange: (selection?: DecisionSelection) => void;
  onStrategyChange: (strategy: Strategy) => void;
  onRepairChange: (repair: ProjectRepairNode) => void;
}) {
  const actions = useMemo(() => decisionActionsFromContracts(actionContracts), [actionContracts]);
  const matrix = useMemo(() => projectDecisionMatrix({ states: strategy.model.states, actions, stateActions: strategy.model.stateActions, capabilityActions: strategy.capabilityModel.actions }), [actions, strategy.capabilityModel.actions, strategy.model.stateActions, strategy.model.states]);
  const cell = selection ? findDecisionCell(matrix, selection.stateId, selection.actionId) : undefined;
  useEffect(() => { if (selection && !cell) onSelectionChange(undefined); }, [cell, onSelectionChange, selection]);
  const ready = issues.length === 0 && preview?.preview?.solverStatus === "converged";
  const updateRows = (rows: typeof strategy.model.stateActions) => onStrategyChange({ ...strategy, model: { ...strategy.model, stateActions: rows } });
  const outcomes = cell ? actionContracts.find(({ id }) => id === cell.actionId)?.outcomes.map(({ outcomeId }) => outcomeId) ?? [] : [];
  return <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto"><div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 p-4">
    <section className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-divider-strong bg-card p-4"><div className="min-w-0"><h2 className="truncate font-heading text-base font-medium" title={strategy.description}>{strategy.description}</h2><p className="truncate font-mono text-[0.65rem] text-tertiary" title={strategy.id}>{strategy.id} · ssp_v2</p></div><OperationalStatus label={ready ? "Compiled" : loading ? "Compiling" : "Draft — Run blocked"} tone={ready ? "healthy" : loading ? "attention" : "danger"} />{locked ? <Alert className="basis-full"><AlertDescription>This scope is locked while an active Run uses its immutable snapshot.</AlertDescription></Alert> : null}</section>
    <DecisionPreview actions={actions} result={preview} loading={loading} />
    <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]"><DecisionMatrix matrix={matrix} selection={selection} onSelect={onSelectionChange} /><DecisionRuleInspector cell={cell} preview={preview?.preview} outcomes={outcomes} states={strategy.model.states} issues={issues} locked={locked} onClose={() => onSelectionChange(undefined)} onChange={(row) => { if (cell?.rowIndex !== undefined) updateRows(strategy.model.stateActions.map((candidate, index) => index === cell.rowIndex ? row : candidate)); }} onAdd={(row) => updateRows([...strategy.model.stateActions, row])} onRemove={() => { if (cell?.rowIndex !== undefined) updateRows(strategy.model.stateActions.filter((_, index) => index !== cell.rowIndex)); }} /></div>
    <DecisionModelHealth strategy={strategy} actions={actions} issues={issues} preview={preview?.preview} />
    <DecisionAdvancedPanel strategy={strategy} actionIds={actions.map(({ id }) => id)} repair={repair} preview={preview?.preview} locked={locked} onStrategyChange={onStrategyChange} onRepairChange={onRepairChange} />
  </div></div>;
}

function AgentStrategy({ scopeKey, actionContracts, locked, onStrategyChange }: {
  scopeKey: string;
  actionContracts: ActionContract[];
  locked: boolean;
  onStrategyChange: (strategy: Strategy) => void;
}) {
  return <div className="grid flex-1 place-items-center overflow-auto p-4 sm:p-8"><section className="grid max-w-2xl gap-4 rounded-lg border border-divider-strong bg-card p-6"><div className="flex items-start gap-3"><GitBranch className="mt-0.5 size-5 text-primary" /><div><h2 className="font-heading text-lg font-medium">Local agent routing is active</h2><p className="mt-1 text-sm text-muted-foreground">Port A keeps agent_v1 as an explicit alternative. There is no runtime fallback between strategies.</p></div></div><Alert><ShieldAlert /><AlertDescription>Creating an SSP draft replaces this scope’s agent routing configuration. Outcome IDs can be scaffolded, but no transition probabilities or costs will be invented.</AlertDescription></Alert><Button disabled={locked} onClick={() => onStrategyChange(createSspDraft(scopeKey, actionContracts))}>Create outcome-aware SSP v2 draft</Button></section></div>;
}
