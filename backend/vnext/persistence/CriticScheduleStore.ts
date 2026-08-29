import type Database from "better-sqlite3";
import type { CriticDueSeed, CriticScheduleSeed } from "../../../shared/vnext/index.js";
import { canonicalReviewValue as canonical, readReviewInteger as readInteger, readReviewString as readString } from "./ReviewIntegrity.js";
import { VNextConflictError, VNextNotFoundError } from "./VNextErrors.js";

export class CriticScheduleStore {
  constructor(protected readonly connection: () => Database.Database) {}

  createSchedule(input: CriticScheduleSeed): void {
    this.connection().prepare(`
      INSERT INTO critic_schedules (
        critic_schedule_id, config_hash, config_json, next_due_at, enabled, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(input.criticScheduleId, input.configHash, canonical(input.config), input.nextDueAt, input.enabled ? 1 : 0,
      input.createdAt, input.createdAt);
  }

  upsertSchedule(input: CriticScheduleSeed): void {
    const existing = this.connection().prepare("SELECT config_hash, enabled FROM critic_schedules WHERE critic_schedule_id = ?")
      .get(input.criticScheduleId) as Record<string, unknown> | undefined;
    if (!existing) { this.createSchedule(input); return; }
    if (existing.config_hash === input.configHash && existing.enabled === (input.enabled ? 1 : 0)) return;
    this.connection().prepare(`
      UPDATE critic_schedules SET config_hash = ?, config_json = ?, next_due_at = ?, enabled = ?,
        revision = revision + 1, updated_at = ? WHERE critic_schedule_id = ?
    `).run(input.configHash, canonical(input.config), input.nextDueAt, input.enabled ? 1 : 0,
      input.createdAt, input.criticScheduleId);
  }

  schedulesDue(at: string): Array<Record<string, unknown>> {
    return this.connection().prepare(`
      SELECT * FROM critic_schedules WHERE enabled = 1 AND next_due_at <= ? ORDER BY next_due_at, critic_schedule_id
    `).all(at) as Array<Record<string, unknown>>;
  }

  updateScheduleNextDue(id: string, nextDueAt: string, at: string): void {
    this.connection().prepare(`
      UPDATE critic_schedules SET next_due_at = ?, revision = revision + 1, updated_at = ? WHERE critic_schedule_id = ?
    `).run(nextDueAt, at, id);
  }

  createCriticDue(input: CriticDueSeed): string {
    return this.connection().transaction(() => {
      const existing = this.connection().prepare(`
        SELECT critic_run_id FROM critic_runs
        WHERE critic_schedule_id = ? AND (due_at = ? OR due_key = ?)
      `).get(input.criticScheduleId, input.dueAt, input.dueKey);
      if (existing) return readString(existing, "critic_run_id");
      const schedule = this.connection().prepare("SELECT enabled FROM critic_schedules WHERE critic_schedule_id = ?")
        .get(input.criticScheduleId);
      if (!schedule) throw new VNextNotFoundError(`Critic Schedule ${input.criticScheduleId} was not found.`);
      if (readInteger(schedule, "enabled") !== 1) throw new VNextConflictError("Disabled Critic Schedule cannot create a due run.");
      const status = input.productSnapshotId ? "queued" : "skipped";
      if (!input.productSnapshotId && input.skipReason !== "no_product_snapshot") {
        throw new VNextConflictError("Critic run without Product Snapshot requires a skip reason.");
      }
      this.connection().prepare(`
        INSERT INTO critic_runs (
          critic_run_id, critic_schedule_id, due_at, due_key, product_snapshot_id, status,
          skip_reason, created_at, updated_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(input.criticRunId, input.criticScheduleId, input.dueAt, input.dueKey,
        input.productSnapshotId ?? null, status, input.skipReason ?? null, input.createdAt, input.createdAt,
        status === "skipped" ? input.createdAt : null);
      this.connection().prepare(`
        UPDATE critic_schedules SET last_due_at = ?, last_run_id = ?, revision = revision + 1, updated_at = ?
        WHERE critic_schedule_id = ?
      `).run(input.dueAt, input.criticRunId, input.createdAt, input.criticScheduleId);
      return input.criticRunId;
    })();
  }

  hasActiveCriticRun(scheduleId: string): boolean {
    return Boolean(this.connection().prepare(`
      SELECT 1 FROM critic_runs WHERE critic_schedule_id = ? AND status IN ('queued','running') LIMIT 1
    `).get(scheduleId));
  }

  claimCriticRun(criticRunId: string, at: string): boolean {
    return this.connection().prepare(`
      UPDATE critic_runs SET status = 'running', updated_at = ? WHERE critic_run_id = ? AND status = 'queued'
    `).run(at, criticRunId).changes === 1;
  }

  releaseCriticClaims(at: string): number {
    return this.connection().prepare(`UPDATE critic_runs SET status = 'queued', updated_at = ? WHERE status = 'running'`)
      .run(at).changes;
  }
}
