import type { RuntimeBackend, RuntimeDevice } from "../src/workspace/runtimes/types";
import type { AgentRun } from "../src/workspace/agents/execution/types";
import type { AgentRuntimeConfiguration, RuntimeProvider } from "@shared/api/workspace-contracts";

export const now = "2026-07-11T10:00:00.000Z";

export const runtimeBackend = (patch: Partial<RuntimeBackend> = {}): RuntimeBackend => ({
  id: "backend-codex",
  projectId: "project-1",
  deviceId: "device-1",
  provider: "codex",
  cliVersion: "1.2.3",
  executablePath: "/opt/homebrew/bin/codex",
  authStatus: "ready",
  health: "ready",
  capabilities: {
    models: [{ id: "gpt-test", label: "GPT Test", reasoningOptions: ["low", "high"], defaultReasoning: "high" }],
    supportsResume: true,
    supportsStructuredOutput: true,
    policy: { workspaceWrite: true, networkControl: true, readOnlyRoots: true },
    refreshedAt: now
  },
  assignedAgentCount: 1,
  activeRunCount: 0,
  busy: false,
  createdAt: now,
  updatedAt: now,
  ...patch
});

export const runtimeDevice = (patch: Partial<RuntimeDevice> = {}): RuntimeDevice => ({
  id: "device-1",
  projectId: "project-1",
  hostname: "iiros-mac.local",
  displayName: "Iiro's MacBook Pro",
  platform: "darwin",
  architecture: "arm64",
  status: "online",
  diagnostics: {
    daemonId: "daemon-1",
    daemonVersion: "0.1.0",
    uptimeSeconds: 420,
    lastSeenAt: now,
    connectedAt: now
  },
  backends: [runtimeBackend()],
  checkout: {
    id: "checkout-1",
    projectId: "project-1",
    deviceId: "device-1",
    repositoryUrl: "https://example.test/ballet.git",
    path: "/workspace/ballet",
    headSha: "1234567890abcdef1234567890abcdef12345678",
    configHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    dirty: false,
    createdAt: now,
    updatedAt: now
  },
  activeRunCount: 0,
  busyBackendCount: 0,
  createdAt: now,
  updatedAt: now,
  ...patch
});

export const agentRun = (patch: Partial<AgentRun> = {}): AgentRun => ({
  id: "run-1",
  projectId: "project-1",
  agentId: "agent-1",
  rootRunId: "run-1",
  source: "manual",
  taskId: "task-1",
  status: "running",
  runtime: {
    deviceId: "device-1",
    deviceName: "Iiro's MacBook Pro",
    runtimeBackendId: "backend-codex",
    provider: "codex",
    cliVersion: "1.2.3",
    model: "gpt-test",
    reasoning: "high",
    policy: { network: false, readOnlyRoots: [] },
    capabilityHash: "capability-1"
  },
  project: {
    checkoutId: "checkout-1",
    repositoryUrl: "https://example.test/ballet.git",
    headSha: "1234567890abcdef1234567890abcdef12345678",
    configHash: "config-1",
    snapshotHash: "snapshot-1"
  },
  createdAt: now,
  updatedAt: now,
  ...patch
});

export const agentRuntimeConfiguration = ({
  agentId = "agent-1",
  backendId = "backend-codex",
  provider = "codex",
  model = "gpt-test",
  reasoning = "high",
  network = false,
  readOnlyRoots = []
}: {
  agentId?: string;
  backendId?: string;
  provider?: RuntimeProvider;
  model?: string;
  reasoning?: string;
  network?: boolean;
  readOnlyRoots?: string[];
} = {}): AgentRuntimeConfiguration => ({
  intent: { provider, model, reasoning, policy: { network } },
  attachment: { projectId: "project-1", agentId, runtimeBackendId: backendId, readOnlyRoots, createdAt: now, updatedAt: now },
  resolved: { projectId: "project-1", agentId, runtimeBackendId: backendId, deviceId: "device-1", provider, model, reasoning, policy: { network, readOnlyRoots } },
  issues: []
});
