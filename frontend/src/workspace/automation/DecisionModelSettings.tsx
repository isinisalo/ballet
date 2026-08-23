import type { ProjectRepairNode, ProjectSspDecisionStrategyV2 } from "@shared/api/workspace-contracts";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function DecisionModelSettings({ strategy, repair, locked, onStrategyChange, onRepairChange }: {
  strategy: ProjectSspDecisionStrategyV2; repair?: ProjectRepairNode; locked: boolean;
  onStrategyChange: (strategy: ProjectSspDecisionStrategyV2) => void;
  onRepairChange: (repair: ProjectRepairNode) => void;
}) {
  const updateSolver = (key: "epsilon" | "maxIterations" | "maxSolveMillis", value: number) => onStrategyChange({ ...strategy, model: { ...strategy.model, solver: { ...strategy.model.solver, [key]: value } } });
  const updateProjection = (key: "maxDecisionEpochs" | "maxProjectionNodes", value: number) => onStrategyChange({ ...strategy, model: { ...strategy.model, projection: { ...strategy.model.projection, [key]: value } } });
  return <div className="grid gap-4 xl:grid-cols-2">
    <section className="grid content-start gap-3 rounded-lg border border-divider-strong bg-card p-4">
      <div><h2 className="text-sm font-medium">Solver and projection</h2><p className="text-xs text-muted-foreground">Finite undiscounted SSP. Success has V=0; non-goal terminals remain infinite.</p></div>
      <ReadOnly label="Algorithm" value={strategy.model.solver.algorithm} />
      <div className="grid gap-2 sm:grid-cols-3"><NumberField label="Epsilon" value={strategy.model.solver.epsilon} step="0.000001" disabled={locked} onChange={(value) => updateSolver("epsilon", value)} /><NumberField label="Iterations" value={strategy.model.solver.maxIterations} disabled={locked} onChange={(value) => updateSolver("maxIterations", value)} /><NumberField label="Solve ms" value={strategy.model.solver.maxSolveMillis} disabled={locked} onChange={(value) => updateSolver("maxSolveMillis", value)} /></div>
      <div className="grid gap-2 sm:grid-cols-2"><NumberField label="Projection epochs" value={strategy.model.projection.maxDecisionEpochs} disabled={locked} onChange={(value) => updateProjection("maxDecisionEpochs", value)} /><NumberField label="Projection nodes" value={strategy.model.projection.maxProjectionNodes} disabled={locked} onChange={(value) => updateProjection("maxProjectionNodes", value)} /></div>
    </section>
    <section className="grid content-start gap-3 rounded-lg border border-divider-strong bg-card p-4">
      <div><h2 className="text-sm font-medium">Scoped Repair</h2><p className="text-xs text-muted-foreground">Bounded call/return to the same Validation Node. Repair is never an SSP action.</p></div>
      {repair ? <>
        <ReadOnly label="Repair Node" value={repair.id} />
        <label className="grid gap-1 font-mono text-[0.625rem] uppercase text-muted-foreground">Task<Textarea disabled={locked} value={repair.task} className="font-sans text-xs normal-case" onChange={(event) => onRepairChange({ ...repair, task: event.target.value })} /></label>
        <div className="grid gap-2 sm:grid-cols-2"><NumberField label="Max repair depth" value={repair.maxRepairDepth} disabled={locked} onChange={(value) => onRepairChange({ ...repair, maxRepairDepth: value })} /><NumberField label="Max attempts" value={repair.maxRepairAttempts} disabled={locked} onChange={(value) => onRepairChange({ ...repair, maxRepairAttempts: value })} /></div>
      </> : <p className="rounded border border-dashed border-divider-strong p-4 text-xs text-muted-foreground">No scoped Repair Node is configured.</p>}
    </section>
  </div>;
}

const NumberField = ({ label, value, step, disabled, onChange }: { label: string; value: number; step?: string; disabled: boolean; onChange: (value: number) => void }) => <label className="grid gap-1 font-mono text-[0.625rem] uppercase text-muted-foreground">{label}<Input type="number" min={step ? undefined : 1} step={step} disabled={disabled} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
const ReadOnly = ({ label, value }: { label: string; value: string }) => <div className="rounded border border-divider-strong bg-background/40 p-2"><div className="font-mono text-[0.625rem] uppercase text-muted-foreground">{label}</div><div className="mt-1 truncate font-mono text-xs">{value}</div></div>;
