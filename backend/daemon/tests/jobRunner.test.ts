import { describe, expect, it } from "vitest";
import type { ExecutionSpec, ExecutionTask } from "../../../shared/domain/runtime.js";
import type { GitWorkspaceManager } from "../git/GitWorkspaceManager.js";
import type { FinalizedGitWorkspace, PreparedGitWorkspace } from "../git/GitWorkspaceTypes.js";
import { LeaseAwareJobRunner, LeaseLostError, TaskCancelledError } from "../jobs/LeaseAwareJobRunner.js";
import { FakeCliRuntimeAdapter } from "../providers/FakeCliRuntimeAdapter.js";
import type { CliRuntimeAdapter, RuntimeEvent, RuntimeExecutionRequest } from "../providers/CliRuntimeAdapter.js";
import { FakeDaemonControlPlane } from "../transport/FakeDaemonControlPlane.js";
import { DaemonTransportError } from "../transport/HttpWsDaemonTransport.js";
import type { ClaimedExecutionTask, LeaseResult } from "../transport/DaemonControlPlane.js";

const deviceId = "10000000-0000-4000-8000-000000000003";
const backendId = "10000000-0000-4000-8000-000000000002";

const spec = (): ExecutionSpec => ({
  version: 1,
  projectId: "project-1",
  taskId: "10000000-0000-4000-8000-000000000001",
  kind: "agent_run",
  rootRunId: "10000000-0000-4000-8000-000000000004",
  input: "Do the work.",
  agent: {
    id: "agent-1",
    name: "Agent",
    description: "Test agent",
    instructions: "Return the outcome.",
    skillIds: [],
    configHash: "a".repeat(64)
  },
  runtime: {
    deviceId,
    deviceName: "Test Mac",
    runtimeBackendId: backendId,
    provider: "codex",
    cliVersion: "999.0.0",
    model: "provider-default",
    reasoning: "provider-default",
    policy: { network: false, readOnlyRoots: [] },
    capabilityHash: "b".repeat(64)
  },
  project: {
    checkoutId: "10000000-0000-4000-8000-000000000005",
    repositoryUrl: "https://example.test/repo.git",
    headSha: "c".repeat(40),
    configHash: "d".repeat(64),
    snapshotHash: "e".repeat(64)
  },
  createdAt: "2026-07-11T00:00:00.000Z"
});

const claim = (renewAfterMs = 20_000): ClaimedExecutionTask => {
  const executionSpec = spec();
  const task: ExecutionTask = {
    id: executionSpec.taskId,
    projectId: executionSpec.projectId,
    runtimeBackendId: backendId,
    deviceId,
    kind: executionSpec.kind,
    rootRunId: executionSpec.rootRunId,
    status: "claimed",
    spec: executionSpec,
    fencing: 1,
    leaseUntil: new Date(Date.now() + 60_000).toISOString(),
    createdAt: executionSpec.createdAt,
    updatedAt: executionSpec.createdAt
  };
  return { task, taskToken: "task-token-that-is-at-least-thirty-two-characters", leaseDurationMs: 60_000, renewAfterMs };
};

const prepared = (): PreparedGitWorkspace => ({
  executionId: spec().taskId,
  rootRunId: spec().rootRunId,
  projectId: "project-1",
  repositoryUrl: "https://example.test/repo.git",
  mode: "managed-worktree",
  path: "/tmp/worktree",
  headSha: "c".repeat(40),
  treeSha: "f".repeat(40),
  snapshotHash: "e".repeat(64),
  branch: "ballet/run/10000000-000",
  repositoryPath: "/tmp/repo",
  lockPath: "/tmp/lock"
});

