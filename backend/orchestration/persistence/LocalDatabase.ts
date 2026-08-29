import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { RuntimeSchemaVersionError } from "./PersistenceErrors.js";
import { DATABASE_SCHEMA_VERSION, RuntimeTableNames, runtimeSchema } from "./RuntimeSchema.js";

export class LocalDatabase {
  private database?: Database.Database;

  constructor(readonly databasePath: string) {}

  connection(): Database.Database {
    if (this.database) return this.database;
    mkdirSync(path.dirname(this.databasePath), { recursive: true, mode: 0o700 });
    const database = new Database(this.databasePath);
    database.pragma("busy_timeout = 5000");
    database.pragma("foreign_keys = ON");
    try {
      this.openStrictSchema(database);
      database.pragma("journal_mode = WAL");
      database.pragma("synchronous = FULL");
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

  private openStrictSchema(database: Database.Database): void {
    const tableNames = readTableNames(database);
    if (tableNames.size === 0) {
      database.transaction(() => {
        database.exec(runtimeSchema);
        database.prepare("INSERT INTO metadata (key, value) VALUES ('schema_version', ?)")
          .run(String(DATABASE_SCHEMA_VERSION));
      })();
      return;
    }
    const version = tableNames.has("metadata") ? readSchemaVersion(database) : undefined;
    if (version !== DATABASE_SCHEMA_VERSION) throw versionError(this.databasePath, version);
    const missing = RuntimeTableNames.filter((tableName) => !tableNames.has(tableName));
    if (missing.length > 0) {
      throw new RuntimeSchemaVersionError(`Ballet state schema ${DATABASE_SCHEMA_VERSION} is incomplete; missing tables: ${missing.join(", ")}. Persisted data was left unchanged.`);
    }
  }
}

const readTableNames = (database: Database.Database): Set<string> => {
  const rows = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all();
  return new Set(rows.map((row) => {
    const name = typeof row === "object" && row !== null ? Reflect.get(row, "name") : undefined;
    if (typeof name !== "string") throw new RuntimeSchemaVersionError("SQLite returned an invalid table inventory.");
    return name;
  }));
};

const readSchemaVersion = (database: Database.Database): number | undefined => {
  try {
    const row = database.prepare("SELECT value FROM metadata WHERE key = 'schema_version'").get();
    const value = typeof row === "object" && row !== null ? Reflect.get(row, "value") : undefined;
    const version = typeof value === "string" ? Number(value) : Number.NaN;
    return Number.isSafeInteger(version) ? version : undefined;
  } catch {
    return undefined;
  }
};

const versionError = (databasePath: string, version: number | undefined): RuntimeSchemaVersionError => (
  new RuntimeSchemaVersionError([
    `Unsupported Ballet state schema ${version ?? "unknown"}; expected ${DATABASE_SCHEMA_VERSION}.`,
    `Runtime state at ${databasePath} was left unchanged.`,
    "No migration is available: archive or remove .git/ballet/state.sqlite and its -wal/-shm companions before opening Ballet again."
  ].join(" "))
);
