import type { ExecutionPolicy, RuntimeProvider } from "@shared/api/workspace-contracts";

export interface AgentRuntimeConfigurationInput {
  provider: RuntimeProvider;
  model: string;
  reasoning: string;
  policy: ExecutionPolicy;
}

export interface AgentExecutionFormValue {
  provider: RuntimeProvider | "";
  model: string;
  reasoning: string;
  policy: ExecutionPolicy;
}

export type { AgentOutcome, ExecutionPolicy } from "@shared/api/workspace-contracts";
