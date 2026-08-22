import type {
  DecisionFeatureDefinitionV1,
  DecisionOptionModelRowV1,
  ProjectSspGraphStrategyV1
} from "@shared/api/workspace-contracts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
import type { ReactNode } from "react";

export function DecisionModelEditor({ open, onOpenChange, strategy, graphNodeIds, issues, locked, onChange }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  strategy: ProjectSspGraphStrategyV1;
  graphNodeIds: string[];
  issues: Array<{ path: string; message: string }>;
  locked: boolean;
  onChange: (strategy: ProjectSspGraphStrategyV1) => void;
}) {
  const model = strategy.model;
  const updateModel = (patch: Partial<typeof model>) => onChange({ ...strategy, model: { ...model, ...patch } });
  const updateFeature = (index: number, next: DecisionFeatureDefinitionV1) => {
    const previous = model.features[index]!;
    updateModel({
      features: model.features.map((feature, candidate) => candidate === index ? next : feature),
      states: previous.id === next.id ? model.states : model.states.map((state) => ({
        ...state,
        values: Object.fromEntries(Object.entries(state.values).map(([key, value]) => [key === previous.id ? next.id : key, value]))
      })),
      stateActions: model.stateActions,
    });
    if (previous.id !== next.id) onChange({
      ...strategy,
      capabilityGraph: { ...strategy.capabilityGraph, actions: strategy.capabilityGraph.actions.map((action) => ({
        ...action, guards: action.guards.map((guard) => guard.featureId === previous.id ? { ...guard, featureId: next.id } : guard)
      })) },
      model: {
        ...model,
        features: model.features.map((feature, candidate) => candidate === index ? next : feature),
        states: model.states.map((state) => ({
          ...state,
          values: Object.fromEntries(Object.entries(state.values).map(([key, value]) => [key === previous.id ? next.id : key, value]))
        }))
      }
    });
  };
  const renameState = (index: number, id: string) => {
    const previous = model.states[index]!.id;
    updateModel({
      states: model.states.map((state, candidate) => candidate === index ? { ...state, id } : state),
      stateActions: model.stateActions.map((row) => ({
        ...row,
        stateId: row.stateId === previous ? id : row.stateId,
        successors: row.successors.map((successor) => successor.nextStateId === previous ? { ...successor, nextStateId: id } : successor)
      }))
    });
  };
  const setCapabilityGuards = (graphNodeId: string, featureId: string, allowedValues: string[]) => onChange({
    ...strategy,
    capabilityGraph: {
      ...strategy.capabilityGraph,
      actions: strategy.capabilityGraph.actions.map((action) => action.graphNodeId !== graphNodeId ? action : {
        ...action,
        guards: allowedValues.length
          ? [...action.guards.filter((guard) => guard.featureId !== featureId), { featureId, allowedValues }]
          : action.guards.filter((guard) => guard.featureId !== featureId)
      })
    }
  });
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="h-[min(90svh,54rem)] max-w-[calc(100%-1rem)] grid-rows-[auto_minmax(0,1fr)_auto] p-0 sm:max-w-5xl">
    <DialogHeader className="border-b border-divider-strong p-4 pr-12">
      <DialogTitle>Decision Model</DialogTitle>
      <DialogDescription>Repository-backed SSP authoring. Configured probabilities and costs are priors, not learned telemetry.</DialogDescription>
    </DialogHeader>
    <div className="min-h-0 overflow-auto p-4">
      {locked ? <Alert className="mb-4"><AlertDescription>Locked while an active Run uses the current Graph.</AlertDescription></Alert> : null}
      {issues.length ? <Alert variant="destructive" className="mb-4"><AlertDescription><strong>{issues.length} model issue{issues.length === 1 ? "" : "s"}</strong><ul className="mt-2 list-disc pl-4">{issues.slice(0, 8).map((issue) => <li key={`${issue.path}:${issue.message}`}><span className="font-mono">{issue.path}</span> — {issue.message}</li>)}</ul>{issues.length > 8 ? <div className="mt-2">{issues.length - 8} more issues remain.</div> : null}</AlertDescription></Alert> : null}

      <Section title="Orchestration strategy" description="Finite undiscounted SSP over user-defined GraphNode options.">
        <div className="grid gap-2 sm:grid-cols-3"><ReadOnly label="Strategy" value="ssp_v1" /><ReadOnly label="Algorithm" value={model.solver.algorithm} /><ReadOnly label="Terminal objective" value="success (value 0)" /></div>
        <p className="text-xs text-muted-foreground">Solver epsilon, iteration and time bounds remain platform defaults. Failure and blocked terminals are non-goal states with infinite remaining cost.</p>
      </Section>

      <Section title="Decision-state features" description="Only bounded values used by policy projection are defined here.">
        <div className="grid gap-2">{model.features.map((feature, index) => <div key={`${feature.id}:${index}`} className="grid gap-2 rounded border border-divider-strong bg-background/40 p-3 sm:grid-cols-12">
          <Field label="Feature ID" className="sm:col-span-2"><Input disabled={locked} value={feature.id} onChange={(event) => updateFeature(index, { ...feature, id: event.target.value })} /></Field>
          <Field label="Source" className="sm:col-span-2"><Select disabled={locked} value={feature.source.kind} values={["runtime", "project_state", "authorization"]} onChange={(kind) => updateFeature(index, { ...feature, source: kind === "runtime" ? { kind: "runtime", fact: "epoch_kind" } : { kind: kind as "project_state" | "authorization", pointer: "" } })} /></Field>
          <Field label={feature.source.kind === "runtime" ? "Runtime fact" : "JSON Pointer"} className="sm:col-span-3">{feature.source.kind === "runtime"
            ? <Select disabled={locked} value={feature.source.fact} values={["epoch_kind", "previous_graph_node_id", "previous_graph_node_result", "graph_node_invocation_count"]} onChange={(fact) => updateFeature(index, { ...feature, source: { kind: "runtime", fact: fact as typeof feature.source.fact } })} />
            : <Input disabled={locked} value={feature.source.pointer} onChange={(event) => updateFeature(index, { ...feature, source: { kind: feature.source.kind as "project_state" | "authorization", pointer: event.target.value } })} />}</Field>
          <Field label="Finite domain (comma-separated)" className="sm:col-span-3"><Input disabled={locked} value={feature.domain.join(", ")} onChange={(event) => updateFeature(index, { ...feature, domain: csv(event.target.value) })} /></Field>
          <Field label="Missing" className="sm:col-span-2"><div className="flex gap-1"><Select disabled={locked} value={feature.missingValue} values={feature.domain} onChange={(missingValue) => updateFeature(index, { ...feature, missingValue })} /><Button type="button" variant="ghost" size="icon-sm" disabled={locked || model.features.length === 1} aria-label={`Remove feature ${feature.id}`} onClick={() => updateModel({ features: model.features.filter((_, candidate) => candidate !== index) })}><Trash2 /></Button></div></Field>
        </div>)}</div>
        <Button type="button" size="sm" variant="outline" disabled={locked} onClick={() => updateModel({ features: [...model.features, { id: `feature-${model.features.length + 1}`, domain: ["unknown"], missingValue: "unknown", source: { kind: "project_state", pointer: "" } }] })}><Plus /> Feature</Button>
      </Section>

      <Section title="Capability admissibility" description="Hard guards remove GraphNode actions from A(s); they are never modeled as penalties.">
        <div className="grid gap-2">{strategy.capabilityGraph.actions.map((action) => <div key={action.graphNodeId} className="rounded border border-divider-strong bg-background/40 p-3">
          <div className="mb-2 font-mono text-xs text-tertiary">{action.graphNodeId}</div>
          <div className="grid gap-2 sm:grid-cols-2">{model.features.map((feature) => {
            const guard = action.guards.find(({ featureId }) => featureId === feature.id);
            return <Field key={feature.id} label={`${feature.id} allowed values`}><select multiple disabled={locked} value={guard?.allowedValues ?? []} className="min-h-20 rounded border border-input bg-background p-2 text-xs" onChange={(event) => setCapabilityGuards(action.graphNodeId, feature.id, [...event.currentTarget.selectedOptions].map(({ value }) => value))}>{feature.domain.map((value) => <option key={value}>{value}</option>)}</select></Field>;
          })}</div>
        </div>)}</div>
      </Section>

      <Section title="Decision states and terminal objective" description="Each state supplies exactly one value for every bounded feature.">
        <div className="grid gap-2">{model.states.map((state, index) => <div key={`${state.id}:${index}`} className="rounded border border-divider-strong bg-background/40 p-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <Field label="State ID"><Input disabled={locked} value={state.id} onChange={(event) => renameState(index, event.target.value)} /></Field>
            <Field label="Terminal"><Select disabled={locked} value={state.terminal ?? "nonterminal"} values={["nonterminal", "success", "failure", "blocked"]} onChange={(terminal) => updateModel({ states: model.states.map((candidate, candidateIndex) => candidateIndex === index ? { ...candidate, terminal: terminal === "nonterminal" ? undefined : terminal as "success" | "failure" | "blocked" } : candidate) })} /></Field>
            <div className="flex items-end justify-end"><Button type="button" variant="ghost" size="sm" disabled={locked || model.states.length <= 3} onClick={() => updateModel({ states: model.states.filter((_, candidate) => candidate !== index), stateActions: model.stateActions.filter(({ stateId }) => stateId !== state.id).map((row) => ({ ...row, successors: row.successors.filter(({ nextStateId }) => nextStateId !== state.id) })) })}><Trash2 /> Remove</Button></div>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">{model.features.map((feature) => <Field key={feature.id} label={feature.id}><Select disabled={locked} value={state.values[feature.id] ?? ""} values={feature.domain} onChange={(value) => updateModel({ states: model.states.map((candidate, candidateIndex) => candidateIndex === index ? { ...candidate, values: { ...candidate.values, [feature.id]: value } } : candidate) })} /></Field>)}</div>
        </div>)}</div>
        <Button type="button" size="sm" variant="outline" disabled={locked} onClick={() => updateModel({ states: [...model.states, { id: `state-${model.states.length + 1}`, values: Object.fromEntries(model.features.map((feature) => [feature.id, feature.missingValue])) }] })}><Plus /> State</Button>
      </Section>

      <Section title="Configured option priors and costs" description="Every probability row must sum to exactly 1,000,000 ppm. Cost is the configured positive scalar micro-unit.">
        <div className="grid gap-2">{model.stateActions.map((row, index) => <ActionRow key={`${row.stateId}:${row.graphNodeId}:${index}`} row={row} index={index} strategy={strategy} graphNodeIds={graphNodeIds} locked={locked} onChange={(next) => updateModel({ stateActions: model.stateActions.map((candidate, candidateIndex) => candidateIndex === index ? next : candidate) })} onRemove={() => updateModel({ stateActions: model.stateActions.filter((_, candidate) => candidate !== index) })} />)}</div>
        <Button type="button" size="sm" variant="outline" disabled={locked || !model.states.find(({ terminal }) => !terminal) || !graphNodeIds[0]} onClick={() => {
          const stateId = model.states.find(({ terminal }) => !terminal)!.id;
          const nextStateId = model.states.find(({ terminal }) => terminal === "success")?.id ?? model.states[0]!.id;
          updateModel({ stateActions: [...model.stateActions, { stateId, graphNodeId: graphNodeIds[0]!, expectedCostMicros: 1, successors: [{ nextStateId, probabilityPpm: 1_000_000 }] }] });
        }}><Plus /> State/action row</Button>
      </Section>

      <Section title="Projection bounds" description="These bounds limit the derived preview only; they do not limit runtime execution.">
        <div className="grid gap-2 sm:grid-cols-2"><Field label="Decision epochs"><Input disabled={locked} type="number" min={1} max={20} value={model.projection.maxDecisionEpochs} onChange={(event) => updateModel({ projection: { ...model.projection, maxDecisionEpochs: Number(event.target.value) } })} /></Field><Field label="Projection nodes"><Input disabled={locked} type="number" min={1} max={100} value={model.projection.maxProjectionNodes} onChange={(event) => updateModel({ projection: { ...model.projection, maxProjectionNodes: Number(event.target.value) } })} /></Field></div>
      </Section>
    </div>
    <DialogFooter className="border-t border-divider-strong p-3"><Button onClick={() => onOpenChange(false)}>Done</Button></DialogFooter>
  </DialogContent></Dialog>;
}

