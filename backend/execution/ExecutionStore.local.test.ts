import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  validationNodeOutcomeJsonSchema
} from "../../shared/api/runtime-schemas.js";
import { LocalDatabase } from "../storage/LocalDatabase.js";
import { canonicalJson } from "../runtime/state/CanonicalJson.js";
import { ExecutionStore } from "./ExecutionStore.js";
import { specification } from "./LocalExecutionQueue.test-data.js";

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
    const finished = fixture.store.finish("running", "succeeded", { outcome: completedWorkOutcome });

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
    fixture.reopen();

    const recovered = fixture.store.recoverInterrupted();

    expect(recovered).toHaveLength(1);
    expect(recovered[0]).toMatchObject({
      id: "running",
      status: "failed",
      errorCode: "interrupted",
      errorMessage: expect.stringContaining("was not replayed")
    });
    expect(fixture.store.require("queued").status).toBe("queued");
    expect(fixture.connection().prepare(`
      SELECT status, state_revision_after FROM node_runs WHERE node_run_id = 'node-running'
    `).get()).toEqual({ status: "interrupted", state_revision_after: 0 });
    expect(fixture.connection().prepare(`
      SELECT status, state_revision_after FROM work_loop_node_runs WHERE work_loop_node_run_id = 'work-loop-running'
    `).get()).toEqual({ status: "failed", state_revision_after: 0 });
    expect(fixture.connection().prepare("SELECT current_state_revision FROM root_runs WHERE root_run_id = 'root-1'").pluck().get())
      .toBe(0);
    expect(fixture.connection().prepare("SELECT kind FROM control_flow_events").pluck().all())
      .toEqual(["execution_interrupted"]);
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

});

describe("ExecutionStore outcome contracts", () => {
  it("keeps a terminal result idempotent", async () => {
    const fixture = await createFixture();
    fixture.insertRoot("root-1");
    fixture.store.create(specification("task", "root-1"));

    const completed = fixture.store.finish("task", "succeeded", { outcome: completedWorkOutcome });
    const replayed = fixture.store.finish("task", "failed", { errorCode: "late", errorMessage: "late failure" });

    expect(replayed).toEqual(completed);
    expect(replayed.status).toBe("succeeded");
    expect(replayed.errorCode).toBeUndefined();
    fixture.close();
  });

  it("canonicalizes only the immutable task role outcome before persistence", async () => {
    const fixture = await createFixture();
    fixture.insertRoot("root-1");
    fixture.store.create(specification("task", "root-1"));

    expect(() => fixture.store.finish("task", "succeeded", { outcome: {
      role: "validation", state: "completed", decision: "OK", summary: "Wrong role.", evidence: {}, checks: []
    } })).toThrow();
    expect(fixture.store.require("task").status).toBe("queued");

    const completed = fixture.store.finish("task", "succeeded", { outcome: {
      role: "work", state: "completed", summary: "Canonical.", artifacts: { z: 1, a: 2 }, checks: []
    } });
    expect(completed.outcome).toMatchObject({ role: "work", state: "completed" });
    expect(fixture.connection().prepare(
      "SELECT outcome_json FROM execution_tasks WHERE task_id = 'task'"
    ).pluck().get()).toBe(
      '{"artifacts":{"a":2,"z":1},"checks":[],"role":"work","state":"completed","summary":"Canonical."}'
    );
    fixture.close();
  });

  it("rejects output schema evidence for a different Node role", async () => {
    const fixture = await createFixture();
    fixture.insertRoot("root-1");
    const invalid = specification("task", "root-1");
    invalid.evidence.outputSchema = validationNodeOutcomeJsonSchema;
    invalid.evidence.outputSchemaId = "validation-node-outcome-v3";
    invalid.evidence.outputSchemaSha256 = sha256(canonicalJson(validationNodeOutcomeJsonSchema));
    expect(() => fixture.store.create(invalid)).toThrow(/output schema evidence/);
    fixture.close();
  });

  it("rejects Task Envelope hash evidence that does not match the exact prompt section", async () => {
    const fixture = await createFixture();
    fixture.insertRoot("root-1");
    const invalid = specification("task", "root-1");
    invalid.evidence.taskEnvelopeSha256 = "0".repeat(64);
    expect(() => fixture.store.create(invalid)).toThrow(/Task Envelope evidence/);
    fixture.close();
  });
});

