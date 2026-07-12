import { useCallback, useEffect, useMemo, useState } from "react";
import type { LoopRunDetails, RespondToStepRunRequest, RootRunDetail, RunTarget, RuntimePreflightIssue } from "@shared/api/workspace-contracts";
import { toErrorMessage } from "@/lib/errors";
import type { AppStreamStatus } from "@/app/useAppStream";
import { runApi } from "../../runs/runApi";

export type LoopRunPendingOperation = "load" | "start" | "respond" | "cancel" | null;

export function useLoopRun(loopId: string | undefined, refreshSignal: string, streamStatus: AppStreamStatus, rootRunId?: string, target?: RunTarget) {
  const [details, setDetails] = useState<LoopRunDetails | null>(null);
  const [rootDetail, setRootDetail] = useState<RootRunDetail>();
  const [pendingOperation, setPendingOperation] = useState<LoopRunPendingOperation>("load");
  const [error, setError] = useState("");
  const selectedRootRunId = rootRunId ?? target?.activeRootRunId ?? target?.latestRootRunId;
  const preflight = useMemo(() => target ? {
    ok: target.ready,
    issues: target.issues.map((issue): RuntimePreflightIssue => ({
      agentId: issue.agentId ?? "loop",
      stepId: issue.stepId,
      code: runtimeIssueCode(issue.code),
      message: issue.message
    })),
    snapshots: []
  } : undefined, [target]);

  const applyRoot = useCallback((root?: RootRunDetail) => {
    setRootDetail(root);
    setDetails(root ? selectedLoopRun(root) : null);
    return root ? selectedLoopRun(root) : null;
  }, []);

  const refresh = useCallback(async () => {
    if (!loopId || !selectedRootRunId) { applyRoot(undefined); setPendingOperation(null); return; }
    try { applyRoot(await runApi.detail(selectedRootRunId)); setError(""); }
    catch (cause) { setError(toErrorMessage(cause, "Unable to load the Loop Run.")); }
    finally { setPendingOperation((current) => current === "load" ? null : current); }
  }, [applyRoot, loopId, selectedRootRunId]);

  useEffect(() => { setPendingOperation("load"); applyRoot(undefined); void refresh(); }, [applyRoot, refresh, refreshSignal]);
  useEffect(() => {
    if (!details || !["running", "waiting_for_human"].includes(details.status)) return;
    const timer = window.setInterval(() => { void refresh(); }, 2_000);
    return () => window.clearInterval(timer);
  }, [details, refresh]);

  const mutate = useCallback(async (operation: Exclude<LoopRunPendingOperation, "load" | null>, request: () => Promise<RootRunDetail>) => {
    setPendingOperation(operation);
    setError("");
    try { return applyRoot(await request()); }
    catch (cause) { setError(toErrorMessage(cause, `Unable to ${operation} Loop Run.`)); void refresh(); return null; }
    finally { setPendingOperation(null); }
  }, [applyRoot, refresh]);

  const start = useCallback(async (input: string) => {
    if (!loopId || !preflight?.ok) return false;
    return mutate("start", () => runApi.start("loop", loopId, input));
  }, [loopId, mutate, preflight?.ok]);
  const respond = useCallback(async (stepRunId: string, request: RespondToStepRunRequest) => {
    if (!rootDetail) return false;
    return mutate("respond", () => runApi.respond(rootDetail.rootRunId, stepRunId, request));
  }, [mutate, rootDetail]);
  const cancel = useCallback(async () => {
    if (!rootDetail) return false;
    return mutate("cancel", () => runApi.cancel(rootDetail));
  }, [mutate, rootDetail]);

  return { details, rootDetail, preflight, preflightLoading: false, pendingOperation, error, streamStatus, refresh, refreshPreflight: async () => undefined, start, respond, cancel };
}

const selectedLoopRun = (root: RootRunDetail) => root.loopRuns.find((run) => run.runId === root.current?.loopRunId) ?? [...root.loopRuns].reverse()[0] ?? null;
const runtimeIssueCode = (code: RunTarget["issues"][number]["code"]): RuntimePreflightIssue["code"] =>
  code === "invalid_config" || code === "disabled" || code === "missing_agent" ? "invalid_runtime_config" : code;
