import type Database from "better-sqlite3";
import type { RuntimeEvent } from "../../shared/domain/events.js";
import type { AgentRun } from "../../shared/domain/runtime.js";
import { stringifyJson } from "./RuntimeJson.js";
import { EventStore } from "./EventStore.js";
import { AgentRunStore } from "./AgentRunStore.js";
import { RuntimeProjector } from "./RuntimeProjector.js";
import { MAX_CORRELATION_DEPTH, now, type CompleteRunInput } from "./RuntimeDbTypes.js";

export class RuntimeRunCompletion {
  constructor(
    private readonly connection: () => Database.Database,
    private readonly eventStore: EventStore,
    private readonly runStore: AgentRunStore,
    private readonly projector: RuntimeProjector
  ) {}

  completeRun(input: CompleteRunInput): { run: AgentRun; event?: RuntimeEvent; runs?: AgentRun[] } {
    const db = this.connection();
    const transaction = db.transaction(() => {
      const existing = this.runStore.getRun(input.runId);
      if (!existing) throw new Error("Agent run not found.");
      const completedAt = ["completed", "failed", "blocked", "needs_input", "cancelled"].includes(input.status) ? now() : undefined;
      db.prepare(`
        UPDATE agent_runs
        SET status = @status,
            lease_owner = NULL,
            lease_until = NULL,
            thread_id = COALESCE(@threadId, thread_id),
            turn_id = COALESCE(@turnId, turn_id),
            outcome_json = @outcomeJson,
            error = @error,
            completed_at = @completedAt,
            updated_at = @updatedAt
        WHERE run_id = @runId
      `).run({
        runId: input.runId,
        status: input.status,
        threadId: input.threadId ?? null,
        turnId: input.turnId ?? null,
        outcomeJson: input.outcome ? stringifyJson(input.outcome) : null,
        error: input.error ?? null,
        completedAt: completedAt ?? null,
        updatedAt: now()
      });

      let event: RuntimeEvent | undefined;
      let runs: AgentRun[] = [];
      if (input.domainEvent) {
        const run = this.runStore.getRun(input.runId);
        if (!run) throw new Error("Agent run not found after update.");
        const trigger = this.eventStore.getEventById(run.triggerEventId);
        if (!trigger) throw new Error("Trigger event not found.");
        const nextDepth = trigger.correlation_depth + 1;
        if (nextDepth > MAX_CORRELATION_DEPTH) {
          this.runStore.appendRunLog(run.runId, "warn", "Domain event publication skipped because correlation depth exceeded the runtime limit.", {
            event_type: input.domainEvent.type,
            max_correlation_depth: MAX_CORRELATION_DEPTH,
            next_correlation_depth: nextDepth
          });
        } else {
          const published = this.projector.insertEventAndProjectPolicies({
            projectId: trigger.project_id,
            eventType: input.domainEvent.type,
            source: input.domainEvent.source ?? "agentd",
            subject: trigger.subject,
            correlationId: trigger.correlation_id,
            causationId: trigger.event_id,
            dedupeKey: `domain:${run.runId}:${input.domainEvent.type}`,
            correlationDepth: nextDepth,
            tags: [],
            payload: {
              ...input.domainEvent.payload,
              run_id: run.runId,
              trigger_event_id: run.triggerEventId,
              policy_id: run.policyId,
              policy_version: run.policyVersion
            },
            body: `Agent run ${run.runId} produced ${input.domainEvent.type}.`
          }, input.policies ?? [], input.agents ?? []);
          const publishedRow = this.eventStore.getEventById(published.event.eventId ?? published.event.id);
          event = publishedRow ? this.eventStore.toRuntimeEvent(publishedRow) : undefined;
          runs = published.runs;
        }
      }

      const updated = this.runStore.getRun(input.runId);
      if (!updated) throw new Error("Agent run not found after completion.");
      return { run: updated, event, runs };
    });
    return transaction() as { run: AgentRun; event?: RuntimeEvent; runs?: AgentRun[] };
  }
}
