import { useCallback, useEffect, useState } from "react";
import type { LoopRunDetails, RespondToStepRunRequest } from "@shared/api/workspace-contracts";
import { api } from "@/api";
import { toErrorMessage } from "@/lib/errors";
import type { RuntimeStreamStatus } from "@/app/useRuntimeStream";

export type LoopRunPendingOperation = "load" | "start" | "respond" | "cancel" | null;

export function useLoopRun(loopId: string | undefined, refreshSignal: string, streamStatus: RuntimeStreamStatus) {
  const [details, setDetails] = useState<LoopRunDetails | null>(null);
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

  useEffect(() => {
    setPendingOperation("load");
    setDetails(null);
    void refresh();
  }, [refresh, refreshSignal]);

  const runMutation = useCallback(async (
    operation: Exclude<LoopRunPendingOperation, "load" | null>,
    request: () => Promise<LoopRunDetails>
  ) => {
    setPendingOperation(operation);
    setError("");
    try {
      setDetails(await request());
      return true;
    } catch (caught) {
      setError(toErrorMessage(caught, `Unable to ${operation} loop run.`));
      void refresh();
      return false;
    } finally {
      setPendingOperation(null);
    }
  }, [refresh]);

  const start = useCallback(async (input: string) => {
    if (!loopId) return false;
    return runMutation("start", () => api.startLoopRun(loopId, input.trim() ? { input } : {}));
  }, [loopId, runMutation]);

  const respond = useCallback(async (stepRunId: string, request: RespondToStepRunRequest) => {
    if (!details) return false;
    return runMutation("respond", () => api.respondToStepRun(details.runId, stepRunId, request));
  }, [details, runMutation]);

  const cancel = useCallback(async () => {
    if (!details) return false;
    return runMutation("cancel", () => api.cancelLoopRun(details.runId));
  }, [details, runMutation]);

  const acceptDetails = useCallback((next: LoopRunDetails) => setDetails(next), []);

  return { details, pendingOperation, error, streamStatus, refresh, start, respond, cancel, acceptDetails };
}
