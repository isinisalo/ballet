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

describe("LocalDatabase schema v1", () => {
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
    expect(connection.prepare("SELECT value FROM metadata WHERE key = 'schema_version'").pluck().get()).toBe("1");
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
    future.prepare("INSERT INTO metadata (key, value) VALUES ('schema_version', '2')").run();
    future.close();
    const database = new LocalDatabase(filename);

    expect(() => database.connection()).toThrow("Unsupported Ballet state schema 2; expected 1.");
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
