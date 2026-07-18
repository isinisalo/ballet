import Database from "better-sqlite3";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LocalDatabase } from "./LocalDatabase.js";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("LocalDatabase schema v2", () => {
  it("creates only the checkout-local tables in the clean schema", async () => {
    const database = await createDatabase();
    const connection = database.connection();
    const tables = (connection.prepare(`
      SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name
    `).all() as Array<{ name: string }>).map(({ name }) => name);

    expect(tables).toEqual([
      "execution_events",
      "execution_tasks",
      "loop_runs",
      "loop_schedule_state",
      "metadata",
      "root_runs",
      "step_runs"
    ]);
    expect(connection.pragma("foreign_keys", { simple: true })).toBe(1);
    expect(connection.prepare("SELECT value FROM metadata WHERE key = 'schema_version'").pluck().get()).toBe("2");
    database.close();
  });

  it("contains no project, device, backend, lease, token, or fencing columns", async () => {
    const database = await createDatabase();
    const connection = database.connection();
    const tableNames = ["root_runs", "loop_runs", "step_runs", "execution_tasks", "execution_events", "loop_schedule_state"];
    const forbidden = new Set([
      "project_id", "device_id", "runtime_backend_id", "checkout_id", "lease_id",
      "lease_expires_at", "claim_token", "daemon_token", "fencing_token", "session_id"
    ]);

    for (const table of tableNames) {
      const columns = connection.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
      expect(columns.filter(({ name }) => forbidden.has(name)), table).toEqual([]);
    }
    database.close();
  });

  it("enforces root ownership through foreign keys", async () => {
    const database = await createDatabase();
    const connection = database.connection();

    expect(() => connection.prepare(`
      INSERT INTO execution_tasks (
        task_id, provider, kind, root_run_id, status, spec_json, spec_hash, created_at, updated_at
      ) VALUES ('task', 'codex', 'agent_run', 'missing-root', 'queued', '{}', 'hash', 'now', 'now')
    `).run()).toThrow(/FOREIGN KEY constraint failed/);
    database.close();
  });

  it("migrates schema v1 state to v2 without removing persisted tables", async () => {
    const root = await temporaryRoot();
    const filename = path.join(root, "state.sqlite");
    const initial = new LocalDatabase(filename);
    const connection = initial.connection();
    connection.exec(`
      INSERT INTO root_runs (
        root_run_id, kind, target_id, source, status, worktree_path, branch,
        head_sha, config_hash, snapshot_hash, created_at, updated_at
      ) VALUES ('root', 'loop', 'delivery', 'manual', 'running', '/tmp/worktree',
        'ballet/run/root', 'head', 'config', 'snapshot', 'now', 'now');
      INSERT INTO loop_runs (
        run_id, loop_id, root_run_id, source, status, snapshot_json,
        transition_count, created_at, updated_at
      ) VALUES ('run', 'delivery', 'root', 'manual', 'running', '{}', 0, 'now', 'now');
      INSERT INTO step_runs (
        step_run_id, run_id, loop_id, step_id, step_type, agent_id,
        status, result, outcome_json, attempt, created_at, updated_at, completed_at
      ) VALUES ('blocked-step', 'run', 'delivery', 'review', 'agent', 'reviewer',
        'completed', 'rejected', '{"outcome":"blocked","summary":"Blocked.","checks":[]}',
        1, '1', '1', '1');
      INSERT INTO execution_tasks (
        task_id, provider, kind, root_run_id, status, spec_json, spec_hash, created_at, updated_at
      ) VALUES ('task', 'codex', 'loop_step', 'root', 'queued', '{}', 'hash', '2', '2');
      INSERT INTO step_runs (
        step_run_id, run_id, loop_id, step_id, step_type, agent_id, execution_task_id,
        status, attempt, created_at, updated_at
      ) VALUES ('step', 'run', 'delivery', 'work', 'agent', 'builder', 'task', 'queued', 0, '2', '2');
      INSERT INTO loop_runs (
        run_id, loop_id, root_run_id, source, status, snapshot_json,
        transition_count, created_at, updated_at
      ) VALUES ('failure-run', 'legacy-failure', 'root', 'manual', 'running', '{}', 0, '3', '3');
      INSERT INTO step_runs (
        step_run_id, run_id, loop_id, step_id, step_type, agent_id,
        status, result, error, attempt, created_at, updated_at, completed_at
      ) VALUES ('failure-step', 'failure-run', 'legacy-failure', 'review', 'agent', 'reviewer',
        'failed', 'rejected', 'Provider exited unexpectedly.', 1, '3', '3', '3');
      INSERT INTO execution_tasks (
        task_id, provider, kind, root_run_id, status, spec_json, spec_hash, created_at, updated_at
      ) VALUES ('failure-task', 'codex', 'loop_step', 'root', 'queued', '{}', 'hash', '4', '4');
      INSERT INTO step_runs (
        step_run_id, run_id, loop_id, step_id, step_type, agent_id, execution_task_id,
        status, attempt, created_at, updated_at
      ) VALUES ('failure-next', 'failure-run', 'legacy-failure', 'repair', 'agent', 'builder',
        'failure-task', 'queued', 1, '4', '4');
      ALTER TABLE root_runs DROP COLUMN termination_json;
      ALTER TABLE loop_runs DROP COLUMN termination_json;
      ALTER TABLE step_runs DROP COLUMN transition_json;
      ALTER TABLE step_runs DROP COLUMN retry_of_step_run_id;
      UPDATE metadata SET value = '1' WHERE key = 'schema_version';
    `);
    initial.close();

    const migrated = new LocalDatabase(filename);
    const migratedConnection = migrated.connection();
    expect(migratedConnection.prepare("SELECT value FROM metadata WHERE key = 'schema_version'").pluck().get()).toBe("2");
    expect(columnNames(migratedConnection, "root_runs")).toContain("termination_json");
    expect(columnNames(migratedConnection, "loop_runs")).toContain("termination_json");
    expect(columnNames(migratedConnection, "step_runs")).toEqual(expect.arrayContaining(["transition_json", "retry_of_step_run_id"]));
    expect(migratedConnection.prepare("SELECT attempt FROM step_runs WHERE step_run_id = 'step'").pluck().get()).toBe(1);
    expect(migratedConnection.prepare("SELECT status FROM step_runs WHERE step_run_id = 'step'").pluck().get()).toBe("cancelled");
    expect(migratedConnection.prepare("SELECT status FROM execution_tasks WHERE task_id = 'task'").pluck().get()).toBe("cancelled");
    expect(migratedConnection.prepare("SELECT status FROM step_runs WHERE step_run_id = 'blocked-step'").pluck().get()).toBe("blocked");
    expect(migratedConnection.prepare("SELECT result FROM step_runs WHERE step_run_id = 'blocked-step'").pluck().get()).toBe("blocked");
    expect(JSON.parse(migratedConnection.prepare("SELECT termination_json FROM loop_runs WHERE run_id = 'run'").pluck().get() as string))
      .toMatchObject({ code: "agent_blocked", signal: { kind: "agent", outcome: "blocked" } });
    expect(migratedConnection.prepare("SELECT status FROM execution_tasks WHERE task_id = 'failure-task'").pluck().get()).toBe("cancelled");
    expect(migratedConnection.prepare("SELECT status FROM step_runs WHERE step_run_id = 'failure-next'").pluck().get()).toBe("cancelled");
    expect(migratedConnection.prepare("SELECT status FROM step_runs WHERE step_run_id = 'failure-step'").pluck().get()).toBe("failed");
    expect(migratedConnection.prepare("SELECT result FROM step_runs WHERE step_run_id = 'failure-step'").pluck().get()).toBe("failed");
    expect(JSON.parse(migratedConnection.prepare("SELECT outcome_json FROM step_runs WHERE step_run_id = 'failure-step'").pluck().get() as string))
      .toMatchObject({ outcome: "failed", failure: { classification: "permanent", code: "execution_failed" } });
    expect(JSON.parse(migratedConnection.prepare("SELECT termination_json FROM loop_runs WHERE run_id = 'failure-run'").pluck().get() as string))
      .toMatchObject({ status: "failed", code: "execution_failed", signal: { kind: "agent", outcome: "failed" } });
    migrated.close();
  });

  it("leaves an unversioned legacy database unchanged and fails closed", async () => {
    const root = await temporaryRoot();
    const filename = path.join(root, "state.sqlite");
    const legacy = new Database(filename);
    legacy.exec("CREATE TABLE legacy_pairings (id TEXT PRIMARY KEY);");
    legacy.close();
    const database = new LocalDatabase(filename);

    expect(() => database.connection()).toThrow("Ballet state database has no schema version");

    const untouched = new Database(filename, { readonly: true });
    const tables = untouched.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").pluck().all();
    expect(tables).toContain("legacy_pairings");
    expect(tables).not.toContain("metadata");
    expect(tables).not.toContain("root_runs");
    untouched.close();
  });

  it("rejects an unknown schema version without migrating it", async () => {
    const root = await temporaryRoot();
    const filename = path.join(root, "state.sqlite");
    const future = new Database(filename);
    future.exec("CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);");
    future.prepare("INSERT INTO metadata (key, value) VALUES ('schema_version', '3')").run();
    future.close();
    const database = new LocalDatabase(filename);

    expect(() => database.connection()).toThrow("Unsupported Ballet state schema 3; expected 2.");
  });
});

const createDatabase = async (): Promise<LocalDatabase> => {
  const root = await temporaryRoot();
  return new LocalDatabase(path.join(root, ".git", "ballet", "state.sqlite"));
};

const temporaryRoot = async (): Promise<string> => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ballet-local-db-"));
  temporaryRoots.push(root);
  return root;
};

const columnNames = (connection: Database.Database, table: string): string[] =>
  (connection.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((column) => column.name);