function ActionRow({ row, index, strategy, graphNodeIds, locked, onChange, onRemove }: {
  row: DecisionOptionModelRowV1; index: number; strategy: ProjectSspGraphStrategyV1; graphNodeIds: string[]; locked: boolean;
  onChange: (row: DecisionOptionModelRowV1) => void; onRemove: () => void;
}) {
  const states = strategy.model.states.map(({ id }) => id);
  const sum = row.successors.reduce((total, { probabilityPpm }) => total + probabilityPpm, 0);
  return <div className="rounded border border-divider-strong bg-background/40 p-3">
    <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]"><Field label="State"><Select disabled={locked} value={row.stateId} values={states} onChange={(stateId) => onChange({ ...row, stateId })} /></Field><Field label="GraphNode action"><Select disabled={locked} value={row.graphNodeId} values={graphNodeIds} onChange={(graphNodeId) => onChange({ ...row, graphNodeId })} /></Field><Field label="Configured cost (micro)"><Input disabled={locked} type="number" min={1} value={row.expectedCostMicros} onChange={(event) => onChange({ ...row, expectedCostMicros: Number(event.target.value) })} /></Field><Button type="button" variant="ghost" size="icon-sm" disabled={locked} aria-label={`Remove action row ${index + 1}`} onClick={onRemove}><Trash2 /></Button></div>
    <div className="mt-2 grid gap-1">{row.successors.map((successor, successorIndex) => <div key={successorIndex} className="grid grid-cols-[1fr_1fr_auto] gap-2"><Select disabled={locked} value={successor.nextStateId} values={states} onChange={(nextStateId) => onChange({ ...row, successors: row.successors.map((candidate, candidateIndex) => candidateIndex === successorIndex ? { ...candidate, nextStateId } : candidate) })} /><Input disabled={locked} aria-label={`Probability ppm ${successorIndex + 1}`} type="number" min={1} max={1_000_000} value={successor.probabilityPpm} onChange={(event) => onChange({ ...row, successors: row.successors.map((candidate, candidateIndex) => candidateIndex === successorIndex ? { ...candidate, probabilityPpm: Number(event.target.value) } : candidate) })} /><Button type="button" variant="ghost" size="icon-sm" disabled={locked || row.successors.length === 1} aria-label={`Remove successor ${successorIndex + 1}`} onClick={() => onChange({ ...row, successors: row.successors.filter((_, candidateIndex) => candidateIndex !== successorIndex) })}><Trash2 /></Button></div>)}</div>
    <div className={`mt-2 font-mono text-[0.65rem] ${sum === 1_000_000 ? "text-secondary" : "text-destructive"}`}>Configured prior sum: {sum.toLocaleString()} ppm {sum === 1_000_000 ? "✓" : "— must equal 1,000,000"}</div>
    <Button type="button" className="mt-2" size="xs" variant="outline" disabled={locked} onClick={() => onChange({ ...row, successors: [...row.successors, { nextStateId: states[0] ?? "", probabilityPpm: 1 }] })}><Plus /> Outcome branch</Button>
  </div>;
}

