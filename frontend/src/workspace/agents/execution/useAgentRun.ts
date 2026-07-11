import { useCallback, useEffect, useState } from "react";
import { toErrorMessage } from "@/lib/errors";
import { agentExecutionApi } from "./agentExecutionApi";
import type { AgentRun } from "./types";

export type AgentRunOperation = "load" | "start" | "cancel" | null;
export const activeAgentRunStatuses = new Set<AgentRun["status"]>(["queued", "claimed", "preparing", "running"]);

export function useAgentRun(agentId: string) {
  const [run, setRun] = useState<AgentRun | null>(null);
  const [operation, setOperation] = useState<AgentRunOperation>("load");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setOperation((current) => current ?? "load");
    try {
      setRun(await agentExecutionApi.getLatestRun(agentId));
      setError("");
    } catch (caught) {
      setError(toErrorMessage(caught, "Unable to load the latest agent run."));
    } finally {
      setOperation((current) => current === "load" ? null : current);
    }
  }, [agentId]);

  useEffect(() => { setRun(null); void refresh(); }, [refresh]);

  const start = useCallback(async (input: string) => {
    setOperation("start");
    setError("");
    try {
      setRun(await agentExecutionApi.startRun(agentId, input));
      return true;
    } catch (caught) {
      setError(toErrorMessage(caught, "Unable to start the agent run."));
      return false;
    } finally {
      setOperation(null);
    }
  }, [agentId]);

  const cancel = useCallback(async () => {
    if (!run) return false;
    setOperation("cancel");
    setError("");
    try {
      setRun(await agentExecutionApi.cancelRun(run.id));
      return true;
    } catch (caught) {
      setError(toErrorMessage(caught, "Unable to cancel the agent run."));
      return false;
    } finally {
      setOperation(null);
    }
  }, [run]);

  const acceptRunEvent = useCallback((payload: unknown) => {
    if (!payload || typeof payload !== "object") return;
    const candidate = "run" in payload ? (payload as { run?: unknown }).run : payload;
    if (candidate && typeof candidate === "object" && "id" in candidate && "status" in candidate && "agentId" in candidate && "runtime" in candidate && "project" in candidate) {
      setRun(candidate as AgentRun);
      return;
    }
    void refresh();
  }, [refresh]);

  return { run, operation, error, refresh, start, cancel, acceptRunEvent };
}
