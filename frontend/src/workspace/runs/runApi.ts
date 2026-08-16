import { request } from "@/apiClient";
import type {
  RootRunDetail,
  RootRunKind,
  RootRunListResponse,
  RootRunListState,
  RootRunStateProjection,
  RootRunSummary,
  RespondToNodeRunRequest
} from "@shared/api/workspace-contracts";

export const runApi = {
  list: (state: RootRunListState, cursor?: string, limit = 30) => {
    const params = new URLSearchParams({ state, limit: String(limit) });
    if (cursor) params.set("cursor", cursor);
    return request<RootRunListResponse>(`/api/runs?${params.toString()}`);
  },
  detail: (rootRunId: string) => request<RootRunDetail>(`/api/runs/${encodeURIComponent(rootRunId)}`),
  state: (rootRunId: string) =>
    request<RootRunStateProjection>(`/api/runs/${encodeURIComponent(rootRunId)}/state`),
  start: (kind: RootRunKind, targetId: string, input = "") =>
    request<RootRunDetail>("/api/runs", {
      method: "POST",
      body: JSON.stringify({ kind, targetId, ...(input.trim() ? { input } : {}) })
    }),
  cancel: (summary: RootRunSummary) =>
    request<RootRunDetail>(`/api/runs/${encodeURIComponent(summary.rootRunId)}/cancel`, {
      method: "POST",
      body: "{}"
    }),
  respond: (rootRunId: string, nodeRunId: string, body: RespondToNodeRunRequest) =>
    request<RootRunDetail>(
      `/api/runs/${encodeURIComponent(rootRunId)}/nodes/${encodeURIComponent(nodeRunId)}/respond`,
      { method: "POST", body: JSON.stringify(body) }
    )
};
