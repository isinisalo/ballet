import { useEffect, useMemo, useState } from "react";
import { isProjectTerminalNode, type Agent, type AgentExecutionState, type LoopTheme, type ProjectAutomationConfig, type ProjectLoop, type ProjectStep } from "@shared/api/workspace-contracts";
import type { RootRunDetail } from "@shared/api/workspace-contracts";
import { CirclePlus, Radio, Square } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoopCanvas } from "./LoopCanvas";
import { LoopHandlerSheet } from "./LoopHandlerSheet";
import { LoopRunStartPanel } from "./LoopRunStartPanel";
import { LoopRunStepHeader, LoopRunStepInstructions, LoopRunStepOutput } from "./LoopRunStepSheet";
import { loopRunStatusVariant } from "./loopRunState";
import type { useLoopRun } from "./useLoopRun";
import { changedFilesLabel } from "../../runs/runPresentation";

type LoopRunController = ReturnType<typeof useLoopRun>;

export function LoopRunView({
  config,
  loop,
  agents,
  agentExecutionStates,
  theme,
  controller,
  rootDetail,
  onRootRunChange,
  startDisabledReason
}: {
  config: ProjectAutomationConfig;
  loop: ProjectLoop;
  agents: Agent[];
  agentExecutionStates: AgentExecutionState[];
  theme: LoopTheme;
  controller: LoopRunController;
  rootDetail?: RootRunDetail;
  onRootRunChange?: (rootRunId: string) => void;
  startDisabledReason?: string;
}) {
  const { details, preflight, pendingOperation, error, streamStatus, start, respond, cancel, refresh } = controller;
  const [newRunFromRunId, setNewRunFromRunId] = useState<string>();
  const [selectedStepRunId, setSelectedStepRunId] = useState<string | undefined>();
  const busy = pendingOperation !== null;
  const rootActive = rootDetail && ["queued", "running", "waiting_for_human", "finalizing"].includes(rootDetail.status);
  const terminal = details && (rootDetail ? !rootActive : !["running", "waiting_for_human"].includes(details.status));
  const canvasLoop = details?.snapshot ?? loop;
  const selectedStepRun = useMemo(() => details?.stepRuns.find((stepRun) => stepRun.stepRunId === selectedStepRunId), [details?.stepRuns, selectedStepRunId]);
  const selectedStep = canvasLoop.nodes.find((step): step is ProjectStep =>
    step.id === selectedStepRun?.stepId && !isProjectTerminalNode(step));
  const selectedTask = rootDetail?.tasks.find((task) => task.id === selectedStepRun?.executionTaskId);
  const selectedAgentSnapshot = selectedTask?.spec.agent ?? details?.executionPlan?.steps.find((snapshot) =>
    snapshot.loopId === selectedStepRun?.loopId
      && snapshot.stepId === selectedStepRun.stepId
      && snapshot.agentId === selectedStepRun.agentId)?.agent;
  const displayStatus = rootDetail?.status ?? details?.status;
  const showNewRun = details?.runId === newRunFromRunId;
  const startRun = async (input: string) => {
    const next = await start(input);
    if (next) onRootRunChange?.(next.rootRunId);
    return Boolean(next);
  };

  useEffect(() => {
    const stepRuns = details?.stepRuns ?? [];
    const active = [...stepRuns].reverse().find((stepRun) => ["queued", "running", "waiting_for_human"].includes(stepRun.status));
    const latest = stepRuns.at(-1);
    setSelectedStepRunId(active?.stepRunId ?? latest?.stepRunId);
  }, [details?.runId, details?.stepRuns.at(-1)?.stepRunId, details?.stepRuns.find((stepRun) => ["queued", "running", "waiting_for_human"].includes(stepRun.status))?.stepRunId]);

  return (
    <div className="grid min-w-0">
      <div className="flex min-h-12 flex-wrap items-center justify-between gap-3 border-b border-divider-strong bg-card px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <Radio className="size-4 text-muted-foreground" />
          <span className="font-mono text-xs">{rootDetail?.rootRunId ?? details?.rootRunId ?? "No runs"}</span>
          {displayStatus ? <Badge variant={loopRunStatusVariant(displayStatus)}>{displayStatus}</Badge> : null}
        </div>
        <span className="font-mono text-[0.65rem] text-muted-foreground">stream: {streamStatus}</span>
      </div>
      {error ? <Alert variant="destructive" className="m-4 mb-0"><AlertDescription>{error}</AlertDescription></Alert> : null}
      <div className={selectedStepRun && selectedStep && details ? "grid min-h-[28rem] min-w-0 grid-cols-1 overflow-hidden md:grid-cols-2" : "grid min-h-[28rem] min-w-0 grid-cols-1 overflow-hidden"}>
        <LoopCanvas config={config} loop={canvasLoop} agents={agents} agentExecutionStates={agentExecutionStates} theme={theme} run={details} selectedStepId={selectedStepRun?.stepId} readOnly onStepSelect={(stepId) => setSelectedStepRunId([...((details?.stepRuns) ?? [])].reverse().find((stepRun) => stepRun.stepId === stepId)?.stepRunId)} />
        <LoopHandlerSheet
          open={Boolean(selectedStepRun && selectedStep && details)}
          title="StepRun console"
          onOpenChange={(open) => { if (!open) setSelectedStepRunId(undefined); }}
          header={selectedStepRun && selectedStep ? <LoopRunStepHeader step={selectedStep} stepRun={selectedStepRun} /> : null}
          left={selectedStepRun && selectedStep ? <LoopRunStepInstructions step={selectedStep} agents={agents} task={selectedTask} snapshot={selectedAgentSnapshot} /> : null}
          right={selectedStepRun && selectedStep ? <LoopRunStepOutput step={selectedStep} stepRun={selectedStepRun} task={selectedTask} pending={busy} onTerminal={() => void refresh()} onRespond={async (stepRunId, request) => Boolean(await respond(stepRunId, request))} /> : null}
        />
      </div>
      {details ? (
        <div className="grid gap-2 border-t border-divider-strong bg-card px-4 py-3 font-mono text-[0.65rem] text-muted-foreground sm:grid-cols-2 xl:grid-cols-4">
          <span>source: {rootDetail?.source ?? details.source}</span>
          <span>loop transitions: {details.transitionCount}</span>
          <span>updated: {new Date(details.updatedAt).toLocaleString()}</span>
          {(rootDetail?.termination ?? details.termination) ? <span>reason: {(rootDetail?.termination ?? details.termination)?.code} · {(rootDetail?.termination ?? details.termination)?.message}</span> : null}
          {rootDetail?.finalization?.report ? <span>branch: {rootDetail.finalization.report.branch}</span> : null}
          {rootDetail?.finalization?.report?.commitSha ? <span>commit: {rootDetail.finalization.report.commitSha}</span> : null}
          {rootDetail?.finalization?.report ? <span>{changedFilesLabel(rootDetail.finalization.report.changedFiles)}{rootDetail.finalization.report.retained ? ` · retained ${rootDetail.finalization.report.worktreePath}` : ""}</span> : null}
        </div>
      ) : null}
      {details && !terminal && rootDetail?.status !== "finalizing" ? (
        <div className="flex justify-end border-t border-divider-strong bg-card p-4">
          <Button type="button" variant="destructive" disabled={busy} onClick={() => void cancel()}>
            <Square /> {pendingOperation === "cancel" ? "Cancelling…" : "Cancel"}
          </Button>
        </div>
      ) : null}
      {terminal && !showNewRun ? (
        <div className="flex justify-end border-t border-divider-strong bg-card p-4">
          <Button type="button" variant="outline" disabled={busy} onClick={() => setNewRunFromRunId(details.runId)}><CirclePlus /> New run</Button>
        </div>
      ) : null}
      {(!details || (terminal && showNewRun)) ? (
        <LoopRunStartPanel
          bypassesSchedule={loop.nodes.find((step) => step.id === loop.start)?.type === "scheduled"}
          disabledReason={startDisabledReason}
          preflightIssues={preflight?.issues}
          pending={busy}
          onStart={startRun}
        />
      ) : null}
    </div>
  );
}
