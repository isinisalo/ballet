import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { stepOutcomeJsonSchema } from "../../shared/api/runtime-schemas.js";
import type { ExecutionSpec } from "../../shared/domain/runtime.js";
import { LocalDatabase } from "../storage/LocalDatabase.js";
import { ExecutionStore } from "./ExecutionStore.js";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("ExecutionStore", () => {
  it("persists immutable queued task specifications in provider FIFO order", async () => {
    const fixture = await createFixture();
    fixture.insertRoot("root-1");
    const first = fixture.store.create(specification("task-a", "root-1", "codex", "2026-01-01T00:00:00.000Z"));
    fixture.store.create(specification("task-b", "root-1", "codex", "2026-01-01T00:00:00.000Z"));

    expect(first.status).toBe("queued");
    expect(fixture.store.queued("codex")?.id).toBe("task-a");
    expect(fixture.store.listByRoot("root-1").map(({ id }) => id)).toEqual(["task-a", "task-b"]);
    expect(() => fixture.connection().prepare(
      "UPDATE execution_tasks SET spec_json = '{}' WHERE task_id = 'task-a'"
    ).run()).toThrow("execution task specification is immutable");
    fixture.close();
  });

  it("records cancellation requests separately for queued and running tasks", async () => {
    const fixture = await createFixture();
    fixture.insertRoot("root-1");
    fixture.store.create(specification("queued", "root-1"));
    fixture.store.create(specification("running", "root-1"));
    fixture.markRunning("running");

    const queued = fixture.store.requestCancel("queued");
    const requested = fixture.store.requestCancel("running");
    const finished = fixture.store.finish("running", "succeeded", { outcome: approvedOutcome });

    expect(queued).toMatchObject({ status: "cancelled", cancelRequestedAt: expect.any(String) });
    expect(requested).toMatchObject({ status: "running", cancelRequestedAt: expect.any(String) });
    expect(finished).toMatchObject({ status: "cancelled", cancelRequestedAt: requested.cancelRequestedAt });
    expect(finished.outcome).toBeUndefined();
    fixture.close();
  });

  it("keeps running Root tasks active until their workers drain", async () => {
    const fixture = await createFixture();
    fixture.insertRoot("root-1");
    fixture.store.create(specification("queued", "root-1"));
    fixture.store.create(specification("running", "root-1"));
    fixture.markRunning("running");

    const taskIds = fixture.store.cancelActiveByRoot("root-1", "2026-01-02T00:00:00.000Z");

    expect(taskIds).toEqual(["queued", "running"]);
    expect(fixture.store.require("queued")).toMatchObject({
      status: "cancelled",
      cancelRequestedAt: "2026-01-02T00:00:00.000Z",
      completedAt: "2026-01-02T00:00:00.000Z"
    });
    expect(fixture.store.require("running")).toMatchObject({
      status: "running",
      cancelRequestedAt: "2026-01-02T00:00:00.000Z",
      completedAt: undefined
    });
    fixture.close();
  });

  it("fails only interrupted running tasks on recovery and leaves queued work replayable", async () => {
    const fixture = await createFixture();
    fixture.insertRoot("root-1");
    fixture.store.create(specification("running", "root-1"));
    fixture.store.create(specification("queued", "root-1"));
    fixture.markRunning("running");

    const recovered = fixture.store.recoverInterrupted();

    expect(recovered).toHaveLength(1);
    expect(recovered[0]).toMatchObject({
      id: "running",
      status: "failed",
      errorCode: "interrupted",
      errorMessage: expect.stringContaining("was not replayed")
    });
    expect(fixture.store.require("queued").status).toBe("queued");
    fixture.close();
  });

  it("retains terminal events, caps ordinary console content, and pages by durable cursor", async () => {
    const fixture = await createFixture();
    fixture.insertRoot("root-1");
    fixture.store.create(specification("task", "root-1"));
    const timestamp = "2026-01-01T00:00:00.000Z";
    fixture.store.appendEvent("task", event(0, "terminal marker", true, timestamp));
    fixture.store.appendEvent("task", event(1, "a".repeat(600 * 1024), false, timestamp));
    fixture.store.appendEvent("task", event(2, "b".repeat(600 * 1024), false, timestamp));
    fixture.store.appendEvent("task", event(3, "tail", false, timestamp));

    const firstPage = fixture.store.events("task", 0, 1);
    const secondPage = fixture.store.events("task", firstPage.lastId, 10);
    const all = [...firstPage.entries, ...secondPage.entries];

    expect(firstPage).toMatchObject({ hasMore: true, truncated: true });
    expect(all.map(({ message }) => message)).toEqual(["terminal marker", "b".repeat(600 * 1024), "tail"]);
    expect(secondPage.lastId).toBe(all.at(-1)?.id);
    expect(secondPage.hasMore).toBe(false);
    expect(all.reduce((sum, entry) => sum + entry.contentBytes, 0)).toBeLessThanOrEqual(1024 * 1024);
    fixture.close();
  });

  it("keeps a terminal result idempotent", async () => {
    const fixture = await createFixture();
    fixture.insertRoot("root-1");
    fixture.store.create(specification("task", "root-1"));

    const completed = fixture.store.finish("task", "succeeded", { outcome: approvedOutcome });
    const replayed = fixture.store.finish("task", "failed", { errorCode: "late", errorMessage: "late failure" });

    expect(replayed).toEqual(completed);
    expect(replayed.status).toBe("succeeded");
    expect(replayed.errorCode).toBeUndefined();
    fixture.close();
  });
});

