import { RuntimeDatabase, resolveRuntimeDbPath } from "../runtime-db.js";

export class RuntimeDatabaseProvider {
  private runtimeDb?: RuntimeDatabase;
  private runtimeDbPath?: string;

  constructor(private readonly root: () => string) {}

  runtimeDatabase(): RuntimeDatabase {
    const dbPath = resolveRuntimeDbPath(this.root());
    if (!this.runtimeDb || this.runtimeDbPath !== dbPath) {
      this.runtimeDb?.close();
      this.runtimeDb = new RuntimeDatabase(dbPath);
      this.runtimeDbPath = dbPath;
    }
    return this.runtimeDb;
  }
}
