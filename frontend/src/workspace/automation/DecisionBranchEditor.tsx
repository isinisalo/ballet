import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { DecisionOptionModelRowV2, DecisionStateDefinitionV2 } from "@shared/api/workspace-contracts";
import { Button } from "@/components/ui/button";
import { DecisionScaledInput } from "./DecisionScaledInput";
import { percentageTextToPpm, ppmToPercentageText } from "./decisionModelView";

export function DecisionBranchEditor({ row, outcomes, states, locked, onChange }: {
  row: DecisionOptionModelRowV2;
  outcomes: string[];
  states: DecisionStateDefinitionV2[];
  locked: boolean;
  onChange: (row: DecisionOptionModelRowV2) => void;
}) {
  const [adding, setAdding] = useState(false);
  return <div className="grid gap-3">
    {row.successors.map((branch, index) => <div key={`${branch.outcomeId}:${branch.expectedNextStateId}:${index}`} className="grid gap-2 rounded border border-divider-strong bg-background/40 p-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><Select label="Outcome" value={branch.outcomeId} values={outcomes} disabled={locked} onChange={(outcomeId) => onChange(replaceBranch(row, index, { ...branch, outcomeId }))} /><Select label="Expected next state" value={branch.expectedNextStateId} values={states.map(({ id }) => id)} disabled={locked} onChange={(expectedNextStateId) => onChange(replaceBranch(row, index, { ...branch, expectedNextStateId }))} /><Button className="self-end" size="icon-sm" variant="ghost" disabled={locked || row.successors.length === 1} aria-label={`Remove ${branch.outcomeId} branch`} onClick={() => onChange({ ...row, successors: row.successors.filter((_, candidate) => candidate !== index) })}><Trash2 /></Button></div>
      <DecisionScaledInput label="Probability" suffix="%" value={branch.probabilityPpm} disabled={locked} format={ppmToPercentageText} parse={(value) => { const ppm = percentageTextToPpm(value); return ppm && ppm > 0 ? ppm : undefined; }} onChange={(probabilityPpm) => onChange(replaceBranch(row, index, { ...branch, probabilityPpm }))} help={`${branch.probabilityPpm.toLocaleString()} ppm`} />
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-container-high" aria-hidden="true"><div className="h-full bg-primary" style={{ width: `${Math.min(100, branch.probabilityPpm / 10_000)}%` }} /></div>
    </div>)}
    {adding ? <BranchCreator outcomes={outcomes} states={states} onCancel={() => setAdding(false)} onAdd={(branch) => { onChange({ ...row, successors: [...row.successors, branch] }); setAdding(false); }} /> : <Button size="sm" variant="outline" disabled={locked} onClick={() => setAdding(true)}><Plus /> Add outcome branch</Button>}
  </div>;
}

function BranchCreator({ outcomes, states, onCancel, onAdd }: { outcomes: string[]; states: DecisionStateDefinitionV2[]; onCancel: () => void; onAdd: (branch: DecisionOptionModelRowV2["successors"][number]) => void }) {
  const [outcomeId, setOutcomeId] = useState("");
  const [expectedNextStateId, setNextStateId] = useState("");
  const [probability, setProbability] = useState("");
  const probabilityPpm = percentageTextToPpm(probability);
  const valid = Boolean(outcomeId && expectedNextStateId && probabilityPpm && probabilityPpm > 0);
  return <div className="grid gap-2 rounded border border-dashed border-primary/50 p-3"><div className="text-xs font-medium">New outcome branch</div><Select label="Outcome" value={outcomeId} values={outcomes} disabled={false} onChange={setOutcomeId} /><Select label="Expected next state" value={expectedNextStateId} values={states.map(({ id }) => id)} disabled={false} onChange={setNextStateId} /><label className="grid gap-1 font-mono text-[0.625rem] uppercase text-muted-foreground">Probability, %<input className="h-8 rounded border border-input bg-background px-2 font-sans text-xs normal-case text-foreground" inputMode="decimal" value={probability} onChange={(event) => setProbability(event.target.value)} /></label>{probability && !probabilityPpm ? <p className="text-xs text-destructive">Use a value greater than 0 with at most four decimal places.</p> : null}<div className="flex justify-end gap-2"><Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button><Button size="sm" disabled={!valid} onClick={() => onAdd({ outcomeId, expectedNextStateId, probabilityPpm: probabilityPpm! })}>Add branch</Button></div></div>;
}

function Select({ label, value, values, disabled, onChange }: { label: string; value: string; values: string[]; disabled: boolean; onChange: (value: string) => void }) {
  return <label className="grid gap-1 font-mono text-[0.625rem] uppercase text-muted-foreground">{label}<select value={value} disabled={disabled} className="h-8 min-w-0 rounded border border-input bg-background px-2 font-sans text-xs normal-case text-foreground" onChange={(event) => onChange(event.target.value)}><option value="">Choose…</option>{values.map((entry) => <option key={entry}>{entry}</option>)}</select></label>;
}

const replaceBranch = (row: DecisionOptionModelRowV2, index: number, branch: DecisionOptionModelRowV2["successors"][number]): DecisionOptionModelRowV2 => ({ ...row, successors: row.successors.map((candidate, candidateIndex) => candidateIndex === index ? branch : candidate) });
