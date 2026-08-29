import type Database from "better-sqlite3";
import type { ControlFlowEventKind, JsonValue } from "../../../shared/vnext/index.js";
import { VNextConflictError } from "./VNextErrors.js";

export interface ControlFlowDetail {
  stateExecutionId?: string;
  actionExecutionId?: string;
  sourceAgentRunId?: string;
  targetAgentRunId?: string;
  data?: JsonValue;
}

export class ControlFlowStore {
  constructor(private readonly connection: () => Database.Database) {}

  append(environmentRunId: string, kind: ControlFlowEventKind, detail: ControlFlowDetail, createdAt: string): number {
    return this.connection().transaction(() => {
      const advanced = this.connection().prepare(`
        UPDATE environment_runs SET transition_count = transition_count + 1, updated_at = ?
        WHERE environment_run_id = ? AND transition_count < transition_limit
      `).run(createdAt, environmentRunId);
      if (advanced.changes !== 1) throw new VNextConflictError(`Environment Run ${environmentRunId} exhausted its transition limit.`);
      const row = this.connection().prepare("SELECT transition_count FROM environment_runs WHERE environment_run_id = ?")
        .get(environmentRunId);
      const sequence = readInteger(row, "transition_count");
      this.connection().prepare(`
        INSERT INTO control_flow_events (
          environment_run_id, sequence, kind, state_execution_id, action_execution_id,
          source_agent_run_id, target_agent_run_id, data_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(environmentRunId, sequence, kind, detail.stateExecutionId ?? null,
        detail.actionExecutionId ?? null, detail.sourceAgentRunId ?? null, detail.targetAgentRunId ?? null,
        detail.data === undefined ? null : JSON.stringify(detail.data), createdAt);
      return sequence;
    })();
  }

  list(environmentRunId: string): Array<Record<string, unknown>> {
    return this.connection().prepare(`
      SELECT * FROM control_flow_events WHERE environment_run_id = ? ORDER BY sequence
    `).all(environmentRunId) as Array<Record<string, unknown>>;
  }
}

const readInteger = (row: unknown, key: string): number => {
  const value = typeof row === "object" && row !== null ? Reflect.get(row, key) : undefined;
  if (!Number.isSafeInteger(value)) throw new Error(`SQLite returned invalid ${key}.`);
  return value as number;
};
