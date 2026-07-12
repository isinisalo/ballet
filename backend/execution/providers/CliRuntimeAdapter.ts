import type { ExecutionPolicy, RuntimeProvider } from "../../../shared/domain/runtime.js";

export type { RuntimeProvider } from "../../../shared/domain/runtime.js";

export interface RuntimeProbe {
  provider: RuntimeProvider;
  command: string;
  installed: boolean;
  compatible: boolean;
  version?: string;
  minimumVersion: string;
  authStatus: "ready" | "required" | "expired" | "unknown";
  policyCapabilities: {
    workspaceWrite: boolean;
    networkControl: boolean;
    readOnlyRoots: boolean;
  };
  reason?: string;
}

export interface RuntimeModel {
  id: string;
  name: string;
  isDefault?: boolean;
  reasoningOptions?: string[];
  defaultReasoning?: string;
  capabilities?: {
    reasoning?: boolean;
    vision?: boolean;
    maxContextTokens?: number;
  };
}

export type PermissionKind = "command" | "write" | "read" | "network" | "mcp" | "unknown";

export interface RuntimePermissionRequest {
  provider: RuntimeProvider;
  kind: PermissionKind;
  operation: string;
  path?: string;
  command?: string;
  url?: string;
  raw?: unknown;
}

export interface RuntimePermissionPolicy {
  authorize(request: RuntimePermissionRequest): Promise<boolean> | boolean;
}

export const denyAllRuntimePermissions: RuntimePermissionPolicy = {
  authorize: () => false
};

export interface RuntimeExecutionRequest {
  executionId: string;
  prompt: string;
  workingDirectory: string;
  model: string;
  reasoning: string;
  policy: ExecutionPolicy;
  systemInstructions?: string;
  outputSchema?: Record<string, unknown>;
  timeoutMs?: number;
  signal?: AbortSignal;
  permissionPolicy?: RuntimePermissionPolicy;
}

export interface RuntimeUsage {
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
}

export type RuntimeEvent =
  | { type: "execution.started"; executionId: string; provider: RuntimeProvider; at: string }
  | { type: "assistant.delta"; text: string; itemId?: string }
  | { type: "assistant.message"; text: string; itemId?: string }
  | { type: "reasoning.summary"; text: string; itemId?: string }
  | { type: "tool.started"; toolCallId: string; name: string; input?: unknown }
  | { type: "tool.output"; toolCallId: string; text: string }
  | { type: "tool.completed"; toolCallId: string; name: string; success: boolean; output?: unknown }
  | { type: "permission.denied"; request: RuntimePermissionRequest }
  | { type: "usage"; usage: RuntimeUsage }
  | { type: "diagnostic"; level: "info" | "warning" | "error"; message: string; data?: unknown }
  | { type: "execution.completed"; output: string; structuredOutput?: unknown }
  | { type: "execution.failed"; message: string; retryable: boolean };

export interface CliRuntimeAdapter {
  readonly provider: RuntimeProvider;
  readonly minimumVersion: string;
  probe(signal?: AbortSignal): Promise<RuntimeProbe>;
  listModels(signal?: AbortSignal): Promise<RuntimeModel[]>;
  execute(request: RuntimeExecutionRequest): AsyncIterable<RuntimeEvent>;
  cancel(executionId: string, reason?: string): Promise<void>;
}
