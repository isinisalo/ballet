import { api } from "@/api";
import { request } from "@/apiClient";
import type {
  RootRunDetail,
  RootRunKind,
  RootRunListResponse,
  RootRunListState,
  RootRunSummary,
  RunTargetsResponse
} from "@shared/api/workspace-contracts";
import { agentExecutionApi } from "../agents/execution/agentExecutionApi";

export const runApi = {
  list: (state: RootRunListState, kind?: RootRunKind, cursor?: string, limit = 30) => {
    const params = new URLSearchParams({ state, limit: String(limit) });
    if (kind) params.set("kind", kind);
    if (cursor) params.set("cursor", cursor);
    return request<RootRunListResponse>(`/api/runs?${params.toString()}`);
  },
  detail: (rootRunId: string) => request<RootRunDetail>(`/api/runs/${encodeURIComponent(rootRunId)}`),
  targets: () => request<RunTargetsResponse>("/api/run-targets"),
  start: async (kind: RootRunKind, targetId: string, input = "") => {
    if (kind === "loop") return api.startLoopRun(targetId, input.trim() ? { input } : {});
    return agentExecutionApi.startRun(targetId, input);
  },
  cancel: async (summary: RootRunSummary, cached?: RootRunDetail) => {
    const detail = cached?.rootRunId === summary.rootRunId ? cached : await runApi.detail(summary.rootRunId);
    if (detail.kind === "agent" && detail.agentRun) return agentExecutionApi.cancelRun(detail.agentRun.id);
    const selected = detail.loopRuns.find((run) => run.runId === detail.current?.loopRunId)
      ?? [...detail.loopRuns].reverse().find((run) => ["running", "waiting_for_human"].includes(run.status));
    if (!selected) throw new Error("This root run has no cancellable Loop run.");
    return api.cancelLoopRun(selected.runId);
  }
};
