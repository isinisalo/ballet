import type Database from "better-sqlite3";
import type { LoopScheduleState, LoopScheduleOccurrenceStatus } from "../../shared/domain/runtime.js";
import type { LoopScheduleStateRow } from "./RuntimeDbTypes.js";

export interface ScheduleDefinitionState {
  loopId: string;
  stepId: string;
  definitionHash: string;
  nextRunAt?: string;
}

export interface CompleteScheduleOccurrenceInput {
  loopId: string;
  stepId: string;
  definitionHash: string;
  scheduledFor: string;
  lastScheduledAt?: string;
  nextRunAt?: string;
  status: LoopScheduleOccurrenceStatus;
  runId?: string;
  error?: string;
  updatedAt: string;
}

export class LoopScheduleStateStore {
  constructor(private readonly connection: () => Database.Database) {}

  list(): LoopScheduleState[] {
    const rows = this.connection().prepare(`
      SELECT * FROM loop_schedule_state ORDER BY loop_id, step_id
    `).all() as LoopScheduleStateRow[];
    return rows.map(toScheduleState);
  }

  rows(): LoopScheduleStateRow[] {
    return this.connection().prepare(`
      SELECT * FROM loop_schedule_state ORDER BY loop_id, step_id
    `).all() as LoopScheduleStateRow[];
  }

  get(loopId: string, stepId: string): LoopScheduleStateRow | undefined {
    return this.connection().prepare(`
      SELECT * FROM loop_schedule_state WHERE loop_id = ? AND step_id = ?
    `).get(loopId, stepId) as LoopScheduleStateRow | undefined;
  }

  replaceDefinition(definition: ScheduleDefinitionState, updatedAt: string): boolean {
    const existing = this.get(definition.loopId, definition.stepId);
    if (existing?.definition_hash === definition.definitionHash) return false;
    this.connection().prepare(`
      INSERT INTO loop_schedule_state (
        loop_id, step_id, definition_hash, next_run_at,
        last_scheduled_at, last_status, last_run_id, last_error, updated_at
      ) VALUES (
        @loopId, @stepId, @definitionHash, @nextRunAt,
        NULL, NULL, NULL, NULL, @updatedAt
      )
      ON CONFLICT(loop_id, step_id) DO UPDATE SET
        definition_hash = excluded.definition_hash,
        next_run_at = excluded.next_run_at,
        last_scheduled_at = NULL,
        last_status = NULL,
        last_run_id = NULL,
        last_error = NULL,
        updated_at = excluded.updated_at
    `).run({
      loopId: definition.loopId,
      stepId: definition.stepId,
      definitionHash: definition.definitionHash,
      nextRunAt: definition.nextRunAt ?? null,
      updatedAt
    });
    return true;
  }

  prune(validKeys: ReadonlySet<string>): boolean {
    let changed = false;
    for (const row of this.rows()) {
      if (validKeys.has(scheduleStateKey(row.loop_id, row.step_id))) continue;
      this.connection().prepare(`
        DELETE FROM loop_schedule_state WHERE loop_id = ? AND step_id = ?
      `).run(row.loop_id, row.step_id);
      changed = true;
    }
    return changed;
  }

  completeOccurrence(input: CompleteScheduleOccurrenceInput): boolean {
    const result = this.connection().prepare(`
      UPDATE loop_schedule_state SET
        next_run_at = @nextRunAt,
        last_scheduled_at = @lastScheduledAt,
        last_status = @status,
        last_run_id = @lastRunId,
        last_error = @lastError,
        updated_at = @updatedAt
      WHERE loop_id = @loopId
        AND step_id = @stepId
        AND definition_hash = @definitionHash
        AND next_run_at = @scheduledFor
    `).run({
      loopId: input.loopId,
      stepId: input.stepId,
      definitionHash: input.definitionHash,
      scheduledFor: input.scheduledFor,
      lastScheduledAt: input.lastScheduledAt ?? input.scheduledFor,
      nextRunAt: input.nextRunAt ?? null,
      status: input.status,
      lastRunId: input.runId ?? null,
      lastError: input.error ?? null,
      updatedAt: input.updatedAt
    });
    return result.changes === 1;
  }
}

export const scheduleStateKey = (loopId: string, stepId: string): string => `${loopId}\0${stepId}`;

const toScheduleState = (row: LoopScheduleStateRow): LoopScheduleState => ({
  loopId: row.loop_id,
  stepId: row.step_id,
  nextRunAt: row.next_run_at ?? undefined,
  lastScheduledAt: row.last_scheduled_at ?? undefined,
  lastStatus: row.last_status ?? undefined,
  lastRunId: row.last_run_id ?? undefined,
  lastError: row.last_error ?? undefined
});
