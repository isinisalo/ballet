import type { ProjectAutomationConfig, ProjectLoopEdge } from "@shared/api/workspace-contracts";
import { ArrowRight, GitBranch, Wrench } from "lucide-react";
import { DeleteAction, SelectField, TextAreaField, TextField } from "@/components/shared/workspace-ui";
import { Button } from "@/components/ui/button";
import { loopEdgeIdError, loopEdgeRouteError } from "./loopFormValidation";

export function LoopEdgesEditor({ config, sourceLoopId, disabled, onAdd, onChange, onRemove }: {
  config: ProjectAutomationConfig;
  sourceLoopId: string;
  disabled: boolean;
  onAdd: () => void;
  onChange: (edgeId: string, edge: ProjectLoopEdge) => void;
  onRemove: (edgeId: string) => void;
}) {
  const edges = config.graph.loopEdges.filter((edge) => edge.source === sourceLoopId);
  const targetOptions = config.loops.map((loop) => ({
    value: loop.id,
    label: `${loop.id} · ${loop.description}`
  }));
  return (
    <section aria-labelledby="loop-edges-heading" className="grid gap-3 rounded-lg border border-divider-strong bg-card p-3">
      <div className="flex items-center gap-2">
        <GitBranch className="size-4 text-tertiary" aria-hidden="true" />
        <h3 id="loop-edges-heading" className="font-mono text-xs font-semibold uppercase tracking-[0.08em]">Loop Edges</h3>
        <Button type="button" size="xs" variant="outline" className="ml-auto" disabled={disabled || targetOptions.length === 0} onClick={onAdd}>Add Loop Edge</Button>
      </div>
      <p className="text-xs text-muted-foreground">Flow connects normal Loop completion. Repair grants the orchestrator an explicit routing target.</p>
      {edges.map((edge) => (
        <LoopEdgeRow key={edge.id} edge={edge} config={config} targetOptions={targetOptions} disabled={disabled} onChange={(next) => onChange(edge.id, next)} onRemove={() => onRemove(edge.id)} />
      ))}
      {edges.length === 0 ? <p className="text-xs text-muted-foreground">No outgoing Loop Edges.</p> : null}
    </section>
  );
}

function LoopEdgeRow({ edge, config, targetOptions, disabled, onChange, onRemove }: {
  edge: ProjectLoopEdge;
  config: ProjectAutomationConfig;
  targetOptions: Array<{ value: string; label: string }>;
  disabled: boolean;
  onChange: (edge: ProjectLoopEdge) => void;
  onRemove: () => void;
}) {
  return (
    <fieldset className="grid gap-3 rounded border border-divider-strong bg-background p-3">
      <legend className="px-1 font-mono text-[0.65rem] text-muted-foreground">
        <span className="inline-flex items-center gap-1">{edge.kind === "repair" ? <Wrench className="size-3" /> : <ArrowRight className="size-3" />} {edge.kind.toUpperCase()} · {edge.source} → {edge.target}</span>
      </legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Loop Edge ID" value={edge.id} error={loopEdgeIdError(edge, config)} required disabled={disabled} density="compact" onChange={(id) => onChange({ ...edge, id })} />
        <SelectField label="Loop Edge kind" value={edge.kind} error={loopEdgeRouteError(edge, config)} options={[{ value: "flow", label: "Flow" }, { value: "repair", label: "Repair allowlist" }]} disabled={disabled} density="compact" onChange={(kind) => onChange({ ...edge, kind: kind as ProjectLoopEdge["kind"] })} />
      </div>
      <SelectField label="Target Loop" value={edge.target} error={edge.kind === "repair" ? loopEdgeRouteError(edge, config) : undefined} options={targetOptions} disabled={disabled} density="compact" onChange={(target) => onChange({ ...edge, target })} />
      <TextAreaField label="Routing description" value={edge.description} error={edge.description.trim() ? undefined : "Routing description is required."} required disabled={disabled} density="compact" rows={2} onChange={(description) => onChange({ ...edge, description })} />
      <div><DeleteAction deleteLabel={`Remove Loop Edge ${edge.id}`} deleteType="Loop Edge" resourceName={edge.id} disabled={disabled} onDelete={onRemove} /></div>
    </fieldset>
  );
}
