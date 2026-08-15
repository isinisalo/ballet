export type RuntimeProvider = "codex" | "copilot";
export type RuntimeAuthStatus = "ready" | "required" | "expired" | "unknown";
export type LocalProviderHealth =
  | "ready"
  | "probing"
  | "auth_required"
  | "unsupported_version"
  | "policy_unsupported"
  | "error";

export interface RuntimeModelCapability {
  id: string;
  label: string;
  reasoningOptions: string[];
  defaultReasoning?: string;
}

export interface RuntimePolicyCapabilities {
  workspaceWrite: boolean;
  networkControl: boolean;
  readOnlyRoots: boolean;
}

export interface RuntimeCapabilities {
  models: RuntimeModelCapability[];
  supportsStructuredOutput: boolean;
  policy: RuntimePolicyCapabilities;
  refreshedAt: string;
}

export interface LocalProviderStatus {
  provider: RuntimeProvider;
  command: string;
  installed: boolean;
  compatible: boolean;
  cliVersion?: string;
  authStatus: RuntimeAuthStatus;
  health: LocalProviderHealth;
  healthMessage?: string;
  capabilities: RuntimeCapabilities;
  busy: boolean;
  activeRunCount: number;
}

export interface LocalCheckoutStatus {
  path: string;
  headSha: string;
  configHash: string;
  dirty: boolean;
}

export interface LocalRuntime {
  instanceId: string;
  hostname: string;
  platform: "darwin";
  architecture: "arm64" | "x64";
  checkout: LocalCheckoutStatus;
  uptimeSeconds: number;
  startedAt: string;
  providers: LocalProviderStatus[];
  activeRunCount: number;
  logsPath: string;
}

export interface ExecutionPolicy {
  network: boolean;
  readOnlyRoots: string[];
}

export interface ResolvedExecutionProfile {
  executionProfileId: string;
  provider: RuntimeProvider;
  model: string;
  reasoning: string;
  policy: ExecutionPolicy;
}

export interface RuntimeConfigurationIssue {
  code: "invalid_json" | "invalid_schema" | "provider_unavailable" | "legacy_local_settings";
  path: string;
  message: string;
  executionProfileId?: string;
}
