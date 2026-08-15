import type Database from "better-sqlite3";
import type { ControlFlowEvent } from "../../shared/domain/runtime.js";
import { controlFlowEventRowSchema } from "./RuntimeDbTypes.js";
import { toControlFlowEvent } from "./RuntimeRowMappers.js";

export class ControlFlowStore {
  constructor(private readonly connection: () => Database.Database) {}

  get(eventId: number): ControlFlowEvent | undefined {
    const value = this.connection().prepare("SELECT * FROM control_flow_events WHERE id = ?").get(eventId);
    return value ? toControlFlowEvent(controlFlowEventRowSchema.parse(value)) : undefined;
  }

  listByRoot(rootRunId: string): ControlFlowEvent[] {
    return this.connection().prepare(`
      SELECT * FROM control_flow_events WHERE root_run_id = ? ORDER BY sequence
    `).all(rootRunId).map((row) => toControlFlowEvent(controlFlowEventRowSchema.parse(row)));
  }
}
