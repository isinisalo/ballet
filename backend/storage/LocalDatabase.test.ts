import Database from "better-sqlite3";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LocalDatabase } from "./LocalDatabase.js";
import { localDatabaseTableNames } from "./RuntimeSchema.js";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("LocalDatabase schema v9", () => {
  it("creates the clean Workflow runtime table inventory", async () => {
    const database = await createDatabase();
    const connection = database.connection();
    const tables = connection.prepare(`
      SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name
    `).pluck().all();

    expect(tables).toEqual([...localDatabaseTableNames].sort());
    expect(tables).not.toContain("step_runs");
    expect(tables).not.toContain("loop_runs");
    expect(connection.pragma("foreign_keys", { simple: true })).toBe(1);
    expect(connection.prepare("SELECT value FROM metadata WHERE key = 'schema_version'").pluck().get()).toBe("9");
    database.close();
  });

  it("contains the required ownership, revision, repair, and continuation columns", async () => {
    const database = await createDatabase();
    const connection = database.connection();

    expect(columns(connection, "root_runs")).toEqual(expect.arrayContaining([
      "current_state_revision", "transition_count", "active_loop_run_id", "active_node_run_id",
      "execution_snapshot_json"
    ]));
    expect(columns(connection, "state_revisions")).toEqual(expect.arrayContaining([
      "root_run_id", "revision", "state_json", "state_hash", "patch_json", "source_node_run_id"
    ]));
    expect(columns(connection, "job_runs")).toEqual(expect.arrayContaining([
      "job_run_id", "state_revision_before", "state_revision_after", "active_node_run_id"
    ]));
    expect(columns(connection, "repair_requests")).toEqual(expect.arrayContaining([
      "requester_validation_node_run_id", "orchestrator_node_run_id", "validation_summary", "attempt"
    ]));
    expect(columns(connection, "orchestration_requests")).toEqual(expect.arrayContaining([
      "kind", "source_loop_run_id", "source_node_run_id", "completion_evidence_json",
      "orchestrator_node_run_id", "routed_loop_edge_id", "target_loop_run_id"
    ]));
    expect(columns(connection, "orchestration_frames")).toEqual(expect.arrayContaining([
      "route_id", "return_validation_node_definition_id"
    ]));
    expect(columns(connection, "repair_results")).toEqual(expect.arrayContaining([
      "repair_request_id", "orchestration_frame_id", "target_loop_run_id", "state_revision", "outcome_json"
    ]));
    database.close();
  });

  it("creates the runtime lookup and active-phase indexes", async () => {
    const database = await createDatabase();
    const indexes = database.connection().prepare(`
      SELECT name FROM sqlite_master WHERE type = 'index' ORDER BY name
    `).pluck().all();

    expect(indexes).toEqual(expect.arrayContaining([
      "idx_control_flow_root", "idx_events_cursor", "idx_frames_open",
      "idx_loop_invocations_root", "idx_loop_schedule_occurrence", "idx_node_runs_job",
      "idx_one_active_node_phase", "idx_one_active_root_node", "idx_one_open_frame_per_callee",
      "idx_one_open_frame_per_caller", "idx_one_running_loop_invocation",
      "idx_orchestration_requests_pending", "idx_repair_requests_pending", "idx_repair_results_root", "idx_schedule_due",
      "idx_state_revisions_latest", "idx_tasks_node", "idx_tasks_queue", "idx_tasks_root",
      "idx_job_runs_loop"
    ]));
    database.close();
  });

  it("enforces root ownership and Node Run ownership through foreign keys", async () => {
    const database = await createDatabase();
    const connection = database.connection();

    expect(() => connection.prepare(`
      INSERT INTO execution_tasks (
        task_id, provider, kind, root_run_id, node_run_id, status,
        spec_json, spec_hash, created_at, updated_at
      ) VALUES ('task', 'codex', 'node_execution', 'missing-root', 'missing-node',
        'queued', '{}', ?, 'now', 'now')
    `).run("a".repeat(64))).toThrow(/FOREIGN KEY constraint failed/);
    database.close();
  });

  it("leaves an unversioned database unchanged and fails closed", async () => {
    const root = await temporaryRoot();
    const filename = path.join(root, "state.sqlite");
    const legacy = new Database(filename);
    legacy.exec("CREATE TABLE legacy_pairings (id TEXT PRIMARY KEY);");
    legacy.close();

    expect(() => new LocalDatabase(filename).connection()).toThrow("Ballet state database has no schema version");

    const untouched = new Database(filename, { readonly: true });
    expect(untouched.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").pluck().all())
      .toContain("legacy_pairings");
    expect(untouched.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").pluck().all())
      .not.toContain("metadata");
    untouched.close();
  });

  it("rejects schema v5 without an empty-database migration exception", async () => {
    const root = await temporaryRoot();
    const filename = path.join(root, "state.sqlite");
    const legacy = new Database(filename);
    legacy.exec(`
      CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      INSERT INTO metadata (key, value) VALUES ('schema_version', '5');
      CREATE TABLE root_runs (root_run_id TEXT PRIMARY KEY);
    `);
    legacy.close();

    expect(() => new LocalDatabase(filename).connection())
      .toThrow("Unsupported Ballet state schema 5; expected 9.");
    const untouched = new Database(filename, { readonly: true });
    expect(untouched.prepare("SELECT value FROM metadata WHERE key = 'schema_version'").pluck().get()).toBe("5");
    expect(untouched.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").pluck().all())
      .not.toContain("state_revisions");
    untouched.close();
  });

  it("rejects schema v8 with exact archive guidance instead of migrating it", async () => {
    const root = await temporaryRoot();
    const filename = path.join(root, "state.sqlite");
    const partial = new Database(filename);
    partial.exec(`
      CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      INSERT INTO metadata (key, value) VALUES ('schema_version', '8');
    `);
    partial.close();

    expect(() => new LocalDatabase(filename).connection()).toThrow(
      "Unsupported Ballet state schema 8; expected 9."
    );
  });
});

const columns = (connection: Database.Database, table: string): string[] =>
  connection.prepare(`PRAGMA table_info(${table})`).all().flatMap((value) => {
    if (typeof value === "object" && value !== null && "name" in value && typeof value.name === "string") {
      return [value.name];
    }
    throw new Error(`Invalid ${table} column row.`);
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
