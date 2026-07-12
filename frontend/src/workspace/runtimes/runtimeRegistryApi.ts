import { request } from "@/apiClient";
import type { LocalRuntime } from "@shared/api/workspace-contracts";

export interface RuntimeLogsResponse {
  path: string;
  content: string;
}

export const runtimeRegistryApi = {
  refresh: () => request<LocalRuntime>("/api/runtime/refresh", { method: "POST", body: "{}" }),
  logs: () => request<RuntimeLogsResponse>("/api/runtime/logs")
};
