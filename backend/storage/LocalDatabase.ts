import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { localDatabaseSchemaVersion, localDatabaseTableNames, runtimeSchema } from "./RuntimeSchema.js";

export class LocalDatabase {
  private database?: Database.Database;

  constructor(readonly path: string) {}

  connection(): Database.Database {
    if (this.database) return this.database;
    mkdirSync(path.dirname(this.path), { recursive: true, mode: 0o700 });
    const database = new Database(this.path);
    database.pragma("journal_mode = WAL");
    database.pragma("synchronous = FULL");
    database.pragma("busy_timeout = 5000");
    database.pragma("foreign_keys = ON");
    try {
      this.openSchema(database);
    } catch (error) {
      database.close();
      throw error;
    }
    this.database = database;
    return database;
  }

  close(): void {
    this.database?.close();
    this.database = undefined;
  }

  private openSchema(database: Database.Database): void {
    const tableNames = readTableNames(database);
    if (tableNames.size === 0) {
      database.transaction(() => {
        database.exec(runtimeSchema);
        database.prepare("INSERT INTO metadata (key, value) VALUES ('schema_version', ?)")
          .run(String(localDatabaseSchemaVersion));
      })();
      return;
    }
    if (!tableNames.has("metadata")) {
      throw new Error("Ballet state database has no schema version; persisted state was left unchanged.");
    }
    const row = database.prepare("SELECT value FROM metadata WHERE key = 'schema_version'").get();
    const version = readSchemaVersion(row);
    if (version !== localDatabaseSchemaVersion) {
      throw new Error([
        `Unsupported Ballet state schema ${version ?? "unknown"}; expected ${localDatabaseSchemaVersion}.`,
        `Runtime state at ${this.path} was left unchanged.`,
        "This release does not migrate prior Run history; archive state.sqlite and its -wal/-shm companions, then start Ballet again."
      ].join(" "));
    }
    const missing = localDatabaseTableNames.filter((tableName) => !tableNames.has(tableName));
    if (missing.length > 0) {
      throw new Error(`Ballet state schema ${version} is incomplete; missing tables: ${missing.join(", ")}.`);
    }
  }
}

const readTableNames = (database: Database.Database): Set<string> => {
  const rows = database.prepare(`
    SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
  `).all();
  return new Set(rows.flatMap((row) => {
    if (typeof row === "object" && row !== null && "name" in row && typeof row.name === "string") return [row.name];
    throw new Error("Ballet state database returned an invalid table inventory.");
  }));
};

const readSchemaVersion = (row: unknown): number | undefined => {
  if (typeof row !== "object" || row === null || !("value" in row) || typeof row.value !== "string") return undefined;
  const version = Number(row.value);
  return Number.isSafeInteger(version) ? version : undefined;
};
