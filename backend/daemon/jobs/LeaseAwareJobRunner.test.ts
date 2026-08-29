import { describe, expect, it, vi } from "vitest";
import type { ExecutionSpec, ExecutionTask } from "../../../shared/domain/runtime.js";
import type { GitWorkspaceManager } from "../git/GitWorkspaceManager.js";
import type { PreparedGitWorkspace } from "../git/GitWorkspaceTypes.js";
import { FakeCliRuntimeAdapter } from "../providers/FakeCliRuntimeAdapter.js";
import { FakeDaemonControlPlane } from "../transport/FakeDaemonControlPlane.js";
import { LeaseAwareJobRunner } from "./LeaseAwareJobRunner.js";

describe("LeaseAwareJobRunner", () => {
  it("preserves read-only access through adapter execution and finalization", async () => {
    const transport = new FakeDaemonControlPlane();
    const adapter = new FakeCliRuntimeAdapter("codex", "0.0.0", [
      { type: "execution.started", executionId: "task-1", provider: "codex", at: "2026-08-29T12:00:00.000Z" },
      { type: "execution.completed", output: "done", structuredOutput: {
        outcome: "ready", summary: "Validated.", checks: [{ name: "review", status: "passed" }]
      } }
    ]);
    const workspace: PreparedGitWorkspace = {
      executionId: "task-1", rootRunId: "root-1", projectId: "project-1",
      repositoryUrl: "https://example.test/ballet.git", mode: "managed-worktree",
      path: "/tmp/ballet-worktree", headSha: "a".repeat(40), treeSha: "b".repeat(40),
      snapshotHash: "c".repeat(64), branch: "ballet/run/root-1",
      repositoryPath: "/tmp/ballet-repository", lockPath: "/tmp/ballet.lock"
    };
    const git = {
      prepare: vi.fn(async () => workspace),
      release: vi.fn(async () => undefined),
      finalize: vi.fn(async () => ({
        success: true, retained: false, branch: workspace.branch, worktreePath: workspace.path,
        commitSha: "d".repeat(40), changedFiles: [], snapshotHash: workspace.snapshotHash
      })),
      acknowledgeFinalization: vi.fn(async () => undefined)
    } as unknown as GitWorkspaceManager;
    const runner = new LeaseAwareJobRunner({
      deviceId: "device-1",
      adapters: [adapter],
      runtimeBackends: [{ id: "backend-1", provider: "codex" }],
      transport,
      git
    });

    await runner.run({
      task: task(spec("read-only")),
      taskToken: "t".repeat(32),
      leaseDurationMs: 60_000,
      renewAfterMs: 20_000
    });

    expect(adapter.executions).toHaveLength(1);
    expect(adapter.executions[0]).toMatchObject({ workspaceAccess: "read-only", workingDirectory: workspace.path });
    expect(await adapter.executions[0]!.permissionPolicy!.authorize({
      provider: "codex", kind: "write", operation: "write", path: `${workspace.path}/README.md`
    })).toBe(false);
    expect(transport.states).toEqual(["preparing", "running"]);
    expect(transport.completed).toHaveLength(1);
    expect(git.finalize).toHaveBeenCalledWith(workspace, true, expect.any(AbortSignal));
    expect(transport.rootFinalizations).toEqual([expect.objectContaining({ success: true, retained: false })]);
  });
});

const spec = (workspaceAccess: ExecutionSpec["workspaceAccess"]): ExecutionSpec => ({
  version: 1,
  projectId: "project-1",
  taskId: "task-1",
  kind: "agent_run",
  rootRunId: "root-1",
  agentRunId: "agent-run-1",
  workspaceAccess,
  agent: { id: "validation", name: "Validation", description: "Controller", instructions: "Inspect.", skillIds: [], configHash: "e".repeat(64) },
  runtime: {
    deviceId: "device-1", deviceName: "Test Mac", runtimeBackendId: "backend-1", provider: "codex",
    cliVersion: "999.0.0", model: "provider-default", reasoning: "provider-default",
    policy: { network: false, readOnlyRoots: [] }, capabilityHash: "f".repeat(64)
  },
  project: {
    checkoutId: "checkout-1", repositoryUrl: "https://example.test/ballet.git",
    headSha: "a".repeat(40), configHash: "e".repeat(64), snapshotHash: "c".repeat(64)
  },
  createdAt: "2026-08-29T12:00:00.000Z"
});

const task = (executionSpec: ExecutionSpec): ExecutionTask => ({
  id: executionSpec.taskId,
  projectId: executionSpec.projectId,
  runtimeBackendId: executionSpec.runtime.runtimeBackendId,
  deviceId: executionSpec.runtime.deviceId,
  kind: executionSpec.kind,
  rootRunId: executionSpec.rootRunId,
  status: "claimed",
  spec: executionSpec,
  fencing: 1,
  leaseUntil: "2099-08-29T12:01:00.000Z",
  claimedAt: executionSpec.createdAt,
  createdAt: executionSpec.createdAt,
  updatedAt: executionSpec.createdAt
});
