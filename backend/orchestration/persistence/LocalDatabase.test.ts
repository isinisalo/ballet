import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { EnvironmentRunStore } from "./EnvironmentRunStore.js";
import { environmentSeed, openTestDatabase, type TestDatabase } from "./PersistenceTestFixtures.js";
import { LocalDatabase } from "./LocalDatabase.js";
import { DATABASE_SCHEMA_VERSION, RuntimeTableNames } from "./RuntimeSchema.js";

const databases: TestDatabase[] = [];
const directories: string[] = [];
afterEach(() => {
  databases.splice(0).forEach(({ cleanup }) => cleanup());
  directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true }));
});

describe("strict SQLite v18 open behavior", () => {
  it("creates the exact v18 inventory in an empty database", () => {
    const database = track();
    const names = database.connection.prepare(`
      SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name
    `).all().map((row) => String((row as { name: string }).name));
    expect(names).toEqual([...RuntimeTableNames].sort());
    expect(database.connection.prepare("SELECT value FROM metadata WHERE key = 'schema_version'").get())
      .toEqual({ value: String(DATABASE_SCHEMA_VERSION) });
    expect(names.join(" ")).not.toMatch(/graph|policy|acceptance/);
  });

  it("reopens v18 without recreating persisted data", () => {
    const database = track();
    new EnvironmentRunStore(() => database.connection).create(environmentSeed());
    database.manager.close();
    const reopened = new LocalDatabase(database.databasePath);
    expect(reopened.connection().prepare("SELECT environment_run_id FROM environment_runs").get())
      .toEqual({ environment_run_id: "run-1" });
    reopened.close();
  });

  it.each(["15", "999"])("fails closed for schema %s and leaves a sentinel unchanged", (version) => {
    const { databasePath } = unsupportedDatabase(version);
    const manager = new LocalDatabase(databasePath);
    expect(() => manager.connection()).toThrow(/archive or remove/i);
    const raw = new Database(databasePath, { readonly: true });
    expect(raw.prepare("SELECT value FROM sentinel").get()).toEqual({ value: "preserve-me" });
    raw.close();
  });

  it("fails closed for an unversioned unknown database", () => {
    const directory = tempDirectory();
    const databasePath = path.join(directory, "unknown.sqlite");
    const raw = new Database(databasePath);
    raw.exec("CREATE TABLE sentinel (value TEXT NOT NULL); INSERT INTO sentinel VALUES ('preserve-me');");
    raw.close();
    expect(() => new LocalDatabase(databasePath).connection()).toThrow(/schema unknown.*left unchanged/i);
  });
});

describe("v18 relational constraints", () => {
  it("enforces foreign keys, role/phase checks, and ordered uniqueness", () => {
    const database = track();
    const store = new EnvironmentRunStore(() => database.connection);
    store.create(environmentSeed());
    expect(() => database.connection.prepare(`
      INSERT INTO state_executions (
        state_execution_id, environment_run_id, state_definition_id, state_order,
        definition_snapshot_json, definition_snapshot_hash, status, created_at, updated_at
      ) VALUES ('orphan', 'missing', 'state', 9, '{}', 'hash', 'pending', 'now', 'now')
    `).run()).toThrow(/FOREIGN KEY/);
    expect(() => database.connection.prepare(`
      INSERT INTO agent_runs (
        agent_run_id, environment_run_id, action_execution_id, role, phase, status, attempt,
        task_envelope_version, task_envelope_json, task_envelope_hash, created_at, updated_at
      ) VALUES ('bad-agent', 'run-1', 'action-execution-1', 'work', 'precheck', 'queued', 1, 10, '{}', 'hash', 'now', 'now')
    `).run()).toThrow(/CHECK constraint/);
    expect(() => database.connection.prepare(`
      UPDATE state_executions SET state_order = 1 WHERE state_execution_id = 'state-execution-2'
    `).run()).toThrow(/UNIQUE constraint/);
    expect(() => database.connection.prepare(`
      INSERT INTO run_evidences (
        run_evidence_id, environment_run_id, branch, worktree_path, base_commit, result_commit,
        changed_files_json, artifact_refs_json, resource_hashes_json, definition_hashes_json,
        validation_summary_json, created_at, updated_at
      ) VALUES ('early', 'run-1', 'branch', '/tmp', 'base', 'result', '[]', '[]', '{}', '{}', '{}', 'now', 'now')
    `).run()).toThrow(/requires completed Environment/);
  });

  it("cascades one Environment aggregate intentionally", () => {
    const database = track();
    new EnvironmentRunStore(() => database.connection).create(environmentSeed());
    database.connection.prepare("DELETE FROM environment_runs WHERE environment_run_id = 'run-1'").run();
    for (const table of ["state_executions", "action_executions", "control_flow_events"]) {
      expect(database.connection.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get()).toEqual({ count: 0 });
    }
  });
});

const track = (): TestDatabase => {
  const database = openTestDatabase();
  databases.push(database);
  return database;
};

const tempDirectory = (): string => {
  const directory = mkdtempSync(path.join(tmpdir(), "ballet-orchestration-version-"));
  directories.push(directory);
  return directory;
};

const unsupportedDatabase = (version: string): { databasePath: string } => {
  const directory = tempDirectory();
  const databasePath = path.join(directory, "unsupported.sqlite");
  const raw = new Database(databasePath);
  raw.exec("CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL); CREATE TABLE sentinel (value TEXT NOT NULL);");
  raw.prepare("INSERT INTO metadata VALUES ('schema_version', ?)").run(version);
  raw.prepare("INSERT INTO sentinel VALUES ('preserve-me')").run();
  raw.close();
  return { databasePath };
};
