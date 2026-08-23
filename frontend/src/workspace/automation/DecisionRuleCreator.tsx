import { useState } from "react";
import type { DecisionOptionModelRowV2, DecisionStateDefinitionV2 } from "@shared/api/workspace-contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { costTextToMicros, percentageTextToPpm } from "./decisionModelView";

export function DecisionRuleCreator({ stateId, actionId, outcomes, states, locked, onAdd }: {
  stateId: string;
  actionId: string;
  outcomes: string[];
  states: DecisionStateDefinitionV2[];
  locked: boolean;
  onAdd: (row: DecisionOptionModelRowV2) => void;
}) {
  const [cost, setCost] = useState("");
  const [outcomeId, setOutcomeId] = useState("");
  const [expectedNextStateId, setNextStateId] = useState("");
  const [probability, setProbability] = useState("");
  const expectedCostMicros = costTextToMicros(cost);
  const probabilityPpm = percentageTextToPpm(probability);
  const valid = Boolean(expectedCostMicros && outcomeId && expectedNextStateId && probabilityPpm && probabilityPpm > 0);
  return <div className="grid gap-3">
    <p className="rounded border border-dashed border-primary/50 bg-primary/5 p-3 text-xs text-muted-foreground">This state/action rule is not configured. Enter every value explicitly; Ballet will not invent a cost or probability.</p>
    <Field label="Configured cost, cost units" value={cost} onChange={setCost} invalid={Boolean(cost && !expectedCostMicros)} />
    <Select label="Outcome" value={outcomeId} values={outcomes} onChange={setOutcomeId} />
    <Select label="Expected next state" value={expectedNextStateId} values={states.map(({ id }) => id)} onChange={setNextStateId} />
    <Field label="Probability, %" value={probability} onChange={setProbability} invalid={Boolean(probability && (!probabilityPpm || probabilityPpm <= 0))} />
    <Button disabled={locked || !valid} onClick={() => onAdd({ stateId, actionId, expectedCostMicros: expectedCostMicros!, successors: [{ outcomeId, expectedNextStateId, probabilityPpm: probabilityPpm! }] })}>Add configured rule</Button>
  </div>;
}

function Field({ label, value, invalid, onChange }: { label: string; value: string; invalid: boolean; onChange: (value: string) => void }) {
  return <label className="grid gap-1 font-mono text-[0.625rem] uppercase text-muted-foreground">{label}<Input inputMode="decimal" aria-invalid={invalid} value={value} onChange={(event) => onChange(event.target.value)} />{invalid ? <span className="font-sans text-[0.6875rem] normal-case text-destructive">Enter an exact positive value with no more than {label.includes("Probability") ? "four" : "six"} decimal places.</span> : null}</label>;
}

function Select({ label, value, values, onChange }: { label: string; value: string; values: string[]; onChange: (value: string) => void }) {
  return <label className="grid gap-1 font-mono text-[0.625rem] uppercase text-muted-foreground">{label}<select value={value} className="h-8 rounded border border-input bg-background px-2 font-sans text-xs normal-case text-foreground" onChange={(event) => onChange(event.target.value)}><option value="">Choose…</option>{values.map((entry) => <option key={entry}>{entry}</option>)}</select></label>;
}
