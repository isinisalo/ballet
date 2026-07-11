import { describe, expect, it } from "vitest";
import { BalletDaemon, type BalletDaemonStatus } from "../BalletDaemon.js";
import type { GitWorkspaceManager } from "../git/GitWorkspaceManager.js";
import type { LeaseAwareJobRunner } from "../jobs/LeaseAwareJobRunner.js";
import { FakeCliRuntimeAdapter } from "../providers/FakeCliRuntimeAdapter.js";
import { FakeDaemonControlPlane } from "../transport/FakeDaemonControlPlane.js";

const verifyModelDiscoveryFailure = async () => {
  const transport = new ClaimTrackingControlPlane();
  const codex = new FailingModelDiscoveryAdapter();
  const copilot = new FakeCliRuntimeAdapter("copilot", "0.0.0", [], [{ id: "gpt-5", name: "GPT-5" }]);
  const statuses: BalletDaemonStatus[] = [];
  const codexBackendId = "10000000-0000-4000-8000-000000000003";
  const copilotBackendId = "10000000-0000-4000-8000-000000000004";
  const daemon = new BalletDaemon({
    config: {
      version: 1,
      serverUrl: "https://ballet.example.test",
      appUrl: "https://ballet.example.test",
      deviceId: "10000000-0000-4000-8000-000000000001",
      daemonId: "10000000-0000-4000-8000-000000000002",
      displayName: "Studio Mac",
      daemonVersion: "1.2.3",
      backends: [
        { id: codexBackendId, provider: "codex", command: "codex" },
        { id: copilotBackendId, provider: "copilot", command: "copilot" }
      ]
    },
    adapters: [codex, copilot],
    transport,
    runner: { run: async () => undefined, cancel: async () => undefined } as unknown as LeaseAwareJobRunner,
    git: {} as unknown as GitWorkspaceManager,
    heartbeatIntervalMs: 60_000,
    fallbackPollIntervalMs: 60_000,
    onStatus: (status) => { statuses.push(status); }
  });

  const running = daemon.run();
  await until(() => statuses.some((status) => status.websocketConnected));
  const report = transport.heartbeats[0]?.backends.find((backend) => backend.id === codexBackendId);
  expect(report).toMatchObject({
    provider: "codex",
    cliVersion: "999.0.0",
    authStatus: "ready",
    health: "error",
    healthMessage: "Model discovery failed: models/list RPC failed: catalog unavailable",
    capabilities: { models: [] }
  });

  transport.emitWakeup({ type: "task.available", runtimeBackendId: copilotBackendId });
  await until(() => transport.claimAttempts.includes(copilotBackendId));
  transport.emitWakeup({ type: "task.available", runtimeBackendId: codexBackendId });
  await new Promise((resolve) => setTimeout(resolve, 10));
  expect(transport.claimAttempts).not.toContain(codexBackendId);

  await daemon.stop();
  await running;
};

