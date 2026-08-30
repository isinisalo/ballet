/** Checkout-local daemon contracts. Device and pairing concepts are intentionally absent. */
export type RuntimeProvider = "codex" | "copilot";
export type RuntimeAuthStatus = "ready" | "required" | "expired" | "unknown";
export type RuntimeBackendHealth = "ready" | "probing" | "auth_required" | "unsupported_version"
  | "policy_unsupported" | "error" | "offline";

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
  supportsResume: boolean;
  supportsStructuredOutput: boolean;
  policy: RuntimePolicyCapabilities;
  refreshedAt: string;
}

export interface ExecutionPolicy { network: boolean; readOnlyRoots: string[] }
export type WorkspaceAccess = "read-only" | "workspace-write";

export interface LocalProviderStatus {
  provider: RuntimeProvider;
  cliVersion?: string;
  authStatus: RuntimeAuthStatus;
  health: RuntimeBackendHealth;
  healthMessage?: string;
  capabilities: RuntimeCapabilities;
  busy: boolean;
  updatedAt: string;
}

export type LocalDaemonHealth = "starting" | "online" | "offline" | "error";

export interface LocalDaemonStatus {
  status: LocalDaemonHealth;
  pid?: number;
  daemonVersion: string;
  uptimeSeconds: number;
  activeTaskCount: number;
  lastSeenAt: string;
  recentError?: string;
  refreshRequested: boolean;
  restartRequested: boolean;
  providers: LocalProviderStatus[];
}

export interface AgentExecutionBinding {
  version: 2;
  agentId: string;
  provider: RuntimeProvider;
  model: string;
  reasoningEffort: string;
  policy: ExecutionPolicy;
  updatedAt: string;
}

export type ActionExecutionRole = "validation" | "work";
export interface ActionRoleModelSelection {
  model: string;
  reasoningEffort: string;
}
export interface ActionExecutionBinding {
  version: 2;
  actionId: string;
  provider: RuntimeProvider;
  policy: ExecutionPolicy;
  validation: ActionRoleModelSelection;
  work: ActionRoleModelSelection;
  updatedAt: string;
}

export type AgentLiveStatus = "running" | "idle" | "busy" | "attention" | "unbound" | "offline";
export interface AgentExecutionState {
  agentId: string;
  status: AgentLiveStatus;
  provider?: RuntimeProvider;
  activeTaskId?: string;
  reason?: string;
}

export interface LocalDaemonHeartbeat {
  pid: number;
  daemonVersion: string;
  uptimeSeconds: number;
  activeTaskCount: number;
  providers: LocalProviderStatus[];
  recentError?: string;
}

export interface LocalDaemonHeartbeatResult { refreshRequested: boolean; restartRequested: boolean }

export interface LocalDaemonTaskClaim {
  taskId: string;
  fencing: number;
  leaseUntil: string;
  leaseDurationMs: number;
  renewAfterMs: number;
  spec: import("../orchestration/execution.js").ExecutionSpecV15;
  permissions: { workspaceAccess: WorkspaceAccess; network: boolean; readOnlyRoots: string[] };
}

export interface LocalDaemonLeaseResult { accepted: boolean; leaseUntil?: string; cancelRequested: boolean }

export interface LocalDaemonEvent {
  sequence: number;
  source: "ballet" | RuntimeProvider;
  kind: string;
  level: "info" | "warn" | "error";
  phase: "started" | "delta" | "completed";
  message: string;
  data?: Record<string, unknown>;
  terminal: boolean;
  createdAt: string;
}

export interface LocalDaemonLogEntry {
  id: number;
  level: "info" | "warn" | "error";
  message: string;
  createdAt: string;
}
