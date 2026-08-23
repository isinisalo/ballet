import { Plus, Trash2 } from "lucide-react";
import type { DecisionFeatureDefinitionV2, DecisionStateDefinitionV2, ProjectSspDecisionStrategyV2 } from "@shared/api/workspace-contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DecisionModelCatalog({ strategy, locked, onChange }: {
  strategy: ProjectSspDecisionStrategyV2; locked: boolean; onChange: (strategy: ProjectSspDecisionStrategyV2) => void;
}) {
  const updateModel = (patch: Partial<ProjectSspDecisionStrategyV2["model"]>) => onChange({ ...strategy, model: { ...strategy.model, ...patch } });
  const renameFeature = (index: number, next: DecisionFeatureDefinitionV2) => {
    const previous = strategy.model.features[index]!;
    onChange({ ...strategy,
      capabilityModel: { ...strategy.capabilityModel, actions: strategy.capabilityModel.actions.map((action) => ({
        ...action, guards: action.guards.map((guard) => guard.featureId === previous.id ? { ...guard, featureId: next.id } : guard)
      })) },
      model: { ...strategy.model,
        features: strategy.model.features.map((feature, candidate) => candidate === index ? next : feature),
        states: strategy.model.states.map((state) => ({ ...state, values: Object.fromEntries(Object.entries(state.values).map(
          ([key, value]) => [key === previous.id ? next.id : key, value])) }))
      }
    });
  };
  const renameState = (index: number, id: string) => {
    const previous = strategy.model.states[index]!.id;
    updateModel({
      states: strategy.model.states.map((state, candidate) => candidate === index ? { ...state, id } : state),
      stateActions: strategy.model.stateActions.map((row) => ({ ...row,
        stateId: row.stateId === previous ? id : row.stateId,
        successors: row.successors.map((branch) => branch.expectedNextStateId === previous ? { ...branch, expectedNextStateId: id } : branch)
      }))
    });
  };
  return <div className="grid gap-4 xl:grid-cols-2">
    <EditorCard title="State features" description="Finite projection of canonical project, runtime, authorization and evidence facts." addLabel="Feature" locked={locked} onAdd={() => updateModel({ features: [...strategy.model.features, featureDraft(strategy.model.features.length)] })}>
      {strategy.model.features.map((feature, index) => <div key={`${feature.id}:${index}`} className="grid gap-2 rounded border border-divider-strong bg-background/40 p-3">
        <div className="grid grid-cols-[1fr_auto] gap-2"><Input aria-label="Feature ID" disabled={locked} value={feature.id} onChange={(event) => renameFeature(index, { ...feature, id: event.target.value })} /><Button size="icon-sm" variant="ghost" disabled={locked} aria-label={`Remove feature ${feature.id}`} onClick={() => updateModel({ features: strategy.model.features.filter((_, candidate) => candidate !== index) })}><Trash2 /></Button></div>
        <div className="grid gap-2 sm:grid-cols-2"><NativeSelect label="Source" disabled={locked} value={feature.source.kind} values={["runtime", "project_state", "authorization"]} onChange={(kind) => renameFeature(index, { ...feature, source: kind === "runtime" ? { kind: "runtime", fact: "epoch_kind" } : { kind: kind as "project_state" | "authorization", pointer: "" } })} />
          {feature.source.kind === "runtime" ? <NativeSelect label="Runtime fact" disabled={locked} value={feature.source.fact} values={["epoch_kind", "previous_action_id", "previous_action_result", "previous_outcome_id", "action_invocation_count"]} onChange={(fact) => renameFeature(index, { ...feature, source: { kind: "runtime", fact: fact as typeof feature.source.fact } })} />
            : <LabeledInput label="JSON Pointer" disabled={locked} value={feature.source.pointer} onChange={(value) => renameFeature(index, { ...feature, source: { kind: feature.source.kind as "project_state" | "authorization", pointer: value } })} />}</div>
        <div className="grid gap-2 sm:grid-cols-2"><LabeledInput label="Domain, comma-separated" disabled={locked} value={feature.domain.join(", ")} onChange={(value) => renameFeature(index, { ...feature, domain: csv(value) })} /><LabeledInput label="Missing value" disabled={locked} value={feature.missingValue} onChange={(value) => renameFeature(index, { ...feature, missingValue: value })} /></div>
      </div>)}
    </EditorCard>
    <EditorCard title="State catalog" description="Terminal success is the only SSP goal. Failure and blocked retain infinite remaining cost." addLabel="State" locked={locked} onAdd={() => updateModel({ states: [...strategy.model.states, stateDraft(strategy)] })}>
      {strategy.model.states.map((state, index) => <StateRow key={`${state.id}:${index}`} state={state} strategy={strategy} locked={locked} onRename={(id) => renameState(index, id)} onChange={(next) => updateModel({ states: strategy.model.states.map((candidate, candidateIndex) => candidateIndex === index ? next : candidate) })} onRemove={() => updateModel({ states: strategy.model.states.filter((_, candidate) => candidate !== index), stateActions: strategy.model.stateActions.filter(({ stateId }) => stateId !== state.id) })} />)}
    </EditorCard>
  </div>;
}