describe("BalletDaemon", () => {
  it("reports model discovery failures as unhealthy and never wakes that backend", verifyModelDiscoveryFailure);

  it("reports the inspected source checkout and CAS config snapshot before accepting work", async () => {
    const transport = new FakeDaemonControlPlane();
    const codex = new FakeCliRuntimeAdapter("codex", "0.0.0", [], [{ id: "gpt-5.4", name: "GPT-5.4" }]);
    const copilot = new FakeCliRuntimeAdapter("copilot", "0.0.0", [], [{ id: "gpt-5", name: "GPT-5" }]);
    const git = {
      inspectManagedProject: async () => ({
        root: "/Users/test/.ballet/projects/project-1/repo",
        headSha: "a".repeat(40),
        branch: "main",
        dirtyPaths: [],
        ignoredRuntimePaths: [".ballet/project.json"],
        codeDirty: false,
        snapshotHash: "b".repeat(64)
      })
    } as unknown as GitWorkspaceManager;
    const daemon = new BalletDaemon({
      config: {
        version: 1,
        serverUrl: "https://ballet.example.test",
        appUrl: "https://ballet.example.test",
        deviceId: "10000000-0000-4000-8000-000000000001",
        daemonId: "10000000-0000-4000-8000-000000000002",
        displayName: "Studio Mac",
        daemonVersion: "1.2.3",
        backends: [
          { id: "10000000-0000-4000-8000-000000000003", provider: "codex", command: "codex" },
          { id: "10000000-0000-4000-8000-000000000004", provider: "copilot", command: "copilot" }
        ],
        projectId: "project-1",
        repositoryUrl: "https://example.test/repo.git",
        repositoryPath: "/Users/test/.ballet/projects/project-1/repo"
      },
      adapters: [codex, copilot],
      transport,
      runner: { run: async () => undefined, cancel: async () => undefined } as unknown as LeaseAwareJobRunner,
      git,
      heartbeatIntervalMs: 60_000,
      fallbackPollIntervalMs: 60_000
    });

    const running = daemon.run();
    await until(() => transport.heartbeats.length > 0);
    await daemon.stop();
    await running;

    expect(transport.heartbeats[0]?.checkout).toEqual({
      repositoryUrl: "https://example.test/repo.git",
      path: "/Users/test/.ballet/projects/project-1/repo",
      headSha: "a".repeat(40),
      configHash: "b".repeat(64),
      dirty: false,
      lastInspectedAt: expect.any(String)
    });
  });

  it("echoes a refresh nonce discovered through the heartbeat fallback on a new checkout inspection", async () => {
    const transport = new BlockingDiagnosticsControlPlane();
    const requestId = "30000000-0000-4000-8000-000000000001";
    transport.heartbeatResult = { refreshRequested: true, refreshRequestId: requestId };
    const fixture = refreshDaemon(transport);

    const running = fixture.daemon.run();
    await until(() => transport.heartbeats.some((entry) => entry.checkout?.inspectionId === requestId));
    transport.releaseDiagnostics();
    await fixture.daemon.stop();
    await running;

    expect(fixture.inspections()).toBeGreaterThanOrEqual(2);
    expect(transport.heartbeats.at(-1)?.checkout).toMatchObject({
      inspectionId: requestId,
      headSha: "a".repeat(40),
      configHash: "b".repeat(64)
    });
  });

  it("echoes a WebSocket refresh nonce on a new checkout inspection", async () => {
    const transport = new FakeDaemonControlPlane();
    const statuses: BalletDaemonStatus[] = [];
    const fixture = refreshDaemon(transport, statuses);
    const requestId = "30000000-0000-4000-8000-000000000002";

    const running = fixture.daemon.run();
    await until(() => statuses.some((status) => status.websocketConnected));
    transport.emitWakeup({ type: "runtime.refresh", requestId });
    await until(() => transport.heartbeats.some((entry) => entry.checkout?.inspectionId === requestId));
    await fixture.daemon.stop();
    await running;

    expect(fixture.inspections()).toBeGreaterThanOrEqual(2);
    expect(transport.heartbeats.at(-1)?.checkout?.inspectionId).toBe(requestId);
  });

  it("retries a server-requested human root finalization from heartbeat state", async () => {
    const transport = new FakeDaemonControlPlane();
    transport.heartbeatResult = {
      rootFinalizations: [{ projectId: "project-1", rootRunId: "root-run-1", success: true }]
    };
    const codex = new FakeCliRuntimeAdapter("codex", "0.0.0", [], [{ id: "gpt-5.4", name: "GPT-5.4" }]);
    const copilot = new FakeCliRuntimeAdapter("copilot", "0.0.0", [], [{ id: "gpt-5", name: "GPT-5" }]);
    const finalizations: Array<{ projectId: string; rootRunId: string; success: boolean }> = [];
    const git = {
      inspectManagedProject: async () => ({
        root: "/Users/test/.ballet/projects/project-1/repo",
        headSha: "a".repeat(40),
        branch: "main",
        dirtyPaths: [],
        ignoredRuntimePaths: [],
        codeDirty: false,
        snapshotHash: "b".repeat(64)
      }),
      finalizeRoot: async (projectId: string, rootRunId: string, success: boolean) => {
        finalizations.push({ projectId, rootRunId, success });
        return {
          success,
          retained: !success,
          branch: "ballet/run/root-run-1",
          worktreePath: "/Users/test/.ballet/projects/project-1/worktrees/root-run-1",
          commitSha: success ? "c".repeat(40) : undefined,
          changedFiles: ["src/change.ts"],
          snapshotHash: "b".repeat(64)
        };
      }
    } as unknown as GitWorkspaceManager;
    const daemon = new BalletDaemon({
      config: {
        version: 1,
        serverUrl: "https://ballet.example.test",
        appUrl: "https://ballet.example.test",
        deviceId: "10000000-0000-4000-8000-000000000001",
        daemonId: "10000000-0000-4000-8000-000000000002",
        displayName: "Studio Mac",
        daemonVersion: "1.2.3",
        backends: [
          { id: "10000000-0000-4000-8000-000000000003", provider: "codex", command: "codex" },
          { id: "10000000-0000-4000-8000-000000000004", provider: "copilot", command: "copilot" }
        ],
        projectId: "project-1",
        repositoryUrl: "https://example.test/repo.git",
        repositoryPath: "/Users/test/.ballet/projects/project-1/repo"
      },
      adapters: [codex, copilot],
      transport,
      runner: { run: async () => undefined, cancel: async () => undefined } as unknown as LeaseAwareJobRunner,
      git,
      heartbeatIntervalMs: 60_000,
      fallbackPollIntervalMs: 60_000
    });

    const running = daemon.run();
    await until(() => transport.requestedRootFinalizations.length > 0);
    await daemon.stop();
    await running;

    expect(finalizations).toEqual([{ projectId: "project-1", rootRunId: "root-run-1", success: true }]);
    expect(transport.requestedRootFinalizations[0]).toMatchObject({
      projectId: "project-1", rootRunId: "root-run-1",
      report: { success: true, commitSha: "c".repeat(40) }
    });
  });
});

