import type {
  ProjectAutomationConfig,
  ProjectGraphTransition,
  ProjectRepairEdge
} from "@shared/api/workspace-contracts";
import { GitBranch, Wrench } from "lucide-react";
import { DeleteAction, SelectField, TextAreaField, TextField } from "@/components/shared/workspace-ui";
import { Button } from "@/components/ui/button";

const doneTarget = "__DONE__";

export function LoopEdgesEditor({
  config,
  sourceLoopId,
  disabled,
  onAddTransition,
  onChangeTransition,
  onRemoveTransition,
  onAddRepair,
  onChangeRepair,
  onRemoveRepair
}: {
  config: ProjectAutomationConfig;
  sourceLoopId: string;
  disabled: boolean;
  onAddTransition: () => void;
  onChangeTransition: (edgeId: string, edge: ProjectGraphTransition) => void;
  onRemoveTransition: (edgeId: string) => void;
  onAddRepair: () => void;
  onChangeRepair: (edgeId: string, edge: ProjectRepairEdge) => void;
  onRemoveRepair: (edgeId: string) => void;
}) {
  const transitions = config.graph.transitions.filter((edge) => edge.source === sourceLoopId);
  const repairs = config.graph.repairEdges.filter((edge) => edge.source === sourceLoopId);
  const loopTargets = config.loops.map((loop) => ({ value: loop.id, label: `${loop.id} · ${loop.description}` }));
  return <div className="grid gap-4">
    <section aria-labelledby="runbook-transitions-heading" className="grid gap-3 rounded-md border border-divider-strong bg-card p-3">
      <div className="flex items-center gap-2">
        <GitBranch className="size-4 text-primary" />
        <h3 id="runbook-transitions-heading" className="font-mono text-xs font-semibold uppercase tracking-[0.08em]">RunBook transitions</h3>
        <Button type="button" size="xs" variant="outline" className="ml-auto" disabled={disabled} onClick={onAddTransition}>Add transition</Button>
      </div>
      <p className="text-xs text-muted-foreground">A terminal Validation chooses exactly one named decision/outcome pair. The Orchestrator resolves its immutable target without LLM routing.</p>
      {transitions.map((edge) => <TransitionRow
        key={edge.id}
        edge={edge}
        config={config}
        targetOptions={[...loopTargets, { value: doneTarget, label: "DONE · finish Graph Run" }]}
        disabled={disabled}
        onChange={(next) => onChangeTransition(edge.id, next)}
        onRemove={() => onRemoveTransition(edge.id)}
      />)}
      {!transitions.length ? <p className="text-xs text-muted-foreground">No outgoing RunBook transitions.</p> : null}
    </section>

    <section aria-labelledby="repair-edges-heading" className="grid gap-3 rounded-md border border-divider-strong bg-card p-3">
      <div className="flex items-center gap-2">
        <Wrench className="size-4 text-tertiary" />
        <h3 id="repair-edges-heading" className="font-mono text-xs font-semibold uppercase tracking-[0.08em]">Repair edges</h3>
        <Button type="button" size="xs" variant="outline" className="ml-auto" disabled={disabled} onClick={onAddRepair}>Add repair edge</Button>
      </div>
      <p className="text-xs text-muted-foreground">Repair is a separate Validation call/return route. It never acts as a normal RunBook transition.</p>
      {repairs.map((edge) => <RepairRow
        key={edge.id}
        edge={edge}
        config={config}
        targetOptions={loopTargets}
        disabled={disabled}
        onChange={(next) => onChangeRepair(edge.id, next)}
        onRemove={() => onRemoveRepair(edge.id)}
      />)}
      {!repairs.length ? <p className="text-xs text-muted-foreground">No outgoing repair routes.</p> : null}
    </section>
  </div>;
}

