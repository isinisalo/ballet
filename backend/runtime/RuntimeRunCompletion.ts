import type Database from "better-sqlite3";
import type { RuntimeEvent } from "../../shared/domain/events.js";
import type { AgentRun } from "../../shared/domain/runtime.js";
import { stringifyJson } from "./RuntimeJson.js";
import { EventStore } from "./EventStore.js";
import { AgentRunStore } from "./AgentRunStore.js";
import { RuntimeProjector } from "./RuntimeProjector.js";
import { MAX_CORRELATION_DEPTH, now, type CompleteRunInput } from "./RuntimeDbTypes.js";
import {
  actionOutputEventType,
  aggregateActionOutputStatus,
  allPolicyRunsTerminal
} from "../automation/actionOutputAggregator.js";

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

      const run = this.runStore.getRun(input.runId);
      if (!run) throw new Error("Agent run not found after update.");
      let event: RuntimeEvent | undefined;
      let runs: AgentRun[] = [];
      const domainEvent = input.projectPolicy && input.actions && input.outputs
        ? this.aggregateDomainEvent(run, input)
        : input.domainEvent;
      if (domainEvent) {
        const inputEvent = this.eventStore.getEventById(run.inputEventId);
        if (!inputEvent) throw new Error("Input event not found.");
        const nextDepth = inputEvent.correlation_depth + 1;
        if (nextDepth > MAX_CORRELATION_DEPTH) {
          this.runStore.appendRunLog(run.runId, "warn", "Domain event publication skipped because correlation depth exceeded the runtime limit.", {
            event_type: domainEvent.type,
            max_correlation_depth: MAX_CORRELATION_DEPTH,
            next_correlation_depth: nextDepth
          });
        } else {
          const published = this.projector.insertEventAndProjectPolicies({
            projectId: inputEvent.project_id,
            eventType: domainEvent.type,
            source: domainEvent.source ?? "agentd",
            subject: inputEvent.subject,
            correlationId: inputEvent.correlation_id,
            causationId: inputEvent.event_id,
            dedupeKey: input.projectPolicy
              ? `domain:${run.inputEventId}:${run.policyId}:${domainEvent.type}`
              : `domain:${run.runId}:${domainEvent.type}`,
            correlationDepth: nextDepth,
            tags: [],
            payload: {
              ...domainEvent.payload,
              run_id: run.runId,
              input_event_id: run.inputEventId,
              policy_id: run.policyId,
              policy_version: run.policyVersion
            },
            body: input.projectPolicy
              ? `Agent runs for policy ${run.policyId} produced ${domainEvent.type}.`
              : `Agent run ${run.runId} produced ${domainEvent.type}.`
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

  private aggregateDomainEvent(
    run: AgentRun,
    input: CompleteRunInput
  ): CompleteRunInput["domainEvent"] | undefined {
    const policy = input.projectPolicy;
    if (!policy || !input.actions || !input.outputs) return undefined;
    const policyRuns = this.runStore.getRunsForPolicyInputEvent(run.inputEventId, run.policyId);
    if (!allPolicyRunsTerminal(policyRuns)) return undefined;

    const outputStatus = aggregateActionOutputStatus(policyRuns, policy, input.actions);
    if (!outputStatus) return undefined;

    return {
      type: actionOutputEventType(policy, outputStatus, input.outputRoutes, input.actions, input.projectPolicies),
      source: "agentd",
      payload: {
        action: policy.action,
        status: outputStatus,
        agents: policyRuns.map((policyRun) => ({
          agent: policyRun.agentRole,
          run_id: policyRun.runId,
          status: policyRun.status,
          outcome: policyRun.outcome?.outcome,
          summary: policyRun.outcome?.summary
        }))
      }
    };
  }
}
