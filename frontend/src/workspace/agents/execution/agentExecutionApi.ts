import { request } from "@/apiClient";
import type { RuntimeDevice, RuntimeDeviceListResponse } from "../../runtimes/types";
import type { AgentExecutionBinding, AgentExecutionBindingInput, AgentRun } from "./types";

const agentPath = (agentId: string) => `/api/agents/${encodeURIComponent(agentId)}`;
const runPath = (runId: string) => `/api/agent-runs/${encodeURIComponent(runId)}`;

export const agentExecutionApi = {
  listDevices: async () => {
    const response = await request<RuntimeDeviceListResponse | RuntimeDevice[]>("/api/runtimes/devices");
    return Array.isArray(response) ? response : response.devices;
  },
  getBinding: (agentId: string) => request<AgentExecutionBinding | null>(`${agentPath(agentId)}/execution-binding`),
  saveBinding: (agentId: string, input: AgentExecutionBindingInput) => request<AgentExecutionBinding>(`${agentPath(agentId)}/execution-binding`, { method: "PUT", body: JSON.stringify(input) }),
  startRun: (agentId: string, input?: string) => request<AgentRun>(`${agentPath(agentId)}/runs`, { method: "POST", body: JSON.stringify(input?.trim() ? { input } : {}) }),
  getLatestRun: (agentId: string) => request<AgentRun | null>(`${agentPath(agentId)}/runs/latest`),
  getRun: (runId: string) => request<AgentRun>(runPath(runId)),
  cancelRun: (runId: string) => request<AgentRun>(`${runPath(runId)}/cancel`, { method: "POST", body: "{}" })
};
