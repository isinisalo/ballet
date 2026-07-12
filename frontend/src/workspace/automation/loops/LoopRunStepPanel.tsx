import type { ProjectStep, StepRun, StepTransitionTarget } from "@shared/api/workspace-contracts";
import { GitCompare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { HumanGateRunPanel } from "./HumanGateRunPanel";

export function LoopRunStepPanel({ step, stepRun, pending, onRespond }: {
  step: ProjectStep;
  stepRun: StepRun;
  pending: boolean;
  onRespond: (stepRunId: string, result: "approved" | "rejected", input: string) => Promise<boolean>;
}) {
  return (
    <div aria-label="StepRun details" className="min-w-0 px-3 py-3 text-xs">
      <dl className="grid grid-cols-[5rem_minmax(0,1fr)] gap-x-2 gap-y-2 font-mono text-[0.65rem]">
        <dt className="text-muted-foreground">Type</dt><dd>{step.type}</dd>
        <dt className="text-muted-foreground">Agent</dt><dd className="break-words">{stepRun.agentId ?? "Human operator"}</dd>
        {stepRun.execution ? <>
          <dt className="text-muted-foreground">Runtime</dt><dd className="break-words">{stepRun.execution.deviceName} · {stepRun.execution.provider}</dd>
          <dt className="text-muted-foreground">Model</dt><dd className="break-all">{stepRun.execution.model}</dd>
          <dt className="text-muted-foreground">Reasoning</dt><dd>{stepRun.execution.reasoning}</dd>
        </> : null}
        <dt className="text-muted-foreground">Attempt</dt><dd>{stepRun.attempt}</dd>
        <dt className="text-muted-foreground">Result</dt><dd>{stepRun.result ?? "—"}</dd>
        <dt className="text-muted-foreground">Transition</dt><dd>{stepRun.result && step.type !== "scheduled" ? formatTransition(step.on[stepRun.result]) : "—"}</dd>
        <dt className="text-muted-foreground">Created</dt><dd>{formatDate(stepRun.createdAt)}</dd>
        <dt className="text-muted-foreground">Updated</dt><dd>{formatDate(stepRun.updatedAt)}</dd>
        {stepRun.completedAt ? <><dt className="text-muted-foreground">Completed</dt><dd>{formatDate(stepRun.completedAt)}</dd></> : null}
      </dl>
      {stepRun.error ? <p className="mt-3 border-t border-divider-strong pt-3 font-mono text-[0.65rem] text-destructive">{stepRun.error}</p> : null}
      {stepRun.outcome ? (
        <section className="mt-3 grid gap-2 border-t border-divider-strong pt-3" aria-label="Structured outcome">
          <div className="flex items-center gap-2"><h4 className="font-medium">Structured outcome</h4><Badge variant={stepRun.outcome.outcome === "failed" || stepRun.outcome.outcome === "blocked" ? "destructive" : "secondary"}>{stepRun.outcome.outcome}</Badge></div>
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
      {stepRun.type === "human" && stepRun.status === "waiting_for_human" ? (
        <div className="-mx-3 mt-3"><HumanGateRunPanel stepRun={stepRun} pending={pending} onRespond={onRespond} /></div>
      ) : null}
    </div>
  );
}

const formatDate = (value: string) => new Date(value).toLocaleString();

const formatTransition = (target: StepTransitionTarget) =>
  typeof target === "string" ? `Step · ${target}` : "loop" in target ? `Loop · ${target.loop}` : `End · ${target.end}`;
