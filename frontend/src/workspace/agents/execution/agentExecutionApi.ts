import { request } from "@/apiClient";
import type { AgentRuntimeConfiguration } from "@shared/api/workspace-contracts";
import type { RuntimeDevice, RuntimeDeviceListResponse } from "../../runtimes/types";
import type { AgentRuntimeConfigurationInput, AgentRun } from "./types";

const agentPath = (agentId: string) => `/api/agents/${encodeURIComponent(agentId)}`;
const runPath = (runId: string) => `/api/agent-runs/${encodeURIComponent(runId)}`;

export const agentExecutionApi = {
  listDevices: async () => {
    const response = await request<RuntimeDeviceListResponse | RuntimeDevice[]>("/api/runtimes/devices");
    return Array.isArray(response) ? response : response.devices;
  },
  getRuntime: (agentId: string) => request<AgentRuntimeConfiguration>(`${agentPath(agentId)}/runtime`),
  saveRuntime: (agentId: string, input: AgentRuntimeConfigurationInput) => request<AgentRuntimeConfiguration>(`${agentPath(agentId)}/runtime`, { method: "PUT", body: JSON.stringify(input) }),
  removeRuntime: (agentId: string) => request<void>(`${agentPath(agentId)}/runtime`, { method: "DELETE" }),
  startRun: (agentId: string, input?: string) => request<AgentRun>(`${agentPath(agentId)}/runs`, { method: "POST", body: JSON.stringify(input?.trim() ? { input } : {}) }),
  getLatestRun: (agentId: string) => request<AgentRun | null>(`${agentPath(agentId)}/runs/latest`),
  getRun: (runId: string) => request<AgentRun>(runPath(runId)),
  cancelRun: (runId: string) => request<AgentRun>(`${runPath(runId)}/cancel`, { method: "POST", body: "{}" })
};