const completedWorkOutcome = {
  role: "work" as const,
  state: "completed" as const,
  summary: "Completed.",
  artifacts: {},
  checks: []
};

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
  const filename = path.join(root, "state.sqlite");
  let database = new LocalDatabase(filename);
  const connection = () => database.connection();
  const store = new ExecutionStore(connection);
  const insertRoot = (rootRunId: string): void => {
    const timestamp = "2026-01-01T00:00:00.000Z";
    connection().transaction(() => {
      connection().prepare(`
        INSERT INTO root_runs (
          root_run_id, kind, target_id, source, status, worktree_path, branch, head_sha,
          config_hash, snapshot_hash, execution_snapshot_json, current_state_revision,
          transition_count, created_at, updated_at
        ) VALUES (?, 'loop', 'delivery', 'manual', 'queued', ?, ?, ?, ?, ?, '{}', 0, 0, ?, ?)
      `).run(rootRunId, path.join(root, "worktrees", rootRunId), `ballet/run/${rootRunId}`,
        "a".repeat(40), "b".repeat(64), "c".repeat(64), timestamp, timestamp);
      connection().prepare(`
        INSERT INTO state_revisions (root_run_id, revision, state_json, state_hash, created_at)
        VALUES (?, 0, '{}', ?, ?)
      `).run(rootRunId, sha256("{}"), timestamp);
      connection().prepare(`
        INSERT INTO loop_invocations (
          loop_run_id, root_run_id, loop_id, source, status, entry_state_revision,
          nesting_depth, created_at, updated_at
        ) VALUES (?, ?, 'delivery', 'manual', 'running', 0, 0, ?, ?)
      `).run(`loop-${rootRunId}`, rootRunId, timestamp, timestamp);
      for (const taskId of ["task-a", "task-b", "queued", "running", "task"]) {
        connection().prepare(`
          INSERT OR IGNORE INTO work_loop_node_runs (
            work_loop_node_run_id, root_run_id, loop_run_id, loop_id, work_loop_node_id,
            attempt, status, state_revision_before, created_at, updated_at
          ) VALUES (?, ?, ?, 'delivery', ?, 1, 'running', 0, ?, ?)
        `).run(`work-loop-${taskId}`, rootRunId, `loop-${rootRunId}`, taskId, timestamp, timestamp);
        connection().prepare(`
          INSERT OR IGNORE INTO node_runs (
            node_run_id, root_run_id, loop_run_id, work_loop_node_run_id, role, loop_id,
            work_loop_node_id, node_definition_id, status, attempt, state_revision_before,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, 'work', 'delivery', ?, ?, 'queued', 1, 0, ?, ?)
        `).run(`node-${taskId}`, rootRunId, `loop-${rootRunId}`, `work-loop-${taskId}`,
          taskId, `delivery:${taskId}:work`, timestamp, timestamp);
      }
    })();
  };
  const markRunning = (taskId: string): void => {
    connection().prepare(`
      UPDATE execution_tasks SET status = 'running', started_at = updated_at WHERE task_id = ?
    `).run(taskId);
    connection().prepare(`
      UPDATE node_runs SET status = 'running', started_at = updated_at WHERE node_run_id = ?
    `).run(`node-${taskId}`);
  };
  return {
    store,
    connection,
    insertRoot,
    markRunning,
    reopen: () => {
      database.close();
      database = new LocalDatabase(filename);
    },
    close: () => database.close()
  };
};
