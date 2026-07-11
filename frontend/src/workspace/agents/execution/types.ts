import type { AgentRun, ExecutionPolicy } from "@shared/api/workspace-contracts";

export interface AgentRuntimeConfigurationInput {
  runtimeBackendId: string;
  model: string;
  reasoning: string;
  policy: ExecutionPolicy;
}

export interface AgentExecutionFormValue extends AgentRuntimeConfigurationInput {
  deviceId: string;
}

export type { AgentOutcome, AgentRun, ExecutionPolicy } from "@shared/api/workspace-contracts";
export type AgentRunStatus = AgentRun["status"];