const Section = ({ title, description, children }: { title: string; description: string; children: ReactNode }) => <section className="mb-5 grid gap-3 border-b border-divider-strong pb-5 last:border-0"><div><h3 className="text-sm font-medium">{title}</h3><p className="mt-0.5 text-xs text-muted-foreground">{description}</p></div>{children}</section>;
const Field = ({ label, className = "", children }: { label: string; className?: string; children: ReactNode }) => <label className={`grid min-w-0 gap-1 text-xs ${className}`}><span className="font-mono text-[0.625rem] uppercase tracking-wide text-muted-foreground">{label}</span>{children}</label>;
const ReadOnly = ({ label, value }: { label: string; value: string }) => <div className="rounded border border-divider-strong bg-background/40 p-2"><div className="font-mono text-[0.625rem] uppercase text-muted-foreground">{label}</div><div className="mt-1 font-mono text-xs">{value}</div></div>;
const Select = ({ value, values, disabled, onChange }: { value: string; values: string[]; disabled?: boolean; onChange: (value: string) => void }) => <select value={value} disabled={disabled} className="h-8 min-w-0 rounded border border-input bg-background px-2 text-xs" onChange={(event) => onChange(event.target.value)}>{!values.includes(value) ? <option value={value}>{value || "Choose…"}</option> : null}{values.map((entry) => <option key={entry}>{entry}</option>)}</select>;
const csv = (value: string) => [...new Set(value.split(",").map((entry) => entry.trim()).filter(Boolean))];
