import { useEffect, useMemo, useState } from "react";
import type { Agent, AgentExecutionState, ProjectAutomationConfig, ProjectLoop } from "@shared/api/workspace-contracts";
import { CirclePlus, Radio, Square } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CliRunConsole } from "../../components";
import { LoopCanvas } from "./LoopCanvas";
import { LoopHandlerSheet } from "./LoopHandlerSheet";
import { LoopRunStartPanel } from "./LoopRunStartPanel";
import { LoopRunStepPanel } from "./LoopRunStepPanel";
import { loopRunStatusVariant } from "./loopRunState";
import type { useLoopRun } from "./useLoopRun";

type LoopRunController = ReturnType<typeof useLoopRun>;

export function LoopRunView({
  config,
  loop,
  agents,
  agentExecutionStates,
  controller,
  startDisabledReason
}: {
  config: ProjectAutomationConfig;
  loop: ProjectLoop;
  agents: Agent[];
  agentExecutionStates: AgentExecutionState[];
  controller: LoopRunController;
  startDisabledReason?: string;
}) {
  const { details, preflight, preflightLoading, pendingOperation, error, streamStatus, start, respond, cancel, refresh } = controller;
  const [showNewRun, setShowNewRun] = useState(false);
  const [selectedStepRunId, setSelectedStepRunId] = useState<string | undefined>();
  const busy = pendingOperation !== null;
  const terminal = details && !["running", "waiting_for_human"].includes(details.status);
  const canvasLoop = details?.snapshot ?? loop;
  const selectedStepRun = useMemo(() => details?.stepRuns.find((stepRun) => stepRun.stepRunId === selectedStepRunId), [details?.stepRuns, selectedStepRunId]);
  const selectedStep = canvasLoop.steps.find((step) => step.id === selectedStepRun?.stepId);

  useEffect(() => setShowNewRun(false), [details?.runId]);
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
          <span className="font-mono text-xs">{details?.runId ?? "No runs"}</span>
          {details ? <Badge variant={loopRunStatusVariant(details.status)}>{details.status}</Badge> : null}
        </div>
        <span className="font-mono text-[0.65rem] text-muted-foreground">stream: {streamStatus}</span>
      </div>
      {error ? <Alert variant="destructive" className="m-4 mb-0"><AlertDescription>{error}</AlertDescription></Alert> : null}
      <div className={selectedStepRun && selectedStep && details ? "grid min-h-[28rem] min-w-0 grid-cols-1 overflow-hidden md:grid-cols-2" : "grid min-h-[28rem] min-w-0 grid-cols-1 overflow-hidden"}>
        <LoopCanvas config={config} loop={canvasLoop} agents={agents} agentExecutionStates={agentExecutionStates} run={details} selectedStepId={selectedStepRun?.stepId} readOnly onStepSelect={(stepId) => setSelectedStepRunId([...((details?.stepRuns) ?? [])].reverse().find((stepRun) => stepRun.stepId === stepId)?.stepRunId)} />
        <LoopHandlerSheet
          open={Boolean(selectedStepRun && selectedStep && details)}
          title="StepRun console"
          onOpenChange={(open) => { if (!open) setSelectedStepRunId(undefined); }}
          left={selectedStepRun && details ? (
            <CliRunConsole
              taskId={selectedStepRun.executionTaskId}
              provider={selectedStepRun.execution?.provider}
              active={["queued", "running"].includes(selectedStepRun.status)}
              onTerminal={() => void refresh()}
            />
          ) : null}
          right={selectedStepRun && selectedStep ? <LoopRunStepPanel step={selectedStep} stepRun={selectedStepRun} pending={busy} onRespond={(stepRunId, result, input) => respond(stepRunId, { result, input })} /> : null}
        />
      </div>
      {details ? (
        <div className="grid gap-2 border-t border-divider-strong bg-card px-4 py-3 font-mono text-[0.65rem] text-muted-foreground sm:grid-cols-2 xl:grid-cols-4">
          <span>source: {details.source}</span>
          <span>loop transitions: {details.transitionCount}/20</span>
          <span>updated: {new Date(details.updatedAt).toLocaleString()}</span>
          {details.stepRuns.some((stepRun) => stepRun.executionTaskId) ? <span>branch: ballet/run/{details.rootRunId.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 12)}</span> : null}
        </div>
      ) : null}
      {details && !terminal ? (
        <div className="flex justify-end border-t border-divider-strong bg-card p-4">
          <Button type="button" variant="destructive" disabled={busy} onClick={() => void cancel()}>
            <Square /> {pendingOperation === "cancel" ? "Cancelling…" : "Cancel"}
          </Button>
        </div>
      ) : null}
      {terminal && !showNewRun ? (
        <div className="flex justify-end border-t border-divider-strong bg-card p-4">
          <Button type="button" variant="outline" disabled={busy} onClick={() => setShowNewRun(true)}><CirclePlus /> New run</Button>
        </div>
      ) : null}
      {(!details || (terminal && showNewRun)) ? (
        <LoopRunStartPanel
          disabledReason={startDisabledReason ?? (preflightLoading ? "Checking runtime readiness…" : undefined)}
          preflightIssues={preflight?.issues}
          pending={busy || preflightLoading}
          onStart={start}
        />
      ) : null}
    </div>
  );
}
