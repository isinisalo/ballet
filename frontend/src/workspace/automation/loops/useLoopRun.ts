import { useCallback, useEffect, useState } from "react";
import type { LoopRunDetails, LoopRuntimePreflight, RespondToStepRunRequest } from "@shared/api/workspace-contracts";
import { api } from "@/api";
import { toErrorMessage } from "@/lib/errors";
import type { RuntimeStreamStatus } from "@/app/useRuntimeStream";

export type LoopRunPendingOperation = "load" | "start" | "respond" | "cancel" | null;

export function useLoopRun(loopId: string | undefined, refreshSignal: string, streamStatus: RuntimeStreamStatus) {
  const [details, setDetails] = useState<LoopRunDetails | null>(null);
  const [preflight, setPreflight] = useState<LoopRuntimePreflight>();
  const [preflightLoopId, setPreflightLoopId] = useState<string>();
  const [pendingOperation, setPendingOperation] = useState<LoopRunPendingOperation>("load");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!loopId) {
      setDetails(null);
      setPendingOperation(null);
      return;
    }
    try {
      setDetails(await api.getLatestLoopRun(loopId));
      setError("");
    } catch (caught) {
      setError(toErrorMessage(caught, "Unable to load the latest loop run."));
    } finally {
      setPendingOperation((current) => current === "load" ? null : current);
    }
  }, [loopId]);

  const refreshPreflight = useCallback(async () => {
    setPreflight(undefined);
    setPreflightLoopId(undefined);
    if (!loopId) return;
    try {
      setPreflight(await api.getLoopPreflight(loopId));
    } catch (caught) {
      setPreflight({ ok: false, issues: [{ agentId: "loop", code: "backend_unhealthy", message: toErrorMessage(caught, "Unable to run runtime preflight.") }], snapshots: [] });
    } finally {
      setPreflightLoopId(loopId);
    }
  }, [loopId]);

  useEffect(() => {
    setPendingOperation("load");
    setDetails(null);
    void refresh();
    void refreshPreflight();
  }, [refresh, refreshPreflight, refreshSignal]);

  useEffect(() => {
    if (!details || !["running", "waiting_for_human"].includes(details.status)) return;
    const timer = window.setInterval(() => { void refresh(); }, 2000);
    return () => window.clearInterval(timer);
  }, [details, refresh]);

  const runMutation = useCallback(async (
    operation: Exclude<LoopRunPendingOperation, "load" | null>,
    request: () => Promise<LoopRunDetails>
  ) => {
    setPendingOperation(operation);
    setError("");
    try {
      setDetails(await request());
      void refreshPreflight();
      return true;
    } catch (caught) {
      setError(toErrorMessage(caught, `Unable to ${operation} loop run.`));
      void refresh();
      return false;
    } finally {
      setPendingOperation(null);
    }
  }, [refresh, refreshPreflight]);

  const start = useCallback(async (input: string) => {
    if (!loopId || preflightLoopId !== loopId || !preflight?.ok) {
      void refreshPreflight();
      return false;
    }
    return runMutation("start", () => api.startLoopRun(loopId, input.trim() ? { input } : {}));
  }, [loopId, preflight, preflightLoopId, refreshPreflight, runMutation]);

  const respond = useCallback(async (stepRunId: string, request: RespondToStepRunRequest) => {
    if (!details) return false;
    return runMutation("respond", () => api.respondToStepRun(details.runId, stepRunId, request));
  }, [details, runMutation]);

  const cancel = useCallback(async () => {
    if (!details) return false;
    return runMutation("cancel", () => api.cancelLoopRun(details.runId));
  }, [details, runMutation]);

  return {
    details,
    preflight: preflightLoopId === loopId ? preflight : undefined,
    preflightLoading: Boolean(loopId) && preflightLoopId !== loopId,
    pendingOperation,
    error,
    streamStatus,
    refresh,
    refreshPreflight,
    start,
    respond,
    cancel
  };
}
