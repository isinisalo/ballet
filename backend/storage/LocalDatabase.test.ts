import Database from "better-sqlite3";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LocalDatabase } from "./LocalDatabase.js";
import { localDatabaseTableNames } from "./RuntimeSchema.js";

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

describe("LocalDatabase strict schema v14", () => {
  it("creates only the Reward-MDP runtime inventory", async () => {
    const database = await createDatabase();
    const connection = database.connection();
    const tables = connection.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    ).pluck().all();
    expect(tables).toEqual([...localDatabaseTableNames].sort());
    expect(tables).not.toEqual(expect.arrayContaining([
      "repair_frames", "routing_requests", "routing_decisions", "policy_projections", "policy_telemetry"
    ]));
    expect(connection.prepare("SELECT value FROM metadata WHERE key = 'schema_version'").pluck().get()).toBe("14");
    expect(connection.pragma("foreign_keys", { simple: true })).toBe(1);
    database.close();
  });

  it("stores ordered Work/Validation and immutable-ledger evidence", async () => {
    const database = await createDatabase();
    const connection = database.connection();
    expect(columns(connection, "node_runs")).toEqual(expect.arrayContaining([
      "graph_node_invocation_id", "action_node_invocation_id", "role", "node_definition_id", "attempt"
    ]));
    expect(columns(connection, "acceptance_ledger_entries")).toEqual(expect.arrayContaining([
      "root_run_id", "obligation_id", "weight", "status", "evidence_refs_json"
    ]));
    expect(columns(connection, "policy_decisions")).toEqual([
      "policy_decision_id", "root_run_id", "epoch", "record_json", "created_at"
    ]);
    expect(columns(connection, "policy_observations")).toEqual([
      "policy_observation_id", "root_run_id", "policy_decision_id", "action_invocation_id",
      "record_json", "created_at"
    ]);
    database.close();
  });

  it("enforces root ownership through foreign keys", async () => {
    const database = await createDatabase();
    expect(() => database.connection().prepare(`
      INSERT INTO graph_node_invocations (
        graph_node_invocation_id, root_run_id, graph_node_id, source, status,
        snapshot_json, entry_state_revision, created_at, updated_at
      ) VALUES ('node', 'missing', 'design', 'policy', 'queued', '{}', 0, 'now', 'now')
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

  it("rejects schema v13 with archive guidance and does not mutate it", async () => {
    const filename = path.join(await temporaryRoot(), "state.sqlite");
    const previous = new Database(filename);
    previous.exec(`
      CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      INSERT INTO metadata (key, value) VALUES ('schema_version', '13');
      CREATE TABLE repair_frames (repair_frame_id TEXT PRIMARY KEY);
    `);
    previous.close();
    expect(() => new LocalDatabase(filename).connection()).toThrow(
      "Unsupported Ballet state schema 13; expected 14."
    );
    const untouched = new Database(filename, { readonly: true });
    expect(untouched.prepare("SELECT value FROM metadata WHERE key = 'schema_version'").pluck().get()).toBe("13");
    expect(untouched.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").pluck().all())
      .toContain("repair_frames");
    untouched.close();
  });
});

const columns = (connection: Database.Database, table: string): string[] =>
  (connection.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map(({ name }) => name);
const createDatabase = async () => new LocalDatabase(path.join(await temporaryRoot(), "state.sqlite"));
const temporaryRoot = async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ballet-v14-"));
  roots.push(root);
  return root;
};
