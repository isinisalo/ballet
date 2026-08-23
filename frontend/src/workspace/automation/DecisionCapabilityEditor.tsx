import { Plus, Trash2 } from "lucide-react";
import type { ProjectSspDecisionStrategyV2 } from "@shared/api/workspace-contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DecisionCapabilityEditor({ strategy, actionIds, locked, onChange }: {
  strategy: ProjectSspDecisionStrategyV2; actionIds: string[]; locked: boolean;
  onChange: (strategy: ProjectSspDecisionStrategyV2) => void;
}) {
  const capability = strategy.capabilityModel;
  const update = (patch: Partial<typeof capability>) => onChange({ ...strategy, capabilityModel: { ...capability, ...patch } });
  return <div className="grid gap-4 xl:grid-cols-2">
    <section className="grid content-start gap-3 rounded-lg border border-divider-strong bg-card p-4">
      <div><h2 className="text-sm font-medium">Outcome catalog</h2><p className="text-xs text-muted-foreground">Descriptions are scoped semantics. PASS/FAIL remains intrinsic to each action contract.</p></div>
      {capability.outcomes.map((outcome, index) => <div key={`${outcome.id}:${index}`} className="grid grid-cols-[minmax(8rem,0.8fr)_1fr_auto] gap-2">
        <Input aria-label="Outcome ID" disabled={locked} value={outcome.id} onChange={(event) => update({ outcomes: capability.outcomes.map((candidate, candidateIndex) => candidateIndex === index ? { ...candidate, id: event.target.value } : candidate) })} />
        <Input aria-label={`${outcome.id} description`} disabled={locked} value={outcome.description} onChange={(event) => update({ outcomes: capability.outcomes.map((candidate, candidateIndex) => candidateIndex === index ? { ...candidate, description: event.target.value } : candidate) })} />
        <Button size="icon-sm" variant="ghost" disabled={locked} aria-label={`Remove outcome ${outcome.id}`} onClick={() => update({ outcomes: capability.outcomes.filter((_, candidate) => candidate !== index) })}><Trash2 /></Button>
      </div>)}
      <Button size="sm" variant="outline" disabled={locked} onClick={() => update({ outcomes: [...capability.outcomes, { id: `outcome-${capability.outcomes.length + 1}`, description: "Describe this semantic outcome." }] })}><Plus /> Outcome</Button>
    </section>
    <section className="grid content-start gap-3 rounded-lg border border-divider-strong bg-card p-4">
      <div><h2 className="text-sm font-medium">Action availability</h2><p className="text-xs text-muted-foreground">Hard guards remove an action from A(s); they are not soft penalties.</p></div>
      {capability.actions.map((action, index) => <div key={`${action.actionId}:${index}`} className="grid gap-2 rounded border border-divider-strong bg-background/40 p-3">
        <div className="flex items-center justify-between gap-2"><select aria-label="Action" value={action.actionId} disabled={locked} className="h-8 min-w-0 flex-1 rounded border border-input bg-background px-2 font-mono text-xs" onChange={(event) => update({ actions: capability.actions.map((candidate, candidateIndex) => candidateIndex === index ? { ...candidate, actionId: event.target.value } : candidate) })}>{actionIds.map((id) => <option key={id}>{id}</option>)}</select><Button size="icon-sm" variant="ghost" disabled={locked} aria-label={`Remove action ${action.actionId}`} onClick={() => update({ actions: capability.actions.filter((_, candidate) => candidate !== index) })}><Trash2 /></Button></div>
        {strategy.model.features.map((feature) => {
          const guard = action.guards.find(({ featureId }) => featureId === feature.id);
          return <label key={feature.id} className="grid gap-1 font-mono text-[0.625rem] uppercase text-muted-foreground">{feature.id} allowed values<select multiple disabled={locked} value={guard?.allowedValues ?? []} className="min-h-20 rounded border border-input bg-background p-2 font-sans text-xs normal-case text-foreground" onChange={(event) => {
            const allowedValues = [...event.currentTarget.selectedOptions].map(({ value }) => value);
            update({ actions: capability.actions.map((candidate, candidateIndex) => candidateIndex !== index ? candidate : { ...candidate,
              guards: allowedValues.length ? [...candidate.guards.filter((entry) => entry.featureId !== feature.id), { featureId: feature.id, allowedValues }] : candidate.guards.filter((entry) => entry.featureId !== feature.id)
            }) });
          }}>{feature.domain.map((value) => <option key={value}>{value}</option>)}</select></label>;
        })}
      </div>)}
      <Button size="sm" variant="outline" disabled={locked || capability.actions.length >= actionIds.length} onClick={() => {
        const actionId = actionIds.find((id) => !capability.actions.some((action) => action.actionId === id));
        if (actionId) update({ actions: [...capability.actions, { actionId, guards: [] }] });
      }}><Plus /> Action metadata</Button>
    </section>
  </div>;
}