class FakeGitManager {
  readonly finalized: boolean[] = [];
  releases = 0;
  async prepare() { return prepared(); }
  async finalize(_workspace: PreparedGitWorkspace, success: boolean): Promise<FinalizedGitWorkspace> {
    this.finalized.push(success);
    return {
      success,
      retained: !success,
      branch: prepared().branch,
      worktreePath: prepared().path,
      commitSha: success ? "1".repeat(40) : undefined,
      changedFiles: ["src/change.ts"],
      snapshotHash: prepared().snapshotHash
    };
  }
  async release(): Promise<void> { this.releases += 1; }
  async acknowledgeFinalization(): Promise<void> {}
}

describe("LeaseAwareJobRunner", () => {
  it("rejects malformed lease timing metadata before starting the provider", async () => {
    const transport = new FakeDaemonControlPlane();
    const git = new FakeGitManager();
    const adapter = new FakeCliRuntimeAdapter("codex");
    const runner = new LeaseAwareJobRunner({
      deviceId,
      adapters: [adapter],
      runtimeBackends: [{ id: backendId, provider: "codex" }],
      transport,
      git: git as unknown as GitWorkspaceManager
    });
    const malformed = { ...claim(), renewAfterMs: undefined } as unknown as ClaimedExecutionTask;

    await expect(runner.run(malformed)).rejects.toThrow("invalid lease timing metadata");
    expect(transport.states).toEqual([]);
    expect(git.finalized).toEqual([]);
  });

  it("streams normalized events, commits the terminal root run, and completes with Git artifacts", async () => {
    const transport = new FakeDaemonControlPlane();
    const git = new FakeGitManager();
    const adapter = new FakeCliRuntimeAdapter("codex", "0.0.0", [
      { type: "execution.started", executionId: spec().taskId, provider: "codex", at: "2026-07-11T00:00:00.000Z" },
      { type: "execution.completed", sessionId: "session-1", output: "done", structuredOutput: { outcome: "ready", summary: "Done.", checks: [] } }
    ]);
    const runner = new LeaseAwareJobRunner({
      deviceId,
      adapters: [adapter],
      runtimeBackends: [{ id: backendId, provider: "codex" }],
      transport,
      git: git as unknown as GitWorkspaceManager
    });

    await runner.run(claim());

    expect(git.finalized).toEqual([true]);
    expect(transport.states).toEqual(["preparing", "running"]);
    expect(transport.events.flat().map((event) => event.sequence)).toEqual([0, 1]);
    expect(transport.completed[0]?.outcome.artifacts).toMatchObject({ branch: prepared().branch });
    expect(transport.rootFinalizations[0]).toMatchObject({
      commitSha: "1".repeat(40),
      changedFiles: ["src/change.ts"],
      branch: prepared().branch,
      success: true,
      retained: false
    });
  });

  it("aborts and cancels the provider immediately when lease renewal is rejected", async () => {
    const transport = new FakeDaemonControlPlane();
    transport.leaseResult = { accepted: false };
    const git = new FakeGitManager();
    const adapter = new BlockingAdapter();
    const runner = new LeaseAwareJobRunner({
      deviceId,
      adapters: [adapter],
      runtimeBackends: [{ id: backendId, provider: "codex" }],
      transport,
      git: git as unknown as GitWorkspaceManager
    });

    await expect(runner.run(claim(250))).rejects.toBeInstanceOf(LeaseLostError);
    expect(adapter.cancelCalls).toContain(spec().taskId);
    expect(git.finalized).toEqual([false]);
    expect(transport.failed[0]).toMatchObject({ errorCode: "runtime_lost" });
  });

  it("interrupts a hanging renewal no later than the fenced lease deadline", async () => {
    const transport = new FakeDaemonControlPlane();
    transport.renewLease = async (_claim: ClaimedExecutionTask, signal?: AbortSignal) => new Promise<LeaseResult>((_resolve, reject) => {
      signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
    });
    const git = new FakeGitManager();
    const adapter = new BlockingAdapter();
    const runner = new LeaseAwareJobRunner({
      deviceId,
      adapters: [adapter],
      runtimeBackends: [{ id: backendId, provider: "codex" }],
      transport,
      git: git as unknown as GitWorkspaceManager
    });
    const shortLease = claim(250);
    shortLease.task.leaseUntil = new Date(Date.now() + 300).toISOString();

    await expect(runner.run(shortLease)).rejects.toBeInstanceOf(LeaseLostError);
    expect(adapter.cancelCalls).toContain(spec().taskId);
    expect(transport.failed[0]).toMatchObject({ errorCode: "runtime_lost" });
  });

  it("ACKs a requested cancellation without reporting runtime loss", async () => {
    const transport = new FakeDaemonControlPlane();
    transport.leaseResult = { accepted: true, cancelRequested: true };
    const git = new FakeGitManager();
    const adapter = new BlockingAdapter();
    const runner = new LeaseAwareJobRunner({
      deviceId,
      adapters: [adapter],
      runtimeBackends: [{ id: backendId, provider: "codex" }],
      transport,
      git: git as unknown as GitWorkspaceManager
    });

    await expect(runner.run(claim(250))).rejects.toBeInstanceOf(TaskCancelledError);
    expect(adapter.cancelCalls).toContain(spec().taskId);
    expect(transport.cancelled).toEqual([{ worktreePath: prepared().path }]);
    expect(transport.failed).toEqual([]);
    expect(git.finalized).toEqual([false]);
  });

  it("ACKs cancellation when it races with the terminal complete request", async () => {
    const transport = new FakeDaemonControlPlane();
    transport.complete = async () => {
      throw new DaemonTransportError("Control-plane request returned 409: cancellation has already been requested", 409);
    };
    const git = new FakeGitManager();
    const adapter = new FakeCliRuntimeAdapter("codex", "0.0.0", [
      { type: "execution.completed", output: "done", structuredOutput: { outcome: "ready", summary: "Done.", checks: [] } }
    ]);
    const runner = new LeaseAwareJobRunner({
      deviceId,
      adapters: [adapter],
      runtimeBackends: [{ id: backendId, provider: "codex" }],
      transport,
      git: git as unknown as GitWorkspaceManager
    });

    await expect(runner.run(claim())).rejects.toBeInstanceOf(TaskCancelledError);
    expect(transport.cancelled).toEqual([{ worktreePath: prepared().path }]);
    expect(transport.failed).toEqual([]);
    expect(git.finalized).toEqual([false]);
  });

  it("keeps the shared root worktree when completion says the root run is not terminal", async () => {
    const transport = new FakeDaemonControlPlane();
    transport.completeDisposition = { rootDisposition: { terminal: false, success: false } };
    const git = new FakeGitManager();
    const adapter = new FakeCliRuntimeAdapter("codex", "0.0.0", [
      { type: "execution.completed", output: "done", structuredOutput: { outcome: "ready", summary: "Step done.", checks: [] } }
    ]);
    const runner = new LeaseAwareJobRunner({
      deviceId,
      adapters: [adapter],
      runtimeBackends: [{ id: backendId, provider: "codex" }],
      transport,
      git: git as unknown as GitWorkspaceManager
    });

    await runner.run(claim());

    expect(git.finalized).toEqual([]);
    expect(git.releases).toBe(1);
    expect(transport.rootFinalizations).toEqual([]);
  });
});

class BlockingAdapter extends FakeCliRuntimeAdapter implements CliRuntimeAdapter {
  readonly cancelCalls: string[] = [];
  constructor() { super("codex"); }
  override async *execute(request: RuntimeExecutionRequest): AsyncIterable<RuntimeEvent> {
    yield { type: "execution.started", executionId: request.executionId, provider: "codex", at: new Date().toISOString() };
    await new Promise<void>((_resolve, reject) => {
      request.signal?.addEventListener("abort", () => reject(request.signal?.reason), { once: true });
    });
  }
  override async cancel(executionId: string): Promise<void> { this.cancelCalls.push(executionId); }
}
