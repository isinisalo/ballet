import { useEffect, useMemo, useState } from "react";
import type { ProjectAutomationConfig, ProjectLoop } from "@shared/api/workspace-contracts";
import { CirclePlus, Radio, Square } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CodexRunConsole } from "./CodexRunConsole";
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
  controller,
  startDisabledReason
}: {
  config: ProjectAutomationConfig;
  loop: ProjectLoop;
  controller: LoopRunController;
  startDisabledReason?: string;
}) {
  const { details, pendingOperation, error, streamStatus, start, respond, cancel, acceptDetails } = controller;
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
        <LoopCanvas config={config} loop={canvasLoop} run={details} selectedStepId={selectedStepRun?.stepId} readOnly onStepSelect={(stepId) => setSelectedStepRunId([...((details?.stepRuns) ?? [])].reverse().find((stepRun) => stepRun.stepId === stepId)?.stepRunId)} />
        <LoopHandlerSheet
          open={Boolean(selectedStepRun && selectedStep && details)}
          title="StepRun console"
          onOpenChange={(open) => { if (!open) setSelectedStepRunId(undefined); }}
          left={selectedStepRun && details ? <CodexRunConsole run={details} stepRun={selectedStepRun} onRun={acceptDetails} /> : null}
          right={selectedStepRun && selectedStep ? <LoopRunStepPanel step={selectedStep} stepRun={selectedStepRun} pending={busy} onRespond={(stepRunId, result, input) => respond(stepRunId, { result, input })} /> : null}
        />
      </div>
      {details ? (
        <div className="grid gap-2 border-t border-divider-strong bg-card px-4 py-3 font-mono text-[0.65rem] text-muted-foreground sm:grid-cols-3">
          <span>source: {details.source}</span>
          <span>loop transitions: {details.transitionCount}/20</span>
          <span>updated: {new Date(details.updatedAt).toLocaleString()}</span>
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
      {(!details || (terminal && showNewRun)) ? <LoopRunStartPanel disabledReason={startDisabledReason} pending={busy} onStart={start} /> : null}
    </div>
  );
}
