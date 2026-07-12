import { request } from "@/apiClient";
import type {
  RootRunDetail,
  RootRunKind,
  RootRunListResponse,
  RootRunListState,
  RootRunSummary,
  RespondToStepRunRequest
} from "@shared/api/workspace-contracts";

export const runApi = {
  list: (state: RootRunListState, kind?: RootRunKind, cursor?: string, limit = 30) => {
    const params = new URLSearchParams({ state, limit: String(limit) });
    if (kind) params.set("kind", kind);
    if (cursor) params.set("cursor", cursor);
    return request<RootRunListResponse>(`/api/runs?${params.toString()}`);
  },
  detail: (rootRunId: string) => request<RootRunDetail>(`/api/runs/${encodeURIComponent(rootRunId)}`),
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
  respond: (rootRunId: string, stepRunId: string, input: RespondToStepRunRequest) =>
    request<RootRunDetail>(`/api/runs/${encodeURIComponent(rootRunId)}/steps/${encodeURIComponent(stepRunId)}/respond`, {
      method: "POST",
      body: JSON.stringify(input)
    })
};
