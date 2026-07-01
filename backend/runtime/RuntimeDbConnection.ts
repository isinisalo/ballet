import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { RuntimeMigrator } from "./RuntimeMigrator.js";

const parseVersion = (version: string): [number, number, number] => {
  const [major = 0, minor = 0, patch = 0] = version.split(".").map((part) => Number.parseInt(part, 10));
  return [major, minor, patch];
};

export const isPatchedSqliteVersion = (version: string): boolean => {
  const [major, minor, patch] = parseVersion(version);
  if (major > 3) return true;
  if (major < 3) return false;
  if (minor > 51) return true;
  if (minor === 51) return patch >= 3;
  if (minor === 50) return patch >= 7;
  if (minor === 44) return patch >= 6;
  return false;
};

export class RuntimeDbConnection {
  private db?: Database.Database;
  private readonly migrator = new RuntimeMigrator();

  constructor(private readonly dbPath: string) {}

  close(): void {
    this.db?.close();
    this.db = undefined;
  }

  get path(): string {
    return this.dbPath;
  }

  connection(): Database.Database {
    if (this.db) return this.db;

    mkdirSync(path.dirname(this.dbPath), { recursive: true });
    const db = new Database(this.dbPath);
    const sqliteVersion = db.prepare("SELECT sqlite_version() AS version").get() as { version: string };
    if (!isPatchedSqliteVersion(sqliteVersion.version)) {
      db.close();
      throw new Error(`SQLite ${sqliteVersion.version} is not supported for WAL runtime storage. Use 3.51.3+, 3.50.7+, or 3.44.6+.`);
    }

    db.pragma("journal_mode = WAL");
    db.pragma("synchronous = FULL");
    db.pragma("busy_timeout = 5000");
    db.pragma("foreign_keys = ON");
    this.migrator.migrate(db);
    this.db = db;
    return db;
  }

  sqliteVersion(): string {
    const row = this.connection().prepare("SELECT sqlite_version() AS version").get() as { version: string };
    return row.version;
  }

  health(): Record<string, unknown> {
    const db = this.connection();
    const eventCount = db.prepare("SELECT COUNT(*) AS count FROM events").get() as { count: number };
    const queuedRuns = db.prepare("SELECT COUNT(*) AS count FROM agent_runs WHERE status = 'queued'").get() as { count: number };
    const runningRuns = db.prepare("SELECT COUNT(*) AS count FROM agent_runs WHERE status = 'running'").get() as { count: number };
    return {
      ok: true,
      dbPath: this.dbPath,
      sqliteVersion: this.sqliteVersion(),
      events: eventCount.count,
      queuedRuns: queuedRuns.count,
      runningRuns: runningRuns.count
    };
  }
}
