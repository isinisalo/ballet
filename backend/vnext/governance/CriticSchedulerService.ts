import type Database from "better-sqlite3";
import type { CriticScheduleDefinition } from "../../../shared/vnext/environment.js";
import { canonicalJson, sha256 } from "../../../shared/vnext/primitives.js";
import { ReviewStore } from "../persistence/ReviewStore.js";
import { nextCriticDue } from "./CriticScheduleCalculator.js";

export interface CriticSchedulerClock { now(): string }

export class CriticSchedulerService {
  private readonly reviews: ReviewStore;
  constructor(
    private readonly connection: () => Database.Database,
    private readonly clock: CriticSchedulerClock,
    private readonly nextId: (kind: string) => string
  ) { this.reviews = new ReviewStore(connection); }

  configure(schedules: readonly CriticScheduleDefinition[], enabled: boolean): void {
    const at = this.clock.now();
    const configuredIds = new Set(schedules.map(({ id }) => id));
    const existing = this.connection().prepare("SELECT critic_schedule_id FROM critic_schedules").all() as Array<{
      critic_schedule_id: string;
    }>;
    for (const row of existing) if (!configuredIds.has(row.critic_schedule_id)) {
      this.connection().prepare(`
        UPDATE critic_schedules SET enabled = 0, revision = revision + 1, updated_at = ?
        WHERE critic_schedule_id = ? AND enabled = 1
      `).run(at, row.critic_schedule_id);
    }
    for (const config of schedules) {
      this.reviews.upsertSchedule({
        criticScheduleId: config.id, configHash: hash(config), config,
        nextDueAt: nextCriticDue(config, at), enabled, createdAt: at
      });
    }
  }

  tick(): string[] {
    const at = this.clock.now();
    const created: string[] = [];
    for (const row of this.reviews.schedulesDue(at)) {
      const scheduleId = String(row.critic_schedule_id);
      const config = JSON.parse(String(row.config_json)) as CriticScheduleDefinition;
      const scheduledDue = String(row.next_due_at);
      const nextDueAt = nextCriticDue(config, at);
      if (this.reviews.hasActiveCriticRun(scheduleId)) {
        this.reviews.updateScheduleNextDue(scheduleId, nextDueAt, at);
        continue;
      }
      const product = this.connection().prepare(`
        SELECT product_snapshot_id FROM product_snapshots WHERE created_at <= ? ORDER BY created_at DESC, rowid DESC LIMIT 1
      `).get(at) as { product_snapshot_id: string } | undefined;
      const criticRunId = this.nextId("critic-run");
      this.reviews.createCriticDue({
        criticRunId, criticScheduleId: scheduleId, dueAt: scheduledDue,
        dueKey: `${scheduleId}:${scheduledDue}`,
        productSnapshotId: product?.product_snapshot_id,
        skipReason: product ? undefined : "no_product_snapshot",
        createdAt: at
      });
      this.reviews.updateScheduleNextDue(scheduleId, nextDueAt, at);
      created.push(criticRunId);
    }
    return created;
  }

  shutdown(): number { return this.reviews.releaseCriticClaims(this.clock.now()); }
}

const hash = (value: unknown): string => sha256(canonicalJson(JSON.parse(JSON.stringify(value))));