function TransitionRow({ edge, config, targetOptions, disabled, onChange, onRemove }: {
  edge: ProjectGraphTransition;
  config: ProjectAutomationConfig;
  targetOptions: Array<{ value: string; label: string }>;
  disabled: boolean;
  onChange: (edge: ProjectGraphTransition) => void;
  onRemove: () => void;
}) {
  const targetValue = "loopId" in edge.target ? edge.target.loopId : doneTarget;
  const duplicate = config.graph.transitions.some((candidate) => candidate.id !== edge.id
    && candidate.source === edge.source && candidate.decision === edge.decision && candidate.outcome === edge.outcome);
  return <fieldset className="grid gap-3 rounded border border-divider-strong bg-background p-3">
    <legend className="px-1 font-mono text-[0.65rem] text-muted-foreground">{edge.decision} · {edge.outcome} · {edge.source} → {targetValue === doneTarget ? "DONE" : targetValue}</legend>
    <div className="grid gap-3 sm:grid-cols-2">
      <TextField label="Transition ID" value={edge.id} error={idError(edge.id, config)} required disabled={disabled} density="compact" onChange={(id) => onChange({ ...edge, id })} />
      <SelectField label="Decision" value={edge.decision} options={[{ value: "PASS", label: "PASS" }, { value: "FAIL", label: "FAIL" }]} disabled={disabled} density="compact" onChange={(decision) => onChange({ ...edge, decision: decision as "PASS" | "FAIL" })} />
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <TextField label="Named outcome" value={edge.outcome} error={duplicate ? "Decision/outcome must be unique for this Loop." : outcomeError(edge.outcome)} required disabled={disabled} density="compact" onChange={(outcome) => onChange({ ...edge, outcome })} />
      <SelectField label="Target" value={targetValue} options={targetOptions} disabled={disabled} density="compact" onChange={(target) => onChange({ ...edge, target: target === doneTarget ? { runResult: "DONE" } : { loopId: target } })} />
    </div>
    <TextAreaField label="Transition description" value={edge.description} error={edge.description.trim() ? undefined : "Description is required."} required disabled={disabled} density="compact" rows={2} onChange={(description) => onChange({ ...edge, description })} />
    <DeleteAction deleteLabel={`Remove transition ${edge.id}`} deleteType="Graph transition" resourceName={edge.id} disabled={disabled} onDelete={onRemove} />
  </fieldset>;
}

function RepairRow({ edge, config, targetOptions, disabled, onChange, onRemove }: {
  edge: ProjectRepairEdge;
  config: ProjectAutomationConfig;
  targetOptions: Array<{ value: string; label: string }>;
  disabled: boolean;
  onChange: (edge: ProjectRepairEdge) => void;
  onRemove: () => void;
}) {
  const target = config.loops.find((loop) => loop.id === edge.target);
  const capabilityError = target?.capabilities.provides.includes(edge.capability)
    ? undefined
    : `Target Loop must provide ${edge.capability || "this capability"}.`;
  return <fieldset className="grid gap-3 rounded border border-tertiary/35 bg-background p-3">
    <legend className="px-1 font-mono text-[0.65rem] text-tertiary">REPAIR · {edge.source} → {edge.target}</legend>
    <div className="grid gap-3 sm:grid-cols-2">
      <TextField label="Repair Edge ID" value={edge.id} error={idError(edge.id, config)} required disabled={disabled} density="compact" onChange={(id) => onChange({ ...edge, id })} />
      <SelectField label="Target Loop" value={edge.target} options={targetOptions} disabled={disabled} density="compact" onChange={(targetId) => onChange({ ...edge, target: targetId })} />
    </div>
    <TextField label="Capability" value={edge.capability} error={capabilityError} required disabled={disabled} density="compact" onChange={(capability) => onChange({ ...edge, capability })} />
    <TextAreaField label="Repair description" value={edge.description} error={edge.description.trim() ? undefined : "Description is required."} required disabled={disabled} density="compact" rows={2} onChange={(description) => onChange({ ...edge, description })} />
    <DeleteAction deleteLabel={`Remove repair edge ${edge.id}`} deleteType="Repair Edge" resourceName={edge.id} disabled={disabled} onDelete={onRemove} />
  </fieldset>;
}

const outcomeError = (value: string) => /^[a-z][a-z0-9_]{0,63}$/.test(value)
  ? undefined
  : "Use snake_case, starting with a letter, at most 64 characters.";

const idError = (id: string, config: ProjectAutomationConfig) => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) return "Use kebab-case.";
  const occurrences = [
    ...config.graph.transitions.map((edge) => edge.id),
    ...config.graph.repairEdges.map((edge) => edge.id),
    ...config.loops.flatMap((loop) => [...loop.workflow.passEdges, ...loop.workflow.failEdges].map((edge) => edge.id))
  ].filter((candidate) => candidate === id).length;
  return occurrences > 1 ? "Edge ID must be unique." : undefined;
};
