import type { Agent, ExecutionAgentSnapshot, ExecutionTask, ProjectStep, StepRun } from "@shared/api/workspace-contracts";
import { Bot, CalendarClock, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CliRunConsole } from "../../components/CliRunConsole";
import { LoopHandlerAgentInstructions } from "./LoopHandlerAgentInstructions";
import { LoopRunStepPanel } from "./LoopRunStepPanel";

export function LoopRunStepHeader({ step, stepRun }: { step: ProjectStep; stepRun: StepRun }) {
  const Icon = step.type === "human" ? ShieldCheck : step.type === "scheduled" ? CalendarClock : Bot;
  return (
    <header className="flex min-h-10 flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-xs">
      <Icon className="size-3.5 text-muted-foreground" />
      <strong className="font-mono">{step.id}</strong>
      <span className="font-mono text-[0.62rem] text-muted-foreground">{stepRun.stepRunId}</span>
      <span className="font-mono text-[0.62rem] text-muted-foreground">attempt {stepRun.attempt}</span>
      <Badge variant={stepRun.status === "failed" ? "destructive" : stepRun.status === "completed" ? "secondary" : "outline"}>{stepRun.status}</Badge>
    </header>
  );
}

export function LoopRunStepInstructions({ step, agents, task, snapshot }: { step: ProjectStep; agents: Agent[]; task?: ExecutionTask; snapshot?: ExecutionAgentSnapshot }) {
  return <LoopHandlerAgentInstructions step={step} agents={agents} snapshot={task?.spec.agent ?? snapshot} />;
}

export function LoopRunStepOutput({ step, stepRun, task, pending, onTerminal, onRespond }: {
  step: ProjectStep;
  stepRun: StepRun;
  task?: ExecutionTask;
  pending: boolean;
  onTerminal: () => void;
  onRespond: (stepRunId: string, result: "approved" | "rejected", input: string) => Promise<boolean>;
}) {
  const active = ["queued", "running"].includes(stepRun.status);
  return (
    <aside aria-label="StepRun output" className="min-w-0 overflow-y-auto bg-card">
      {step.type === "agent" ? <div className="p-3"><CliRunConsole taskId={stepRun.executionTaskId} provider={task?.spec.runtime.provider ?? stepRun.execution?.provider} active={active} onTerminal={onTerminal} /></div> : null}
      <LoopRunStepPanel step={step} stepRun={stepRun} pending={pending} onRespond={onRespond} />
    </aside>
  );
}
