import type { AgentRunLog } from "../../shared/domain/runtime.js";
import type { RuntimeDatabase } from "../runtime-db.js";
import { notifyRuntimeChanged } from "../runtime-events.js";
import type { RuntimeDatabaseProvider } from "./RuntimeDatabaseProvider.js";

export class RuntimeRunService {
  constructor(private readonly runtimeDatabaseProvider: RuntimeDatabaseProvider) {}

  listAgentRuns() {
    return this.runtimeDatabaseProvider.runtimeDatabase().listRuns();
  }

  retryAgentRun(runId: string) {
    const run = this.runtimeDatabaseProvider.runtimeDatabase().retryRun(runId);
    notifyRuntimeChanged("agent-runs");
    return run;
  }

  listRunLogs(runId?: string): AgentRunLog[] {
    return this.runtimeDatabaseProvider.runtimeDatabase().listRunLogs(runId);
  }

  runtimeHealth() {
    return this.runtimeDatabaseProvider.runtimeDatabase().health();
  }

  runtimeDatabase(): RuntimeDatabase {
    return this.runtimeDatabaseProvider.runtimeDatabase();
  }
}
