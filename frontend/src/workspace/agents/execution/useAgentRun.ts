import { useCallback, useEffect, useRef, useState } from "react";
import type { ExecutionTask, RootRunDetail } from "@shared/api/workspace-contracts";
import { toErrorMessage } from "@/lib/errors";
import { runApi } from "../../runs/runApi";

export type AgentRunOperation = "load" | "start" | "cancel" | null;
export const activeAgentRunStatuses = new Set<ExecutionTask["status"]>(["queued", "running"]);

export function useAgentRun(agentId: string, rootRunId?: string, suppliedDetail?: RootRunDetail) {
  const [detail, setDetail] = useState<RootRunDetail | undefined>(suppliedDetail);
  const [operation, setOperation] = useState<AgentRunOperation>(rootRunId ? "load" : null);
  const [error, setError] = useState("");
  const generation = useRef(0);

  const refresh = useCallback(async () => {
    const current = ++generation.current;
    if (!rootRunId) { setDetail(undefined); return; }
    if (suppliedDetail?.rootRunId === rootRunId) {
      setDetail(suppliedDetail);
      setError("");
      setOperation((operation) => operation === "load" ? null : operation);
      return;
    }
    setOperation((current) => current ?? "load");
    try {
      const next = await runApi.detail(rootRunId);
      if (generation.current === current) { setDetail(next); setError(""); }
    } catch (cause) {
      if (generation.current === current) setError(toErrorMessage(cause, "Unable to load the agent Run."));
    } finally {
      if (generation.current === current) setOperation((operation) => operation === "load" ? null : operation);
    }
  }, [rootRunId, suppliedDetail]);

  useEffect(() => { setDetail(undefined); void refresh(); }, [refresh]);

  const start = useCallback(async (input: string) => {
    const current = ++generation.current;
    setOperation("start");
    setError("");
    try {
      const next = await runApi.start("agent", agentId, input);
      if (generation.current === current) setDetail(next);
      return generation.current === current ? next : null;
    } catch (cause) {
      if (generation.current === current) setError(toErrorMessage(cause, "Unable to start the agent Run."));
      return null;
    } finally {
      if (generation.current === current) setOperation(null);
    }
  }, [agentId]);

  const cancel = useCallback(async () => {
    if (!detail) return false;
    const current = ++generation.current;
    setOperation("cancel");
    setError("");
    try {
      const next = await runApi.cancel(detail);
      if (generation.current === current) setDetail(next);
      return generation.current === current;
    } catch (cause) {
      if (generation.current === current) setError(toErrorMessage(cause, "Unable to cancel the agent Run."));
      return false;
    } finally {
      if (generation.current === current) setOperation(null);
    }
  }, [detail]);

  return { detail, operation, error, refresh, start, cancel };
}
