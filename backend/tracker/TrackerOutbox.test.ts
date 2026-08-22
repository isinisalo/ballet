import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import type { StoredRootRun } from "../runs/RootRunStore.js";
import { runtimeSchema } from "../storage/RuntimeSchema.js";
import type { TkTracker } from "./TkTracker.js";
import { TrackerOutbox } from "./TrackerOutbox.js";

const connections: Database.Database[] = [];
afterEach(() => connections.splice(0).forEach((connection) => connection.close()));

describe("TrackerOutbox GraphNode reconciliation", () => {
  it("materializes one root and GraphNode ticket and closes both exactly once", async () => {
    const connection = fixtureDatabase("completed");
    const calls: string[] = [];
    const tracker = fakeTracker(calls);
    const outbox = new TrackerOutbox(() => connection, tracker);

    await expect(outbox.reconcileOrPause(fixtureRoot("completed"))).resolves.toBe(true);
    await expect(outbox.reconcileOrPause(fixtureRoot("completed"))).resolves.toBe(true);

    expect(connection.prepare("SELECT COUNT(*) FROM tracker_links").pluck().get()).toBe(2);
    expect(connection.prepare("SELECT COUNT(*) FROM tracker_outbox WHERE status = 'applied'").pluck().get()).toBe(6);
    expect(calls).toEqual([
      "upsert:ballet-root:root-1",
      "upsert:ballet-graph-node-invocation:graph-node-invocation-1",
      "start:ticket-1", "start:ticket-2", "close:ticket-2", "close:ticket-1"
    ]);
  });

  it("preserves a terminal status across a failed partial reconciliation and resumes idempotently", async () => {
    const connection = fixtureDatabase("completed");
    const calls: string[] = [];
    let unavailable = true;
    const outbox = new TrackerOutbox(() => connection, fakeTracker(calls, () => unavailable));

    await expect(outbox.reconcileOrPause(fixtureRoot("completed"))).resolves.toBe(false);
    expect(connection.prepare(
      "SELECT status FROM root_runs WHERE root_run_id = 'root-1'"
    ).pluck().get()).toBe("waiting_for_input");
    expect(connection.prepare(
      "SELECT finalization_terminal_status FROM root_runs WHERE root_run_id = 'root-1'"
    ).pluck().get()).toBe("completed");

    unavailable = false;
    await expect(outbox.reconcileOrPause(fixtureRoot("waiting_for_input"))).resolves.toBe(true);
    expect(connection.prepare(
      "SELECT status FROM root_runs WHERE root_run_id = 'root-1'"
    ).pluck().get()).toBe("completed");
    expect(connection.prepare("SELECT COUNT(*) FROM tracker_links").pluck().get()).toBe(2);
    expect(connection.prepare("SELECT COUNT(*) FROM tracker_outbox").pluck().get()).toBe(6);
  });
});

const fixtureDatabase = (status: "running" | "completed"): Database.Database => {
  const connection = new Database(":memory:");
  connections.push(connection);
  connection.pragma("foreign_keys = ON");
  connection.exec(runtimeSchema);
  connection.prepare(`
    INSERT INTO root_runs (
      root_run_id, kind, target_id, source, status, worktree_path, branch, head_sha,
      config_hash, snapshot_hash, execution_snapshot_json, created_at, updated_at, completed_at
    ) VALUES ('root-1', 'graph', 'graph-engineering', 'manual', ?, '/tmp/worktree',
      'ballet/run/root-1', 'head', 'config', 'snapshot', '{}', 'now', 'now', ?)
  `).run(status, status === "completed" ? "now" : null);
  connection.prepare(`
    INSERT INTO graph_node_invocations (
      graph_node_invocation_id, root_run_id, graph_node_id, source, status,
      snapshot_json, entry_state_revision, completion_state_revision, nesting_depth,
      created_at, updated_at, completed_at
    ) VALUES ('graph-node-invocation-1', 'root-1', 'design', 'orchestrator', 'completed',
      '{}', 0, 0, 0, 'now', 'now', 'now')
  `).run();
  return connection;
};

const fixtureRoot = (status: "waiting_for_input" | "completed"): StoredRootRun => ({
  rootRunId: "root-1", kind: "graph", targetId: "graph-engineering", source: "manual", status,
  stateRevision: 0, transitionCount: 0, worktreePath: "/tmp/worktree", branch: "ballet/run/root-1",
  headSha: "head", configHash: "config", snapshotHash: "snapshot", createdAt: "now", updatedAt: "now",
  executionSnapshot: {
    graph: { name: "Graph Engineering" },
    issueTracker: {
      kind: "tk", testedRevision: "revision",
      orchestrationDirectory: ".tickets/orchestration", workDirectory: ".tickets/work"
    }
  }
} as unknown as StoredRootRun);

const fakeTracker = (
  calls: string[], unavailable: () => boolean = () => false
): TkTracker => {
  const fail = () => { if (unavailable()) throw new Error("tracker unavailable"); };
  return {
    upsert: async (_worktree: string, _config: unknown, _store: string, input: { externalRef: string }) => {
      fail();
      calls.push(`upsert:${input.externalRef}`);
      return { id: `ticket-${calls.filter((call) => call.startsWith("upsert:")).length}` };
    },
    start: async (_worktree: string, _config: unknown, _store: string, ticketId: string) => {
      fail(); calls.push(`start:${ticketId}`);
    },
    close: async (_worktree: string, _config: unknown, _store: string, ticketId: string) => {
      fail(); calls.push(`close:${ticketId}`);
    },
    reopen: async () => { fail(); },
    note: async () => { fail(); }
  } as unknown as TkTracker;
};