function StateRow({ state, strategy, locked, onRename, onChange, onRemove }: { state: DecisionStateDefinitionV2; strategy: ProjectSspDecisionStrategyV2; locked: boolean; onRename: (id: string) => void; onChange: (state: DecisionStateDefinitionV2) => void; onRemove: () => void }) {
  return <div className="grid gap-2 rounded border border-divider-strong bg-background/40 p-3">
    <div className="grid grid-cols-[1fr_1fr_auto] gap-2"><Input aria-label="State ID" disabled={locked} value={state.id} onChange={(event) => onRename(event.target.value)} /><select aria-label="Terminal kind" disabled={locked} value={state.terminal ?? "nonterminal"} className="h-8 rounded border border-input bg-background px-2 text-xs" onChange={(event) => onChange({ ...state, terminal: event.target.value === "nonterminal" ? undefined : event.target.value as DecisionStateDefinitionV2["terminal"] })}><option>nonterminal</option><option>success</option><option>failure</option><option>blocked</option></select><Button size="icon-sm" variant="ghost" disabled={locked} aria-label={`Remove state ${state.id}`} onClick={onRemove}><Trash2 /></Button></div>
    {strategy.model.features.map((feature) => <NativeSelect key={feature.id} label={feature.id} disabled={locked} value={state.values[feature.id] ?? ""} values={feature.domain} onChange={(value) => onChange({ ...state, values: { ...state.values, [feature.id]: value } })} />)}
    {state.terminal ? <NativeSelect label="Emitted option outcome" disabled={locked} value={state.emitsOutcomeId ?? ""} values={["", ...strategy.capabilityModel.outcomes.map(({ id }) => id)]} onChange={(emitsOutcomeId) => onChange({ ...state, emitsOutcomeId: emitsOutcomeId || undefined })} /> : null}
  </div>;
}

function EditorCard({ title, description, addLabel, locked, onAdd, children }: { title: string; description: string; addLabel: string; locked: boolean; onAdd: () => void; children: React.ReactNode }) { return <section className="grid content-start gap-3 rounded-lg border border-divider-strong bg-card p-4"><div><h2 className="text-sm font-medium">{title}</h2><p className="text-xs text-muted-foreground">{description}</p></div><div className="grid gap-2">{children}</div><Button size="sm" variant="outline" disabled={locked} onClick={onAdd}><Plus /> {addLabel}</Button></section>; }
const NativeSelect = ({ label, value, values, disabled, onChange }: { label: string; value: string; values: string[]; disabled: boolean; onChange: (value: string) => void }) => <label className="grid gap-1 font-mono text-[0.625rem] uppercase text-muted-foreground">{label}<select value={value} disabled={disabled} className="h-8 min-w-0 rounded border border-input bg-background px-2 font-sans text-xs normal-case text-foreground" onChange={(event) => onChange(event.target.value)}>{!values.includes(value) ? <option value={value}>{value || "Choose…"}</option> : null}{values.map((entry) => <option key={entry} value={entry}>{entry || "None"}</option>)}</select></label>;
const LabeledInput = ({ label, value, disabled, onChange }: { label: string; value: string; disabled: boolean; onChange: (value: string) => void }) => <label className="grid gap-1 font-mono text-[0.625rem] uppercase text-muted-foreground">{label}<Input disabled={disabled} value={value} className="font-sans text-xs normal-case" onChange={(event) => onChange(event.target.value)} /></label>;
const featureDraft = (index: number): DecisionFeatureDefinitionV2 => ({ id: `feature-${index + 1}`, domain: ["unknown"], missingValue: "unknown", source: { kind: "project_state", pointer: "" } });
const stateDraft = (strategy: ProjectSspDecisionStrategyV2): DecisionStateDefinitionV2 => ({ id: `state-${strategy.model.states.length + 1}`, values: Object.fromEntries(strategy.model.features.map((feature) => [feature.id, feature.missingValue])) });
const csv = (value: string) => [...new Set(value.split(",").map((entry) => entry.trim()).filter(Boolean))];
