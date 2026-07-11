export type RuntimeProvider = "codex" | "copilot";
export type RuntimeDeviceStatus = "online" | "offline";
export type RuntimeAuthStatus = "ready" | "required" | "expired" | "unknown";
export type RuntimeBackendHealth =
  | "ready"
  | "probing"
  | "auth_required"
  | "unsupported_version"
  | "policy_unsupported"
  | "error"
  | "offline";

export interface RuntimeModelCapability {
  id: string;
  label: string;
  reasoningOptions: string[];
  defaultReasoning?: string;
}

export interface RuntimeCapabilities {
  models: RuntimeModelCapability[];
  supportsResume: boolean;
  supportsStructuredOutput: boolean;
  policy: {
    workspaceWrite: boolean;
    networkControl: boolean;
    readOnlyRoots: boolean;
  };
  refreshedAt: string;
}

export interface RuntimeBackend {
  id: string;
  projectId: string;
  deviceId: string;
  provider: RuntimeProvider;
  cliVersion?: string;
  executablePath?: string;
  authStatus: RuntimeAuthStatus;
  health: RuntimeBackendHealth;
  healthMessage?: string;
  capabilities: RuntimeCapabilities;
  assignedAgentCount: number;
  activeRunCount: number;
  busy: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RuntimeCheckout {
  id: string;
  projectId: string;
  deviceId: string;
  repositoryUrl: string;
  path: string;
  headSha?: string;
  configHash?: string;
  dirty: boolean;
  lastInspectedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RuntimeDevice {
  id: string;
  projectId: string;
  hostname: string;
  displayName: string;
  platform: "darwin";
  architecture: "arm64" | "x64";
  status: RuntimeDeviceStatus;
  diagnostics: {
    daemonId: string;
    daemonVersion: string;
    uptimeSeconds: number;
    lastSeenAt: string;
    connectedAt?: string;
    restartRequestedAt?: string;
    recentError?: string;
  };
  backends: RuntimeBackend[];
  checkout?: RuntimeCheckout;
  activeRunCount: number;
  busyBackendCount: number;
  createdAt: string;
  updatedAt: string;
}

export type RuntimeDeviceFilter = "all" | "online" | "issues";
export interface RuntimeDeviceListResponse { devices: RuntimeDevice[]; }

export interface RuntimeLogEntry {
  id: string | number;
  level: "info" | "warn" | "error";
  message: string;
  createdAt: string;
}
export interface RuntimeLogsResponse { entries: RuntimeLogEntry[]; }

export type PairingStatus = "pending" | "approved" | "claimed" | "expired" | "revoked";
export interface PairingSession {
  id: string;
  deviceCode: string;
  userCode: string;
  status: PairingStatus;
  expiresAt: string;
  approvedAt?: string;
  claimedAt?: string;
  installCommand?: string;
  claimedDevice?: RuntimeDevice;
  deviceId?: string;
}
