import type {
  ExecutionProfile,
  LoopTheme,
  ProjectAutomationConfig,
  ProjectLoop,
  RootRunDetail
} from "@shared/api/workspace-contracts";
import { Radio, Square } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoopCanvas } from "./LoopCanvas";
import { LoopRunStartPanel } from "./LoopRunStartPanel";
import { NodeRunResponsePanel } from "./NodeRunResponsePanel";
import { loopRunStatusVariant } from "./loopRunState";
import { resolveLoopRunView } from "./loopRunViewModel";
import type { useLoopRun } from "./useLoopRun";

type LoopRunController = ReturnType<typeof useLoopRun>;

export function LoopRunView({
  config,
  loop,
  executionProfiles,
  theme,
  controller,
  rootDetail,
  onRootRunChange,
  startDisabledReason
}: {
  config: ProjectAutomationConfig;
  loop: ProjectLoop;
  executionProfiles: ExecutionProfile[];
  theme: LoopTheme;
  controller: LoopRunController;
  rootDetail?: RootRunDetail;
  onRootRunChange?: (rootRunId: string) => void;
  startDisabledReason?: string;
}) {
  const { details, preflight, pendingOperation, error, streamStatus, start, respond, cancel } = controller;
  const busy = pendingOperation !== null;
  const view = resolveLoopRunView(config, loop, executionProfiles, theme, details, rootDetail);
  const responseNode = view.responseNode;

  const startRun = async (input: string) => {
    const next = await start(input);
    if (next) onRootRunChange?.(next.rootRunId);
    return Boolean(next);
  };

  return (
    <div className="grid min-w-0">
      <div className="flex min-h-12 flex-wrap items-center justify-between gap-3 border-b border-divider-strong bg-card px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <Radio className="size-4 text-muted-foreground" />
          <span className="font-mono text-xs">{rootDetail?.rootRunId ?? "No runs"}</span>
          {view.displayStatus ? <Badge variant={loopRunStatusVariant(view.displayStatus)}>{view.displayStatus}</Badge> : null}
        </div>
        <span className="font-mono text-[0.65rem] text-muted-foreground">stream: {streamStatus}</span>
      </div>
      {startDisabledReason ? (
        <Alert className="m-4 mb-0"><AlertDescription>{startDisabledReason}</AlertDescription></Alert>
      ) : null}
      {error ? <Alert variant="destructive" className="m-4 mb-0"><AlertDescription>{error}</AlertDescription></Alert> : null}
      <div className="grid min-h-[28rem] min-w-0 overflow-hidden">
        <LoopCanvas
          config={view.canvasConfig}
          loop={view.canvasLoop}
          executionProfiles={view.canvasProfiles}
          theme={view.canvasTheme}
          run={details}
          readOnly
        />
      </div>
      {responseNode ? (
        <NodeRunResponsePanel
          key={responseNode.nodeRunId}
          node={responseNode}
          pending={busy}
          onRespond={(request) => respond(responseNode.nodeRunId, request).then(Boolean)}
        />
      ) : null}
      {details && view.rootActive && rootDetail?.status !== "finalizing" ? (
        <div className="flex justify-end border-t border-divider-strong bg-card p-4">
          <Button type="button" variant="destructive" disabled={busy} onClick={() => void cancel()}>
            <Square /> {pendingOperation === "cancel" ? "Cancelling…" : "Cancel"}
          </Button>
        </div>
      ) : null}
      {!details || view.terminal ? (
        <LoopRunStartPanel
          bypassesSchedule={view.bypassesSchedule}
          disabledReason={startDisabledReason}
          preflightIssues={preflight?.issues}
          pending={busy}
          onStart={startRun}
        />
      ) : null}
    </div>
  );
}