class FailingModelDiscoveryAdapter extends FakeCliRuntimeAdapter {
  constructor() {
    super("codex", "0.0.0");
  }

  override async listModels(): Promise<never> {
    throw new Error("models/list RPC failed: catalog unavailable");
  }
}

class ClaimTrackingControlPlane extends FakeDaemonControlPlane {
  readonly claimAttempts: string[] = [];

  override async claim(runtimeBackendId?: string) {
    if (runtimeBackendId) this.claimAttempts.push(runtimeBackendId);
    return super.claim();
  }
}

class BlockingDiagnosticsControlPlane extends FakeDaemonControlPlane {
  private release!: () => void;
  private readonly diagnosticsReleased = new Promise<void>((resolve) => { this.release = resolve; });

  override async diagnostics(lines: string[]): Promise<void> {
    this.diagnosticBatches.push(lines);
    await this.diagnosticsReleased;
  }

  releaseDiagnostics(): void {
    this.release();
  }
}

const refreshDaemon = (transport: FakeDaemonControlPlane, statuses: BalletDaemonStatus[] = []) => {
  let inspections = 0;
  const git = {
    inspectManagedProject: async () => {
      inspections += 1;
      return {
        root: "/Users/test/.ballet/projects/project-1/repo",
        headSha: "a".repeat(40),
        branch: "main",
        dirtyPaths: [],
        ignoredRuntimePaths: [],
        codeDirty: false,
        snapshotHash: "b".repeat(64)
      };
    }
  } as unknown as GitWorkspaceManager;
  const daemon = new BalletDaemon({
    config: {
      version: 1,
      serverUrl: "https://ballet.example.test",
      appUrl: "https://ballet.example.test",
      deviceId: "10000000-0000-4000-8000-000000000001",
      daemonId: "10000000-0000-4000-8000-000000000002",
      displayName: "Studio Mac",
      daemonVersion: "1.2.3",
      backends: [
        { id: "10000000-0000-4000-8000-000000000003", provider: "codex", command: "codex" },
        { id: "10000000-0000-4000-8000-000000000004", provider: "copilot", command: "copilot" }
      ],
      projectId: "project-1",
      repositoryUrl: "https://example.test/repo.git",
      repositoryPath: "/Users/test/.ballet/projects/project-1/repo"
    },
    adapters: [
      new FakeCliRuntimeAdapter("codex", "0.0.0", [], [{ id: "gpt-5.4", name: "GPT-5.4" }]),
      new FakeCliRuntimeAdapter("copilot", "0.0.0", [], [{ id: "gpt-5", name: "GPT-5" }])
    ],
    transport,
    runner: { run: async () => undefined, cancel: async () => undefined } as unknown as LeaseAwareJobRunner,
    git,
    heartbeatIntervalMs: 60_000,
    fallbackPollIntervalMs: 60_000,
    onStatus: (status) => { statuses.push(status); }
  });
  return { daemon, inspections: () => inspections };
};

const until = async (condition: () => boolean): Promise<void> => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Condition was not met before timeout.");
};
