import { CirclePlus, Play, Square } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ExecutionTask, RootRunDetail } from "@shared/api/workspace-contracts";
import { OperationalStatus, TextAreaField } from "@/components/shared/workspace-ui";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CliRunConsole } from "../../components/CliRunConsole";
import { changedFilesLabel, runStatusTone } from "../../runs/runPresentation";
import { AgentRunDetails } from "./AgentRunDetails";
import { AgentRunInstructions } from "./AgentRunInstructions";
import { activeAgentRunStatuses, useAgentRun } from "./useAgentRun";

const activeRootStatuses = new Set(["queued", "running", "waiting_for_human", "finalizing"]);

export function AgentRunPane({ agentId, rootRunId, rootDetail, disabledReason, onRootRunChange }: { agentId: string; rootRunId?: string; rootDetail?: RootRunDetail; disabledReason?: string; onRootRunChange?: (rootRunId: string) => void }) {
  const controller = useAgentRun(agentId, rootRunId ?? rootDetail?.rootRunId, rootDetail);
  const [input, setInput] = useState("");
  const [showNewRun, setShowNewRun] = useState(false);
  const detail = controller.detail ?? rootDetail;
  const task = selectedAgentTask(detail);
  const taskActive = Boolean(task && activeAgentRunStatuses.has(task.status));
  const rootActive = Boolean(detail && activeRootStatuses.has(detail.status));
  const terminal = Boolean(detail && !rootActive);
  const busy = controller.operation !== null;

  useEffect(() => setShowNewRun(false), [detail?.rootRunId]);
  const start = async () => {
    const next = await controller.start(input);
    if (next) { setInput(""); onRootRunChange?.(next.rootRunId); }
  };

  return (
    <section className="grid min-w-0" aria-label="Agent run">
      <RunHeader detail={detail} task={task} />
      {controller.error ? <Alert variant="destructive" className="m-4 mb-0"><AlertDescription>{controller.error}</AlertDescription></Alert> : null}
      {detail && task ? <RunOutput agentId={agentId} detail={detail} task={task} active={taskActive} onTerminal={() => void controller.refresh()} /> : null}
      <RunControls active={rootActive} terminal={terminal} showNewRun={showNewRun} busy={busy} cancelling={controller.operation === "cancel"} onCancel={() => void controller.cancel()} onNew={() => setShowNewRun(true)} />
      {!detail || (terminal && showNewRun) ? <RunStart input={input} busy={busy} starting={controller.operation === "start"} disabledReason={disabledReason} onInput={setInput} onStart={start} /> : null}
    </section>
  );
}

const selectedAgentTask = (detail?: RootRunDetail): ExecutionTask | undefined => detail?.tasks.find((task) => task.id === detail.current?.taskId) ?? [...(detail?.tasks ?? [])].reverse().find((task) => task.kind === "agent_run");

function RunHeader({ detail, task }: { detail?: RootRunDetail; task?: ExecutionTask }) {
  return <header className="flex min-h-12 flex-wrap items-center justify-between gap-3 border-b border-divider-strong bg-card px-4 py-2.5"><div className="flex min-w-0 items-center gap-2"><span className="font-mono text-xs">{detail?.rootRunId ?? "No runs"}</span>{detail ? <OperationalStatus compact label={detail.status} tone={runStatusTone(detail.status)} /> : null}</div>{task ? <span className="font-mono text-[0.62rem] text-muted-foreground">{detail?.source ?? "manual"} · {task.spec.runtime.hostname} · {task.spec.runtime.provider} · {task.spec.runtime.model}</span> : null}</header>;
}

function RunOutput({ agentId, detail, task, active, onTerminal }: { agentId: string; detail: RootRunDetail; task: ExecutionTask; active: boolean; onTerminal: () => void }) {
  const report = detail.finalization?.report;
  const refresh = () => { onTerminal(); window.setTimeout(onTerminal, 750); window.setTimeout(onTerminal, 2_000); };
  return <div className="grid min-h-[32rem] md:grid-cols-2"><AgentRunInstructions task={task} agentId={agentId} /><div className="min-w-0 overflow-y-auto p-3"><CliRunConsole taskId={task.id} provider={task.spec.runtime.provider} active={active} onTerminal={refresh} /><AgentRunDetails detail={detail} task={task} />{report ? <p className="border-t border-divider-strong bg-panel-section p-3 font-mono text-[0.65rem] text-muted-foreground">finalization: {report.commitSha ? `commit ${report.commitSha}` : report.retained ? `retained ${report.worktreePath}` : "reported"} · {changedFilesLabel(report.changedFiles)}</p> : null}{detail.errorMessage || task.errorMessage ? <p className="border-t border-divider-strong bg-destructive/5 p-3 font-mono text-[0.68rem] text-destructive">{detail.errorCode ?? task.errorCode ? `${detail.errorCode ?? task.errorCode}: ` : ""}{detail.errorMessage ?? task.errorMessage}</p> : null}</div></div>;
}

function RunControls({ active, terminal, showNewRun, busy, cancelling, onCancel, onNew }: { active: boolean; terminal: boolean; showNewRun: boolean; busy: boolean; cancelling: boolean; onCancel: () => void; onNew: () => void }) {
  if (active) return <div className="flex justify-end p-4"><Button type="button" variant="destructive" disabled={busy} onClick={onCancel}><Square /> {cancelling ? "Cancelling…" : "Cancel"}</Button></div>;
  if (terminal && !showNewRun) return <div className="flex justify-end p-4"><Button type="button" variant="outline" onClick={onNew}><CirclePlus /> New run</Button></div>;
  return null;
}

function RunStart({ input, busy, starting, disabledReason, onInput, onStart }: { input: string; busy: boolean; starting: boolean; disabledReason?: string; onInput: (value: string) => void; onStart: () => Promise<void> }) {
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const blocked = Boolean(disabledReason);
  const pending = busy || submitting;
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current || busy || blocked) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await onStart();
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <form
      className="grid gap-3 border-t border-divider-strong bg-card p-4"
      aria-label="Start agent run"
      onSubmit={(event) => void submit(event)}
      onKeyDown={(event) => {
        if (event.target instanceof HTMLTextAreaElement && event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
          event.preventDefault();
          event.currentTarget.requestSubmit();
        }
      }}
    >
      <TextAreaField label="Run input (optional)" density="compact" rows={4} disabled={pending || blocked} value={input} onChange={onInput} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          <p>{disabledReason ?? "Starts an isolated Run from the saved agent and local execution configuration."}</p>
          {disabledReason ? <a href="/runtimes" className="mt-1 inline-block text-primary underline-offset-4 hover:underline">Open Runtimes</a> : null}
        </div>
        <Button type="submit" disabled={pending || blocked}><Play /> {starting || submitting ? "Starting…" : "Start"}</Button>
      </div>
    </form>
  );
}
