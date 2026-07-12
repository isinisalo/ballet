import type {
  AgentRuntimeConfiguration,
  ExecutionTask,
  LocalProviderStatus,
  LocalRuntime,
  RootRunDetail,
  RuntimeProvider
} from "@shared/api/workspace-contracts";

export const now = "2026-07-11T10:00:00.000Z";

export const localProvider = (patch: Partial<LocalProviderStatus> = {}): LocalProviderStatus => ({
  provider: "codex",
  command: "/opt/homebrew/bin/codex",
  installed: true,
  compatible: true,
  cliVersion: "1.2.3",
  authStatus: "ready",
  health: "ready",
  capabilities: {
    models: [{ id: "gpt-test", label: "GPT Test", reasoningOptions: ["low", "high"], defaultReasoning: "high" }],
    supportsStructuredOutput: true,
    policy: { workspaceWrite: true, networkControl: true, readOnlyRoots: true },
    refreshedAt: now
  },
  activeRunCount: 0,
  busy: false,
  ...patch
});

export const localRuntime = (patch: Partial<LocalRuntime> = {}): LocalRuntime => ({
  instanceId: "instance-1",
  hostname: "iiros-mac.local",
  platform: "darwin",
  architecture: "arm64",
  checkout: {
    path: "/workspace/ballet",
    headSha: "1234567890abcdef1234567890abcdef12345678",
    configHash: "a".repeat(64),
    dirty: false
  },
  uptimeSeconds: 420,
  startedAt: now,
  providers: [localProvider()],
  activeRunCount: 0,
  logsPath: "/workspace/ballet/.git/ballet/logs/ballet.log",
  ...patch
});

export const agentRuntimeConfiguration = ({
  agentId = "agent-1",
  provider = "codex",
  model = "gpt-test",
  reasoning = "high",
  network = false,
  readOnlyRoots = []
}: {
  agentId?: string;
  provider?: RuntimeProvider;
  model?: string;
  reasoning?: string;
  network?: boolean;
  readOnlyRoots?: string[];
} = {}): AgentRuntimeConfiguration => ({
  intent: { provider, model, reasoning, policy: { network } },
  localPolicy: { readOnlyRoots },
  resolved: { agentId, provider, model, reasoning, policy: { network, readOnlyRoots } },
  issues: []
});

export const executionTask = (patch: Partial<ExecutionTask> = {}): ExecutionTask => ({
  id: "task-1",
  kind: "agent_run",
  rootRunId: "run-1",
  status: "running",
  createdAt: now,
  updatedAt: now,
  spec: {
    version: 1,
    taskId: "task-1",
    kind: "agent_run",
    rootRunId: "run-1",
    agent: { id: "agent-1", name: "Immutable snapshot", description: "Review agent", instructions: "Follow the immutable review instructions.", skillIds: [], configHash: "a".repeat(64) },
    runtime: { hostname: "iiros-mac.local", provider: "codex", cliVersion: "1.2.3", model: "gpt-test", reasoning: "high", policy: { network: false, readOnlyRoots: [] }, capabilityHash: "capability-1" },
    project: { checkoutRoot: "/workspace/ballet", headSha: "1234567890abcdef1234567890abcdef12345678", configHash: "config-1", snapshotHash: "snapshot-1" },
    createdAt: now
  },
  ...patch
});

export const agentRootRun = (patch: Partial<RootRunDetail> = {}): RootRunDetail => {
  const tasks = patch.tasks ?? [executionTask()];
  return {
    rootRunId: "run-1",
    kind: "agent",
    targetId: "agent-1",
    source: "manual",
    status: "running",
    current: { taskId: tasks[0]?.id, agentId: "agent-1", taskStatus: tasks[0]?.status },
    createdAt: now,
    updatedAt: now,
    loopRuns: [],
    tasks,
    ...patch
  };
};
