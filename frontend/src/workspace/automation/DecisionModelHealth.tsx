import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { PolicyPreviewV2, ProjectSspDecisionStrategyV2 } from "@shared/api/workspace-contracts";
import { Badge } from "@/components/ui/badge";
import { projectDecisionModelHealth } from "./decisionModelHealthView";
import type { DecisionActionView } from "./decisionModelView";

export function DecisionModelHealth({ strategy, actions, issues, preview }: {
  strategy: ProjectSspDecisionStrategyV2;
  actions: DecisionActionView[];
  issues: Array<{ path: string; message: string }>;
  preview?: PolicyPreviewV2;
}) {
  const health = projectDecisionModelHealth({ strategy, actions, issues, preview });
  return <section className="grid min-w-0 gap-3 rounded-lg border border-divider-strong bg-card p-4" aria-labelledby="model-health-title">
    <div className="flex flex-wrap items-start justify-between gap-2"><div><h2 id="model-health-title" className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.05em]">Model Health</h2><p className="text-xs text-muted-foreground">Facts derived from the current scoped draft and preview.</p></div><Badge variant={health.ready ? "secondary" : "destructive"}>{health.ready ? "Suitable for Run" : "Run blocked"}</Badge></div>
    <ul className="grid gap-2 sm:grid-cols-2">{health.facts.map((fact) => <li key={fact.label} className="flex gap-2 rounded border border-divider-strong bg-background/35 p-2.5 text-xs">{fact.status === "healthy" ? <CheckCircle2 className="size-4 shrink-0 text-secondary" /> : <AlertTriangle className={`size-4 shrink-0 ${fact.status === "danger" ? "text-destructive" : "text-tertiary"}`} />}<span>{fact.label}</span></li>)}</ul>
    {issues.length ? <details className="rounded border border-divider-strong bg-background/30 p-3"><summary className="cursor-pointer text-xs font-medium">Technical readiness details ({issues.length})</summary><ul className="mt-2 grid gap-2 text-xs text-destructive">{issues.map((issue) => <li key={`${issue.path}:${issue.message}`}><span>{issue.message}</span><span className="block font-mono text-[0.625rem] text-muted-foreground">{issue.path}</span></li>)}</ul></details> : null}
  </section>;
}
