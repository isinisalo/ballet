import type { AgentOutcome, ProjectStep, RespondToStepRunRequest, StepRun, StepTransitionTarget } from "@shared/api/workspace-contracts";
import { GitCompare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StepResponsePanel } from "./StepResponsePanel";

export function LoopRunStepPanel({ step, stepRun, pending, onRespond }: {
  step: ProjectStep;
  stepRun: StepRun;
  pending: boolean;
  onRespond: (stepRunId: string, request: RespondToStepRunRequest) => Promise<boolean>;
}) {
  const outcomeBadge = outcomeBadgePresentation(stepRun.outcome);
  return (
    <div aria-label="StepRun details" className="min-w-0 px-3 py-3 text-xs">
      <dl className="grid grid-cols-[5rem_minmax(0,1fr)] gap-x-2 gap-y-2 font-mono text-[0.65rem]">
        <dt className="text-muted-foreground">Type</dt><dd>{step.type}</dd>
        <dt className="text-muted-foreground">Agent</dt><dd className="break-words">{stepRun.agentId ?? "Human operator"}</dd>
        {stepRun.execution ? <>
          <dt className="text-muted-foreground">Runtime</dt><dd className="break-words">{stepRun.execution.hostname} · {stepRun.execution.provider}</dd>
          <dt className="text-muted-foreground">Model</dt><dd className="break-all">{stepRun.execution.model}</dd>
          <dt className="text-muted-foreground">Reasoning</dt><dd>{stepRun.execution.reasoning}</dd>
        </> : null}
        <dt className="text-muted-foreground">Attempt</dt><dd>{stepRun.attempt}</dd>
        <dt className="text-muted-foreground">Result</dt><dd>{stepRun.result ?? "—"}</dd>
        <dt className="text-muted-foreground">Transition</dt><dd>{stepRun.result ? formatTransition(step.on[stepRun.result]) : "—"}</dd>
        <dt className="text-muted-foreground">Created</dt><dd>{formatDate(stepRun.createdAt)}</dd>
        <dt className="text-muted-foreground">Updated</dt><dd>{formatDate(stepRun.updatedAt)}</dd>
        {stepRun.completedAt ? <><dt className="text-muted-foreground">Completed</dt><dd>{formatDate(stepRun.completedAt)}</dd></> : null}
      </dl>
      {stepRun.error ? <p className="mt-3 border-t border-divider-strong pt-3 font-mono text-[0.65rem] text-destructive">{stepRun.error}</p> : null}
      {stepRun.outcome ? (
        <section className="mt-3 grid gap-2 border-t border-divider-strong pt-3" aria-label="Structured outcome">
          <div className="flex items-center gap-2"><h4 className="font-medium">Structured outcome</h4><Badge {...outcomeBadge}>{formatOutcome(stepRun.outcome)}</Badge></div>
          <p className="text-muted-foreground">{stepRun.outcome.summary}</p>
          {stepRun.outcome.checks.length ? <ul className="grid gap-1 font-mono text-[0.65rem]">{stepRun.outcome.checks.map((check) => <li key={check.name} className="flex justify-between gap-3"><span>{check.name}</span><span>{check.status}</span></li>)}</ul> : null}
          {stepRun.outcome.artifacts?.changed_files?.length ? <p className="flex items-start gap-1.5 break-words font-mono text-[0.62rem] text-muted-foreground"><GitCompare className="mt-0.5 size-3 shrink-0" />{stepRun.outcome.artifacts.changed_files.join(" · ")}</p> : null}
        </section>
      ) : null}
      {stepRun.responseInput ? (
        <div className="mt-3 border-t border-divider-strong pt-3">
          <p className="mb-1 text-muted-foreground">Human response</p>
          <pre className="whitespace-pre-wrap font-mono text-[0.65rem]">{stepRun.responseInput}</pre>
        </div>
      ) : null}
      {awaitsStepResponse(stepRun) ? (
        <div className="-mx-3 mt-3"><StepResponsePanel stepRun={stepRun} pending={pending} onRespond={onRespond} /></div>
      ) : null}
    </div>
  );
}

const formatDate = (value: string) => new Date(value).toLocaleString();

const formatTransition = (target: StepTransitionTarget) =>
  typeof target === "string" ? `Node · ${target}` : `Loop · ${target.loop}`;

const formatOutcome = (outcome: AgentOutcome) =>
  outcome.state === "completed" ? `${outcome.state} · ${outcome.result}` : outcome.state;

const outcomeBadgePresentation = (outcome?: AgentOutcome) => {
  if (outcome?.state === "failed" || outcome?.state === "blocked") return { variant: "destructive" as const };
  if (outcome?.state === "needs_input") {
    return { variant: "outline" as const, className: "border-tertiary/30 text-tertiary" };
  }
  return { variant: "secondary" as const };
};

const awaitsStepResponse = (stepRun: StepRun) =>
  (stepRun.type === "human" && stepRun.status === "waiting_for_human")
  || (stepRun.type === "agent" && stepRun.status === "needs_input");