const approvedOutcome = {
  state: "completed" as const,
  result: "approved" as const,
  summary: "Approved.",
  checks: []
};

const specification = (
  taskId: string,
  rootRunId: string,
  provider: "codex" | "copilot" = "codex",
  createdAt = new Date().toISOString()
): ExecutionSpec => ({
  version: 2,
  taskId,
  kind: "loop_step",
  rootRunId,
  loopRunId: `loop-${rootRunId}`,
  stepRunId: `step-${taskId}`,
  evidence: {
    compositionVersion: 1,
    loopId: "delivery",
    stepId: taskId,
    executionProfile: {
      id: `${provider}-test-medium`,
      name: `${provider} test · Medium`,
      provider,
      model: "provider-default",
      reasoningEffort: "provider-default",
      networkAccess: false
    },
    resources: [{
      kind: "system",
      origin: "system",
      id: "system:execution-contract-v1",
      sourceSha256: "b".repeat(64)
    }, {
      kind: "primary",
      origin: "project",
      id: "project:test-instruction",
      relativePath: ".ballet/instructions/test-instruction.md",
      sourceSha256: "c".repeat(64)
    }],
    prompt: `Input for ${taskId}`,
    promptSha256: sha256(`Input for ${taskId}`),
    outputSchemaVersion: 1,
    outputSchemaSha256: sha256(JSON.stringify(stepOutcomeJsonSchema))
  },
  runtime: {
    hostname: "localhost", provider, cliVersion: "1.2.3", model: "provider-default",
    reasoning: "provider-default", policy: { network: false, readOnlyRoots: [] },
    capabilityHash: `${provider}-capabilities`
  },
  project: {
    checkoutRoot: "/checkout", headSha: "a".repeat(40), configHash: "config", snapshotHash: "snapshot"
  },
  createdAt
});

const sha256 = (value: string): string => createHash("sha256").update(value, "utf8").digest("hex");

const event = (sequence: number, message: string, terminal: boolean, createdAt: string) => ({
  sequence,
  source: "ballet" as const,
  kind: "output" as const,
  level: "info" as const,
  phase: terminal ? "completed" as const : "delta" as const,
  message,
  terminal,
  createdAt
});

const createFixture = async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ballet-execution-store-"));
  temporaryRoots.push(root);
  const database = new LocalDatabase(path.join(root, "state.sqlite"));
  const connection = () => database.connection();
  const store = new ExecutionStore(connection);
  const insertRoot = (rootRunId: string): void => {
    connection().prepare(`
      INSERT INTO root_runs (
        root_run_id, kind, target_id, source, status, worktree_path, branch, head_sha,
        config_hash, snapshot_hash, execution_snapshot_json, created_at, updated_at
      ) VALUES (?, 'loop', 'delivery', 'manual', 'queued', ?, ?, ?, 'config', 'snapshot', '{}', ?, ?)
    `).run(rootRunId, path.join(root, "worktrees", rootRunId), `ballet/run/${rootRunId}`, "a".repeat(40),
      "2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z");
  };
  const markRunning = (taskId: string): void => {
    connection().prepare(`
      UPDATE execution_tasks SET status = 'running', started_at = updated_at WHERE task_id = ?
    `).run(taskId);
  };
  return { store, connection, insertRoot, markRunning, close: () => database.close() };
};
