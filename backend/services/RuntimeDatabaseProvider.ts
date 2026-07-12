import { RuntimeDatabase } from "../runtime-db.js";

export class RuntimeDatabaseProvider {
  constructor(private readonly database: RuntimeDatabase) {}
  runtimeDatabase(): RuntimeDatabase { return this.database; }
}
