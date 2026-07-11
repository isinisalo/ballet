import { CirclePlus, Play, Square } from "lucide-react";
import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CliRunConsole } from "../../components/CliRunConsole";
import { AgentRunDetails } from "./AgentRunDetails";
import { useAgentRunAvailability } from "./useAgentRunAvailability";
import { activeAgentRunStatuses, useAgentRun } from "./useAgentRun";

export function AgentRunPane({ agentId, disabledReason }: { agentId: string; disabledReason?: string }) {
  const controller = useAgentRun(agentId);
  const discoveredDisabledReason = useAgentRunAvailability(agentId, !disabledReason);
  const [input, setInput] = useState("");
  const [showNewRun, setShowNewRun] = useState(false);
  const run = controller.run;
  const active = Boolean(run && activeAgentRunStatuses.has(run.status));
  const terminal = Boolean(run && !active);
  const busy = controller.operation !== null;
  const startDisabledReason = disabledReason ?? discoveredDisabledReason;

  useEffect(() => setShowNewRun(false), [run?.id]);
  const start = async () => {
    if (await controller.start(input)) setInput("");
  };

  return (
    <section className="grid min-w-0" aria-label="Agent run">
      <RunHeader run={run} />
      {controller.error ? <Alert variant="destructive" className="m-4 mb-0"><AlertDescription>{controller.error}</AlertDescription></Alert> : null}
      {run ? <RunOutput run={run} active={active} onRunEvent={controller.acceptRunEvent} onTerminal={() => void controller.refresh()} /> : null}
      <RunControls active={active} terminal={terminal} showNewRun={showNewRun} busy={busy} cancelling={controller.operation === "cancel"} onCancel={() => void controller.cancel()} onNew={() => setShowNewRun(true)} />
      {!run || (terminal && showNewRun) ? <RunStart input={input} busy={busy} starting={controller.operation === "start"} disabledReason={startDisabledReason} onInput={setInput} onStart={() => void start()} /> : null}
    </section>
  );
}

function RunHeader({ run }: { run: ReturnType<typeof useAgentRun>["run"] }) {
  return <header className="flex min-h-12 flex-wrap items-center justify-between gap-3 border-b border-divider-strong bg-card px-4 py-2.5"><div className="flex min-w-0 items-center gap-2"><span className="font-mono text-xs">{run?.id ?? "No runs"}</span>{run ? <StatusBadge status={run.status} /> : null}</div>{run ? <span className="font-mono text-[0.62rem] text-muted-foreground">{run.runtime.deviceName} · {run.runtime.provider} · {run.runtime.model}</span> : null}</header>;
}

function RunOutput({ run, active, onRunEvent, onTerminal }: { run: NonNullable<ReturnType<typeof useAgentRun>["run"]>; active: boolean; onRunEvent: (payload: unknown) => void; onTerminal: () => void }) {
  const refreshThroughFinalization = () => {
    onTerminal();
    window.setTimeout(onTerminal, 750);
    window.setTimeout(onTerminal, 2_000);
  };
  return <div className="grid gap-0 p-4 pb-0"><CliRunConsole taskId={run.taskId} provider={run.runtime.provider} active={active} onRunEvent={onRunEvent} onTerminal={refreshThroughFinalization} /><AgentRunDetails run={run} />{run.errorMessage ? <p className="border-t border-divider-strong bg-destructive/5 p-3 font-mono text-[0.68rem] text-destructive">{run.errorCode ? `${run.errorCode}: ` : ""}{run.errorMessage}</p> : null}</div>;
}

function RunControls({ active, terminal, showNewRun, busy, cancelling, onCancel, onNew }: { active: boolean; terminal: boolean; showNewRun: boolean; busy: boolean; cancelling: boolean; onCancel: () => void; onNew: () => void }) {
  if (active) return <div className="flex justify-end p-4"><Button type="button" variant="destructive" disabled={busy} onClick={onCancel}><Square /> {cancelling ? "Cancelling…" : "Cancel"}</Button></div>;
  if (terminal && !showNewRun) return <div className="flex justify-end p-4"><Button type="button" variant="outline" onClick={onNew}><CirclePlus /> New run</Button></div>;
  return null;
}

function RunStart({ input, busy, starting, disabledReason, onInput, onStart }: { input: string; busy: boolean; starting: boolean; disabledReason?: string; onInput: (value: string) => void; onStart: () => void }) {
  return <div className="grid gap-3 border-t border-divider-strong bg-card p-4"><label className="grid gap-1.5 text-xs"><span className="font-medium">Run input (optional)</span><Textarea rows={4} disabled={busy || Boolean(disabledReason)} value={input} onChange={(event) => onInput(event.target.value)} /></label><div className="flex flex-wrap items-center justify-between gap-3"><div className="text-xs text-muted-foreground"><p>{disabledReason ?? "Starts an isolated run from the saved agent and execution binding."}</p>{disabledReason ? <a href="/runtimes" className="mt-1 inline-block text-primary underline-offset-4 hover:underline">Open Runtimes</a> : null}</div><Button type="button" disabled={busy || Boolean(disabledReason)} onClick={onStart}><Play /> {starting ? "Starting…" : "Start"}</Button></div></div>;
}

function StatusBadge({ status }: { status: NonNullable<ReturnType<typeof useAgentRun>["run"]>["status"] }) {
  const variant = status === "failed" ? "destructive" : status === "succeeded" ? "secondary" : activeAgentRunStatuses.has(status) ? "default" : "outline";
  return <Badge variant={variant}>{status}</Badge>;
}
