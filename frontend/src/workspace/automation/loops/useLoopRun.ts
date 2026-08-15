import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LoopRunDetails, RespondToStepRunRequest, RootRunDetail, RunTarget, RuntimePreflightIssue } from "@shared/api/workspace-contracts";
import { toErrorMessage } from "@/lib/errors";
import type { AppStreamStatus } from "@/app/useAppStream";
import { runApi } from "../../runs/runApi";
import { isRootRunDetailForLoop, rootRunLoopMismatchMessage } from "../../runs/rootRunAssociation";

export type LoopRunPendingOperation = "load" | "start" | "respond" | "cancel" | null;

export function useLoopRun(loopId: string | undefined, refreshSignal: string, streamStatus: AppStreamStatus, rootRunId?: string, target?: RunTarget, suppliedRootDetail?: RootRunDetail) {
  const [details, setDetails] = useState<LoopRunDetails | null>(null);
  const [rootDetail, setRootDetail] = useState<RootRunDetail>();
  const [pendingOperation, setPendingOperation] = useState<LoopRunPendingOperation>("load");
  const [error, setError] = useState("");
  const generation = useRef(0);
  const selectedRootRunId = rootRunId ?? target?.activeRootRunId ?? target?.latestRootRunId;
  const preflight = useMemo(() => target ? {
    ok: target.ready,
    issues: target.issues.map((issue): RuntimePreflightIssue => ({
      executionProfileId: issue.executionProfileId,
      stepId: issue.stepId,
      code: runtimeIssueCode(issue.code),
      message: issue.message
    })),
    snapshots: []
  } : undefined, [target]);

  const applyRoot = useCallback((root?: RootRunDetail) => {
    setRootDetail(root);
    const selected = root ? selectedLoopRun(root) : null;
    setDetails(selected);
    return selected;
  }, []);

  const acceptRoot = useCallback((root: RootRunDetail, expectedRootRunId?: string) => {
    if (!loopId || !isRootRunDetailForLoop(root, loopId, expectedRootRunId)) {
      applyRoot(undefined);
      setError(rootRunLoopMismatchMessage(expectedRootRunId ?? root.rootRunId, loopId ?? "unknown"));
      return null;
    }
    setError("");
    return applyRoot(root);
  }, [applyRoot, loopId]);

  const refresh = useCallback(async () => {
    const current = ++generation.current;
    if (!loopId || !selectedRootRunId) { applyRoot(undefined); setPendingOperation(null); return; }
    if (suppliedRootDetail?.rootRunId === selectedRootRunId) {
      acceptRoot(suppliedRootDetail, selectedRootRunId);
      setPendingOperation((operation) => operation === "load" ? null : operation);
      return;
    }
    try {
      const next = await runApi.detail(selectedRootRunId);
      if (generation.current === current) acceptRoot(next, selectedRootRunId);
    } catch (cause) {
      if (generation.current === current) setError(toErrorMessage(cause, "Unable to load the Loop Run."));
    } finally {
      if (generation.current === current) setPendingOperation((operation) => operation === "load" ? null : operation);
    }
  }, [acceptRoot, applyRoot, loopId, selectedRootRunId, suppliedRootDetail]);

  useEffect(() => { setPendingOperation("load"); applyRoot(undefined); void refresh(); }, [applyRoot, refresh, refreshSignal]);
  useEffect(() => {
    if (!details || !["running", "waiting_for_human"].includes(details.status)) return;
    const timer = window.setInterval(() => { void refresh(); }, 2_000);
    return () => window.clearInterval(timer);
  }, [details, refresh]);

  const mutate = useCallback(async (operation: Exclude<LoopRunPendingOperation, "load" | null>, request: () => Promise<RootRunDetail>, expectedRootRunId?: string) => {
    const current = ++generation.current;
    setPendingOperation(operation);
    setError("");
    try {
      const next = await request();
      return generation.current === current ? acceptRoot(next, expectedRootRunId) : null;
    } catch (cause) {
      if (generation.current === current) setError(toErrorMessage(cause, `Unable to ${operation} Loop Run.`));
      return null;
    } finally {
      if (generation.current === current) setPendingOperation(null);
    }
  }, [acceptRoot]);

  const start = useCallback(async (input: string) => {
    if (!loopId || !preflight?.ok) return false;
    return mutate("start", () => runApi.start("loop", loopId, input));
  }, [loopId, mutate, preflight?.ok]);
  const currentRootDetail = rootDetail && loopId && isRootRunDetailForLoop(rootDetail, loopId, selectedRootRunId)
    ? rootDetail
    : undefined;
  const currentDetails = currentRootDetail ? details : null;
  const respond = useCallback(async (stepRunId: string, request: RespondToStepRunRequest) => {
    if (!currentRootDetail) return false;
    return mutate("respond", () => runApi.respond(currentRootDetail.rootRunId, stepRunId, request), currentRootDetail.rootRunId);
  }, [currentRootDetail, mutate]);
  const cancel = useCallback(async () => {
    if (!currentRootDetail) return false;
    return mutate("cancel", () => runApi.cancel(currentRootDetail), currentRootDetail.rootRunId);
  }, [currentRootDetail, mutate]);

  return { details: currentDetails, rootDetail: currentRootDetail, preflight, pendingOperation, error, streamStatus, refresh, start, respond, cancel };
}

const selectedLoopRun = (root: RootRunDetail) => {
  const runs = root.loopRuns.filter((run) => run.rootRunId === root.rootRunId);
  return runs.find((run) => run.runId === root.current?.loopRunId) ?? [...runs].reverse()[0] ?? null;
};
const runtimeIssueCode = (code: RunTarget["issues"][number]["code"]): RuntimePreflightIssue["code"] =>
  code === "invalid_config" ? "invalid_runtime_config" : code;
