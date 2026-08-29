import { ArrowDown, ArrowUp, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OperationalStatus } from "@/components/shared/workspace-ui";
import type { EnvironmentDefinition } from "@shared/vnext/environment";
import { orderedActions, orderedStates } from "@shared/vnext/gates";
import type { ContractIssue } from "@shared/vnext/primitives";
import { vNextStatePath } from "@/workspace/routing";
import { ConfigureHeader, IssueList } from "./ConfigureHeader";

export function EnvironmentWorkspace({ environment, issues, locked, navigate, onMove }: {
  environment: EnvironmentDefinition; issues: ContractIssue[]; locked: boolean; navigate(path: string): void; onMove(id: string, delta: -1 | 1): Promise<void>;
}) {
  const states = orderedStates(environment.states);
  return <><ConfigureHeader title="Environment" description={environment.description} status={locked ? "Locked by active Run" : issues.length ? "Not ready" : "Ready to run"} />
    <div className="space-y-5 p-4 md:p-6"><section className="rounded-md border bg-card p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="font-semibold">{environment.name}</h2><code className="text-xs text-tertiary">{environment.id}</code></div><span className="text-sm text-muted-foreground">{states.length} ordered States · {states.reduce((count, state) => count + state.actions.length, 0)} Actions</span></div><div className="mt-3"><IssueList issues={issues} /></div></section>
      <section aria-label="Ordered State lanes"><h2 className="mb-3 font-semibold">Ordered State lanes</h2><ol className="grid min-w-0 gap-3 lg:grid-cols-2">{states.map((state, index) => { const stateIssues = issues.filter((issue) => issue.path.startsWith(`environment.states.${environment.states.indexOf(state)}`)); return <li key={state.id} className="min-w-0 rounded-md border bg-card p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><span className="font-mono text-xs text-tertiary">ORDER {state.order} · {state.id}</span><h3 className="truncate font-semibold">{state.name}</h3><p className="mt-1 text-sm text-muted-foreground">{state.description}</p></div><OperationalStatus compact label={stateIssues.length ? `${stateIssues.length} issue${stateIssues.length === 1 ? "" : "s"}` : "Ready"} tone={stateIssues.length ? "danger" : "healthy"} /></div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground"><span>{state.useCaseIds.length} Use Case refs</span><span>·</span><span>{state.actions.length} Actions</span></div><ol className="mt-3 space-y-1">{orderedActions(state.actions).map((action) => <li key={action.id} className="flex min-h-9 items-center justify-between rounded-sm border px-2"><span><code className="text-tertiary">P{action.priority}</code> {action.name}</span><ChevronRight className="size-4" aria-hidden="true" /></li>)}</ol>
        <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={locked || index === 0} aria-label={`Move State ${state.id} earlier`} onClick={() => void onMove(state.id, -1)}><ArrowUp />Earlier</Button><Button size="sm" variant="outline" disabled={locked || index === states.length - 1} aria-label={`Move State ${state.id} later`} onClick={() => void onMove(state.id, 1)}><ArrowDown />Later</Button><Button size="sm" onClick={() => navigate(vNextStatePath(state.id))}>Open {state.id}</Button></div></li>; })}</ol></section>
      <p className="text-xs text-muted-foreground">Authoring order is deterministic. Runtime status appears only in Run projections; these cards do not create execution facts.</p>
    </div></>;
}
