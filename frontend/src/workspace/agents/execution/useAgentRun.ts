import { useCallback, useEffect, useState } from "react";
import { toErrorMessage } from "@/lib/errors";
import { agentExecutionApi } from "./agentExecutionApi";
import type { AgentRun } from "./types";
import { runApi } from "../../runs/runApi";
import type { RootRunDetail } from "@shared/api/workspace-contracts";

export type AgentRunOperation = "load" | "start" | "cancel" | null;
export const activeAgentRunStatuses = new Set<AgentRun["status"]>(["queued", "claimed", "preparing", "running"]);

export function useAgentRun(agentId: string, rootRunId?: string) {
  const [run, setRun] = useState<AgentRun | null>(null);
  const [detail, setDetail] = useState<RootRunDetail>();
  const [operation, setOperation] = useState<AgentRunOperation>("load");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setOperation((current) => current ?? "load");
    try {
      if (rootRunId) {
        const root = await runApi.detail(rootRunId);
        setDetail(root);
        setRun(root.agentRun ?? null);
      } else {
        const latest = await agentExecutionApi.getLatestRun(agentId);
        setRun(latest);
        setDetail(latest ? await runApi.detail(latest.rootRunId) : undefined);
      }
      setError("");
    } catch (caught) {
      setError(toErrorMessage(caught, "Unable to load the latest agent run."));
    } finally {
      setOperation((current) => current === "load" ? null : current);
    }
  }, [agentId, rootRunId]);

  useEffect(() => { setRun(null); setDetail(undefined); void refresh(); }, [refresh]);

  const start = useCallback(async (input: string) => {
    setOperation("start");
    setError("");
    try {
      const next = await agentExecutionApi.startRun(agentId, input);
      setRun(next);
      void runApi.detail(next.rootRunId).then(setDetail).catch(() => undefined);
      return next;
    } catch (caught) {
      setError(toErrorMessage(caught, "Unable to start the agent run."));
      return null;
    } finally {
      setOperation(null);
    }
  }, [agentId]);

  const cancel = useCallback(async () => {
    if (!run) return false;
    setOperation("cancel");
    setError("");
    try {
      const cancelled = await agentExecutionApi.cancelRun(run.id);
      setRun(cancelled);
      setDetail(await runApi.detail(cancelled.rootRunId));
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

  return { run, detail, operation, error, refresh, start, cancel, acceptRunEvent };
}
