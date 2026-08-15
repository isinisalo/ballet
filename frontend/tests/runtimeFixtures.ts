import type {
  LocalProviderStatus,
  LocalRuntime
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
