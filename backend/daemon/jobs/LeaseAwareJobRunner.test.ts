import { describe, expect, it, vi } from "vitest";
import type { LocalDaemonTaskClaim } from "../../../shared/domain/runtime.js";
import type { ExecutionSpecV16 } from "../../../shared/orchestration/execution.js";
import { FakeCliRuntimeAdapter } from "../providers/FakeCliRuntimeAdapter.js";
import type { LocalDaemonTransport } from "../transport/LocalDaemonTransport.js";
import { LeaseAwareJobRunner } from "./LeaseAwareJobRunner.js";

describe("LeaseAwareJobRunner", () => {
  it("executes the immutable v14 spec in the server-owned read-only worktree", async () => {
    const transport = {
      renew: vi.fn(async () => ({ accepted: true, leaseUntil: "2099-08-29T12:01:00.000Z", cancelRequested: false })),
      appendEvents: vi.fn(async (_claim, events) => ({ accepted: events.length })),
      complete: vi.fn(async () => ({ applied: true })), fail: vi.fn(async () => ({ applied: true }))
    } as unknown as LocalDaemonTransport;
    const adapter = new FakeCliRuntimeAdapter("codex", "0.0.0", [
      { type: "execution.started", executionId: "task-1", provider: "codex", at: "2026-08-29T12:00:00.000Z" },
      { type: "execution.completed", output: JSON.stringify({ version: 11, role: "validation", phase: "precheck",
        decision: "done", summary: "Validated", checks: [] }) }
    ], [{ id: "gpt", name: "GPT", reasoningOptions: ["high"] }]);
    const runner = new LeaseAwareJobRunner({ adapters: [adapter], transport });
    const claim = taskClaim();
    await runner.run(claim);
    expect(adapter.executions).toHaveLength(1);
    expect(adapter.executions[0]).toMatchObject({ workspaceAccess: "read-only", workingDirectory: "/tmp/ballet-worktree" });
    expect(await adapter.executions[0]!.permissionPolicy!.authorize({
      provider: "codex", kind: "write", operation: "write", path: "/tmp/ballet-worktree/README.md"
    })).toBe(false);
    expect(transport.complete).toHaveBeenCalledWith(claim, "codex:task-1:1", expect.stringContaining("Validated"), expect.any(AbortSignal));
  });
});

const taskClaim = (): LocalDaemonTaskClaim => ({
  taskId: "task-1", fencing: 1, leaseUntil: "2099-08-29T12:01:00.000Z",
  leaseDurationMs: 60_000, renewAfterMs: 20_000, spec: spec(),
  permissions: { workspaceAccess: "read-only" }
});
const spec = (): ExecutionSpecV16 => ({
  version: 16, taskId: "task-1", kind: "agent_execution", environmentRunId: "run-1", agentRunId: "agent-run-1",
  evidence: {
    compositionVersion: 14, role: "validation", phase: "precheck",
    subject: { kind: "action_role", actionId: "action-1", role: "validation" },
    resources: [], prompt: "Inspect.", promptSha256: "a".repeat(64),
    taskEnvelopeVersion: 11, taskEnvelopeSha256: "b".repeat(64), outputSchemaVersion: 11,
    outputSchemaId: "validation-outcome-v11", outputSchemaSha256: "c".repeat(64)
  },
  runtime: { subject: { kind: "action_role", actionId: "action-1", role: "validation" }, provider: "codex", cliVersion: "999.0.0", model: "gpt",
    reasoningEffort: "high", capabilityHash: "d".repeat(64) },
  permissions: { workspaceAccess: "read-only", approvalPolicy: "never" },
  project: { checkoutRoot: "/tmp/ballet-worktree", headSha: "e".repeat(40),
    configHash: "f".repeat(64), snapshotHash: "0".repeat(64) }, createdAt: "2026-08-29T12:00:00.000Z"
});
