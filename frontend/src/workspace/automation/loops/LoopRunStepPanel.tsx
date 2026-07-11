import type { ProjectStep, StepRun } from "@shared/api/workspace-contracts";
import { Bot, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { HumanGateRunPanel } from "./HumanGateRunPanel";

export function LoopRunStepPanel({ step, stepRun, pending, onRespond }: {
  step: ProjectStep;
  stepRun: StepRun;
  pending: boolean;
  onRespond: (stepRunId: string, result: "approved" | "rejected", input: string) => Promise<boolean>;
}) {
  const Icon = step.type === "human" ? ShieldCheck : Bot;
  return (
    <aside aria-label="StepRun details" className="min-w-0 overflow-y-auto px-3 pt-9 pb-2.5 text-xs">
      <header className="mb-3 flex items-start justify-between gap-3 border-b border-divider-strong pb-2">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="size-3.5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <h3 className="truncate font-mono text-xs font-medium">{step.id}</h3>
            <p className="truncate font-mono text-[0.62rem] text-muted-foreground">{stepRun.stepRunId}</p>
          </div>
        </div>
        <Badge variant={stepRun.status === "failed" ? "destructive" : stepRun.status === "completed" ? "secondary" : "outline"}>{stepRun.status}</Badge>
      </header>
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
        <dt className="text-muted-foreground">Transition</dt><dd>{stepRun.result ? formatTransition(step.on[stepRun.result]) : "—"}</dd>
        <dt className="text-muted-foreground">Created</dt><dd>{formatDate(stepRun.createdAt)}</dd>
        <dt className="text-muted-foreground">Updated</dt><dd>{formatDate(stepRun.updatedAt)}</dd>
        {stepRun.completedAt ? <><dt className="text-muted-foreground">Completed</dt><dd>{formatDate(stepRun.completedAt)}</dd></> : null}
      </dl>
      {stepRun.error ? <p className="mt-3 border-t border-divider-strong pt-3 font-mono text-[0.65rem] text-destructive">{stepRun.error}</p> : null}
      {stepRun.responseInput ? (
        <div className="mt-3 border-t border-divider-strong pt-3">
          <p className="mb-1 text-muted-foreground">Human response</p>
          <pre className="whitespace-pre-wrap font-mono text-[0.65rem]">{stepRun.responseInput}</pre>
        </div>
      ) : null}
      {stepRun.type === "human" && stepRun.status === "waiting_for_human" ? (
        <div className="-mx-3 mt-3"><HumanGateRunPanel stepRun={stepRun} pending={pending} onRespond={onRespond} /></div>
      ) : null}
    </aside>
  );
}

const formatDate = (value: string) => new Date(value).toLocaleString();

const formatTransition = (target: ProjectStep["on"]["approved"]) =>
  typeof target === "string" ? `Step · ${target}` : "loop" in target ? `Loop · ${target.loop}` : `End · ${target.end}`;
