import { request } from "@/apiClient";
import type { AgentRuntimeConfiguration } from "@shared/api/workspace-contracts";
import type { AgentRuntimeConfigurationInput } from "./types";

const agentPath = (agentId: string) => `/api/agents/${encodeURIComponent(agentId)}`;

export const agentExecutionApi = {
  saveRuntime: (agentId: string, input: AgentRuntimeConfigurationInput) => request<AgentRuntimeConfiguration>(`${agentPath(agentId)}/runtime`, { method: "PUT", body: JSON.stringify(input) })
};
