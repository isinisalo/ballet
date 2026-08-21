import type {
  ExecutionProfile,
  LocalRuntime,
  ProjectAutomationConfig,
  ProjectInstruction,
  Skill
} from "@shared/api/workspace-contracts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SelectField, TextField } from "@/components/shared/workspace-ui";
import type { GraphEngineeringProjection } from "./engineeringProjections";
import { LoopOrchestratorEditor } from "./LoopOrchestratorEditor";

export function GraphOrchestratorInspector({
  config,
  projection,
  profiles,
  instructions,
  skills,
  runtime,
  disabled,
  onConfigChange
}: {
  config: ProjectAutomationConfig;
  projection: GraphEngineeringProjection;
  profiles: ExecutionProfile[];
  instructions: ProjectInstruction[];
  skills: Skill[];
  runtime: LocalRuntime;
  disabled: boolean;
  onConfigChange: (config: ProjectAutomationConfig) => void;
}) {
  return <div className="grid gap-4 p-4">
    <section className="grid gap-3 border-b border-divider-strong pb-4">
      <h2 className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Graph RunBook</h2>
      <TextField
        label="Graph name"
        value={config.graph.name}
        error={config.graph.name.trim() ? undefined : "Graph name is required."}
        required
        disabled={disabled}
        density="compact"
        onChange={(name) => onConfigChange({ ...config, graph: { ...config.graph, name } })}
      />
      <SelectField
        label="Start Loop"
        value={config.graph.startLoopId}
        options={config.loops.map((loop) => ({ value: loop.id, label: `${loop.id} · ${loop.description}` }))}
        disabled={disabled}
        density="compact"
        onChange={(startLoopId) => onConfigChange({ ...config, graph: { ...config.graph, startLoopId } })}
      />
      <TextField
        label="Maximum transitions"
        type="number"
        value={config.orchestrator.maxTransitions}
        error={Number.isInteger(config.orchestrator.maxTransitions) && config.orchestrator.maxTransitions >= 1 && config.orchestrator.maxTransitions <= 256 ? undefined : "Enter an integer from 1 to 256."}
        required
        disabled={disabled}
        density="compact"
        onChange={(value) => onConfigChange({ ...config, orchestrator: { ...config.orchestrator, maxTransitions: Number(value) } })}
      />
    </section>
    <OrchestratorPolicyEvidence projection={projection} />
    <LoopOrchestratorEditor
      value={config.orchestrator}
      profiles={profiles}
      instructions={instructions}
      skills={skills}
      runtime={runtime}
      disabled={disabled}
      onChange={(orchestrator) => onConfigChange({ ...config, orchestrator })}
    />
  </div>;
}

function OrchestratorPolicyEvidence({ projection }: { projection: GraphEngineeringProjection }) {
  const active = projection.routeEvidence.filter(({ state }) => state === "active");
  const blocked = projection.routeEvidence.filter(({ state }) => state === "blocked");
  return <section aria-label="Orchestrator route policy and live Run evidence" className="grid gap-2 border-b border-divider-strong pb-4">
    <h2 className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Policy and Run evidence</h2>
    <div className="grid grid-cols-3 gap-1.5 text-center font-mono text-[0.62rem]"><span className="rounded border border-divider-strong p-1.5">{projection.edges.filter(({ kind }) => kind === "transition").length}<small className="block text-muted-foreground">transitions</small></span><span className="rounded border border-tertiary/40 p-1.5 text-tertiary">{projection.edges.filter(({ kind }) => kind === "repair").length}<small className="block text-muted-foreground">repairs</small></span><span className="rounded border border-secondary/40 p-1.5 text-secondary">{active.length}<small className="block text-muted-foreground">active repair</small></span></div>
    {active.map(({ route }) => <p key={route.routeId} className="rounded border border-secondary/40 bg-background p-2 font-mono text-[0.64rem] text-secondary">active canonical route · {route.sourceLoopId} → {route.targetLoopId} · {route.loopEdgeId}</p>)}
    {blocked.map(({ route, reason }) => <Alert key={route.routeId} variant="destructive"><AlertDescription><span className="font-mono">blocked route evidence · {route.loopEdgeId}</span><br />{reason}</AlertDescription></Alert>)}
    {!active.length && !blocked.length ? <p className="text-xs text-muted-foreground">No active canonical route or blocked route evidence.</p> : null}
  </section>;
}
