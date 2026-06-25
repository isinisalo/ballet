import type { VersionedRef } from "./json.js";

export interface AgentOperation {
  id: string;
  version: number;
  name: string;
  description: string;
  active: boolean;
  agentId: string;
  instructions: string;
  inputContract: VersionedRef;
  outputContract: VersionedRef;
  emissionRequired: boolean;
  createdAt: string;
  updatedAt: string;
  frontmatter?: Record<string, unknown>;
  body?: string;
  relativePath?: string;
  slug?: string;
  errors?: string[];
}

export interface AgentExecutionOutput<TResult = unknown> {
  status: "completed" | "blocked" | "needs_input" | "failed";
  summary: string;
  result?: TResult;
  evidence?: {
    checks?: Array<{
      name: string;
      status: "passed" | "failed" | "skipped";
      details?: string;
    }>;
    artifacts?: Record<string, unknown>;
  };
}

export const outputStatusToRunStatus = (status: AgentExecutionOutput["status"]) => status;

