import type Database from "better-sqlite3";
import type { ProjectLoop } from "../../shared/domain/automation.js";
import type { RootExecutionSnapshot } from "../../shared/domain/runtime.js";
import { LoopRunIntegrityError, LoopRunNotFoundError } from "./LoopRunErrors.js";

export class RootExecutionSnapshotStore {
  constructor(private readonly connection: () => Database.Database) {}

  require(rootRunId: string): RootExecutionSnapshot {
    const row = this.connection().prepare("SELECT execution_snapshot_json FROM root_runs WHERE root_run_id = ?")
      .get(rootRunId) as { execution_snapshot_json: string } | undefined;
    if (!row) throw new LoopRunNotFoundError(`Root Run ${rootRunId} was not found.`);
    try {
      const snapshot = JSON.parse(row.execution_snapshot_json) as RootExecutionSnapshot;
      if (snapshot.version !== 1 || !Array.isArray(snapshot.loops) || !snapshot.theme) throw new Error("invalid shape");
      return snapshot;
    } catch (error) {
      throw new LoopRunIntegrityError(
        `Root Run ${rootRunId} has an invalid persisted execution snapshot: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  loop(snapshot: RootExecutionSnapshot, loopId: string): ProjectLoop {
    const loop = snapshot.loops.find((candidate) => candidate.id === loopId);
    if (!loop) throw new LoopRunIntegrityError(`Loop ${loopId} was not found in the Root Run execution snapshot.`);
    return loop;
  }
}
