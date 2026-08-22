import Database from "better-sqlite3";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LocalDatabase } from "./LocalDatabase.js";
import { localDatabaseTableNames } from "./RuntimeSchema.js";

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

describe("LocalDatabase schema v10", () => {
  it("creates only the GraphNode runtime inventory", async () => {
    const database = await createDatabase();
    const connection = database.connection();
    const tables = connection.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    ).pluck().all();
    expect(tables).toEqual([...localDatabaseTableNames].sort());
    expect(tables).not.toEqual(expect.arrayContaining([
      "loop_invocations", "job_runs", "loop_schedule_state", "orchestration_requests", "orchestrator_routes"
    ]));
    expect(connection.prepare("SELECT value FROM metadata WHERE key = 'schema_version'").pluck().get()).toBe("10");
    expect(connection.pragma("foreign_keys", { simple: true })).toBe(1);
    database.close();
  });

  it("stores scoped agent roles and durable repair return frames", async () => {
    const database = await createDatabase();
    const connection = database.connection();
    expect(columns(connection, "node_runs")).toEqual(expect.arrayContaining([
      "graph_node_invocation_id", "job_node_invocation_id", "scope", "role", "node_definition_id"
    ]));
    expect(columns(connection, "repair_frames")).toEqual(expect.arrayContaining([
      "parent_frame_id", "return_graph_node_invocation_id", "return_job_node_invocation_id",
      "return_validation_node_id", "state_revision_at_call", "depth"
    ]));
    expect(columns(connection, "routing_requests")).toEqual(expect.arrayContaining([
      "scope", "kind", "candidate_keys_json", "attempt", "source_child_id"
    ]));
    expect(columns(connection, "graph_state_revisions")).toEqual(expect.arrayContaining([
      "root_run_id", "revision", "state_json", "state_hash", "patch_json", "source_node_run_id"
    ]));
    database.close();
  });

  it("enforces root ownership through foreign keys", async () => {
    const database = await createDatabase();
    expect(() => database.connection().prepare(`
      INSERT INTO node_runs (
        node_run_id, root_run_id, scope, role, node_definition_id, status,
        attempt, state_revision_before, created_at, updated_at
      ) VALUES ('node', 'missing', 'graph', 'orchestrator', 'orchestrator', 'queued', 1, 0, 'now', 'now')
    `).run()).toThrow(/FOREIGN KEY constraint failed/);
    database.close();
  });

  it("leaves an unversioned database unchanged", async () => {
    const filename = path.join(await temporaryRoot(), "state.sqlite");
    const legacy = new Database(filename);
    legacy.exec("CREATE TABLE legacy_pairings (id TEXT PRIMARY KEY);");
    legacy.close();
    expect(() => new LocalDatabase(filename).connection()).toThrow("has no schema version");
    const untouched = new Database(filename, { readonly: true });
    expect(untouched.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").pluck().all())
      .toEqual(["legacy_pairings"]);
    untouched.close();
  });

  it("rejects schema v9 with archive guidance and does not mutate it", async () => {
    const filename = path.join(await temporaryRoot(), "state.sqlite");
    const previous = new Database(filename);
    previous.exec(`
      CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      INSERT INTO metadata (key, value) VALUES ('schema_version', '9');
      CREATE TABLE loop_invocations (loop_run_id TEXT PRIMARY KEY);
    `);
    previous.close();
    expect(() => new LocalDatabase(filename).connection()).toThrow(
      "Unsupported Ballet state schema 9; expected 10."
    );
    const untouched = new Database(filename, { readonly: true });
    expect(untouched.prepare("SELECT value FROM metadata WHERE key = 'schema_version'").pluck().get()).toBe("9");
    expect(untouched.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").pluck().all())
      .toContain("loop_invocations");
    untouched.close();
  });
});

const columns = (connection: Database.Database, table: string): string[] =>
  (connection.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map(({ name }) => name);
const createDatabase = async () => new LocalDatabase(path.join(await temporaryRoot(), "state.sqlite"));
const temporaryRoot = async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ballet-v10-"));
  roots.push(root);
  return root;
};
