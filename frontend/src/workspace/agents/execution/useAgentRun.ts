import { useCallback, useEffect, useState } from "react";
import type { ExecutionTask, RootRunDetail } from "@shared/api/workspace-contracts";
import { toErrorMessage } from "@/lib/errors";
import { runApi } from "../../runs/runApi";

export type AgentRunOperation = "load" | "start" | "cancel" | null;
export const activeAgentRunStatuses = new Set<ExecutionTask["status"]>(["queued", "running"]);

export function useAgentRun(agentId: string, rootRunId?: string) {
  const [detail, setDetail] = useState<RootRunDetail>();
  const [operation, setOperation] = useState<AgentRunOperation>(rootRunId ? "load" : null);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!rootRunId) { setDetail(undefined); return; }
    setOperation((current) => current ?? "load");
    try { setDetail(await runApi.detail(rootRunId)); setError(""); }
    catch (cause) { setError(toErrorMessage(cause, "Unable to load the agent Run.")); }
    finally { setOperation((current) => current === "load" ? null : current); }
  }, [rootRunId]);

  useEffect(() => { setDetail(undefined); void refresh(); }, [refresh]);

  const start = useCallback(async (input: string) => {
    setOperation("start");
    setError("");
    try { const next = await runApi.start("agent", agentId, input); setDetail(next); return next; }
    catch (cause) { setError(toErrorMessage(cause, "Unable to start the agent Run.")); return null; }
    finally { setOperation(null); }
  }, [agentId]);

  const cancel = useCallback(async () => {
    if (!detail) return false;
    setOperation("cancel");
    setError("");
    try { setDetail(await runApi.cancel(detail)); return true; }
    catch (cause) { setError(toErrorMessage(cause, "Unable to cancel the agent Run.")); return false; }
    finally { setOperation(null); }
  }, [detail]);

  return { detail, operation, error, refresh, start, cancel };
}
