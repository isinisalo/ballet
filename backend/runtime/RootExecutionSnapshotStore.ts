import type Database from "better-sqlite3";
import type { ProjectLoop } from "../../shared/domain/automation.js";
import type { RootExecutionSnapshot } from "../../shared/domain/runtime.js";
import { LoopRunIntegrityError, LoopRunNotFoundError } from "./LoopRunErrors.js";
import { rootExecutionSnapshotSchema } from "./RootExecutionSnapshotSchema.js";

export class RootExecutionSnapshotStore {
  constructor(private readonly connection: () => Database.Database) {}

  require(rootRunId: string): RootExecutionSnapshot {
    const row = this.connection().prepare("SELECT execution_snapshot_json FROM root_runs WHERE root_run_id = ?")
      .get(rootRunId);
    if (!row) throw new LoopRunNotFoundError(`Root Run ${rootRunId} was not found.`);
    const source = readSnapshotJson(row, rootRunId);
    try {
      return rootExecutionSnapshotSchema.parse(JSON.parse(source));
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

const readSnapshotJson = (value: unknown, rootRunId: string): string => {
  if (typeof value === "object" && value !== null && "execution_snapshot_json" in value) {
    const source = Reflect.get(value, "execution_snapshot_json");
    if (typeof source === "string") return source;
  }
  throw new LoopRunIntegrityError(`Root Run ${rootRunId} has invalid execution snapshot storage.`);
};
