import type { ProjectStep, RespondToStepRunRequest, StepRun, StepRunTransition } from "@shared/api/workspace-contracts";
import { GitCompare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AgentInputRunPanel } from "./AgentInputRunPanel";
import { HumanGateRunPanel } from "./HumanGateRunPanel";

export function LoopRunStepPanel({ step, stepRun, pending, onRespond }: {
  step: ProjectStep;
  stepRun: StepRun;
  pending: boolean;
  onRespond: (stepRunId: string, request: RespondToStepRunRequest) => Promise<boolean>;
}) {
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
        <dt className="text-muted-foreground">{stepRun.type === "human" ? "Human decision" : "Agent outcome"}</dt><dd>{formatResult(stepRun)}</dd>
        <dt className="text-muted-foreground">Routing</dt><dd>{formatTransition(stepRun.transition)}</dd>
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
          <p className="mb-1 text-muted-foreground">{stepRun.type === "human" ? "Human response" : "Provided input"}</p>
          <pre className="whitespace-pre-wrap font-mono text-[0.65rem]">{stepRun.responseInput}</pre>
        </div>
      ) : null}
      <StepRunResponseControl stepRun={stepRun} pending={pending} onRespond={onRespond} />
    </div>
  );
}

function StepRunResponseControl({ stepRun, pending, onRespond }: {
  stepRun: StepRun;
  pending: boolean;
  onRespond: (stepRunId: string, request: RespondToStepRunRequest) => Promise<boolean>;
}) {
  if (stepRun.type === "human" && stepRun.status === "waiting_for_human") {
    return <div className="-mx-3 mt-3"><HumanGateRunPanel
      stepRun={stepRun}
      pending={pending}
      onRespond={(stepRunId, decision, input) => onRespond(stepRunId, {
        kind: "human-decision",
        decision,
        input
      })}
    /></div>;
  }
  if (stepRun.type === "agent" && stepRun.status === "waiting_for_human"
    && stepRun.outcome?.outcome === "needs_input" && stepRun.transition?.action === "wait") {
    return <div className="-mx-3 mt-3"><AgentInputRunPanel stepRun={stepRun} pending={pending} onRespond={onRespond} /></div>;
  }
  return null;
}

const formatDate = (value: string) => new Date(value).toLocaleString();

const formatResult = (stepRun: StepRun) => stepRun.result
  ? stepRun.result.kind === "agent" ? stepRun.result.outcome : stepRun.result.decision
  : "—";

const formatTransition = (transition: StepRunTransition | undefined) => {
  if (!transition) return "—";
  if (transition.action === "wait") return "Wait · human input";
  if (transition.action === "terminate") return `Terminate · ${transition.status} · ${transition.code}`;
  const target = transition.target;
  const label = typeof target === "string" ? `Node · ${target}` : `Loop · ${target.loop}`;
  if (transition.action === "repair") return `Repair ${transition.repairAttempt} · ${label}`;
  if (transition.action === "retry") return `Transient retry ${transition.retryAttempt} · ${label}`;
  if (transition.action === "resume") return `Resume · ${label}`;
  if (transition.action === "human") return `Human decision · ${label}`;
  return label;
};
