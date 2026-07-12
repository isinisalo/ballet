import { request } from "@/apiClient";
import type { ExecutionEventPage } from "@shared/api/workspace-contracts";

const taskPath = (taskId: string) => `/api/execution-tasks/${encodeURIComponent(taskId)}`;

export const cliConsoleApi = {
  getEvents: async (taskId: string, after = 0, limit = 500) => {
    return request<ExecutionEventPage>(`${taskPath(taskId)}/events?after=${after}&limit=${limit}`);
  },
  streamUrl: (taskId: string, after: number) => `${taskPath(taskId)}/console/stream?after=${after}`
};
