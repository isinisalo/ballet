import type Database from "better-sqlite3";
import { LocalDatabase } from "../storage/LocalDatabase.js";

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
  private readonly database: LocalDatabase;

  constructor(dbPath: string) {
    this.database = new LocalDatabase(dbPath);
  }

  close(): void {
    this.database.close();
  }

  connection(): Database.Database {
    const db = this.database.connection();
    const sqliteVersion = db.prepare("SELECT sqlite_version() AS version").get() as { version: string };
    if (!isPatchedSqliteVersion(sqliteVersion.version)) {
      this.database.close();
      throw new Error(`SQLite ${sqliteVersion.version} is not supported for WAL runtime storage. Use 3.51.3+, 3.50.7+, or 3.44.6+.`);
    }
    return db;
  }

}
