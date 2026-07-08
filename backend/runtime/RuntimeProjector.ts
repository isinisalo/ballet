import type Database from "better-sqlite3";
import { v4 as uuid } from "uuid";
import type { Agent } from "../../shared/domain/agents.js";
import type { EventRoutingSummary, ProjectAutomationConfig, RouteDecision } from "../../shared/domain/automation.js";
import type { EventRecord, EventStatus } from "../../shared/domain/events.js";
import type { AgentRun } from "../../shared/domain/runtime.js";
import { routeAutomationEvent } from "../automation/automationRouting.js";
import { EventStore } from "./EventStore.js";
import { AgentRunStore } from "./AgentRunStore.js";
import { hashDedupeKey, stringifyJson } from "./RuntimeJson.js";
import {
  MAX_CORRELATION_DEPTH,
  PROJECTOR_CONSUMER,
  type IntakeEventInput,
  now,
  type PublishEventResult
} from "./RuntimeDbTypes.js";

interface PreparedEvent {
  baseEvent: EventRecord;
  dedupeKey: string;
  createdAt: string;
  decisions: RouteDecision[];
  routedDecisions: RouteDecision[];
}

export class RuntimeProjector {
  constructor(
    private readonly connection: () => Database.Database,
    private readonly eventStore: EventStore,
    private readonly runStore: AgentRunStore
  ) {}

  publishEventAndProjectActions(input: IntakeEventInput, automation: ProjectAutomationConfig, agents: Agent[]): PublishEventResult {
    const transaction = this.connection().transaction(() => this.insertEventAndProjectActions(input, automation, agents));
    return transaction() as PublishEventResult;
  }

  insertEventAndProjectActions(input: IntakeEventInput, automation: ProjectAutomationConfig, agents: Agent[]): PublishEventResult {
    const prepared = this.prepareEvent(input, automation, agents);
    const duplicate = this.eventStore.getEventByDedupeKey(prepared.dedupeKey);
    if (duplicate) {
      const runs = this.runStore.getRunsForInputEvent(duplicate.event_id);
      return { event: this.eventStore.toEventRecord(duplicate), run: runs[0], runs, duplicate: true };
    }

    this.insertEventRow(input, prepared);
    const inserted = this.eventStore.getEventById(prepared.baseEvent.eventId ?? prepared.baseEvent.id);
    if (!inserted) throw new Error("Failed to read inserted event.");

    const runs = this.insertAgentRuns(inserted.event_id, inserted.seq, prepared);
    const routing = this.routingSummary(prepared.decisions);
    this.updateEventRouting(inserted.event_id, input.body, routing);
    this.recordProjectorOffset(inserted.seq);

    const updated = this.eventStore.getEventById(inserted.event_id);
    if (!updated) throw new Error("Failed to read updated event.");
    return { event: this.eventStore.toEventRecord(updated), run: runs[0], runs, duplicate: false };
  }

  private prepareEvent(input: IntakeEventInput, automation: ProjectAutomationConfig, agents: Agent[]): PreparedEvent {
    const createdAt = now();
    const eventId = uuid();
    const payload = input.payload ?? {};
    const tags = input.tags ?? [];
    const source = input.source ?? "unknown";
    const subject = input.subject ?? this.payloadWorkItemId(payload) ?? input.projectId;
    const correlationId = input.correlationId ?? eventId;
    const correlationDepth = input.correlationDepth ?? 0;
    if (correlationDepth > MAX_CORRELATION_DEPTH) {
      throw new Error(`Event correlation depth ${correlationDepth} exceeds the runtime limit ${MAX_CORRELATION_DEPTH}.`);
    }

    const dedupeKey = input.dedupeKey ?? this.defaultDedupeKey(input, { source, subject, tags, payload });
    const baseEvent: EventRecord = {
      id: eventId,
      eventId,
      projectId: input.projectId,
      source,
      type: input.eventType,
      eventType: input.eventType,
      subject,
      correlationId,
      causationId: input.causationId,
      dedupeKey,
      correlationDepth,
      occurredAt: createdAt,
      tags,
      payload,
      status: "received",
      handlingResult: input.body,
      createdAt
    };
    const decisions = routeAutomationEvent(baseEvent, automation, agents);
    return {
      baseEvent,
      dedupeKey,
      createdAt,
      decisions,
      routedDecisions: decisions.filter((decision) => decision.status === "routed")
    };
  }

  private payloadWorkItemId(payload: Record<string, unknown>): string | undefined {
    if (typeof payload.work_item_id === "string") return payload.work_item_id;
    return typeof payload.workItemId === "string" ? payload.workItemId : undefined;
  }

  private defaultDedupeKey(
    input: IntakeEventInput,
    event: { source: string; subject: string; tags: string[]; payload: Record<string, unknown> }
  ): string {
    return `event:${hashDedupeKey({
      projectId: input.projectId,
      eventType: input.eventType,
      source: event.source,
      subject: event.subject,
      correlationId: input.correlationId ?? "",
      causationId: input.causationId ?? "",
      tags: event.tags,
      payload: event.payload
    })}`;
  }

  private insertEventRow(input: IntakeEventInput, prepared: PreparedEvent): void {
    const routing = this.routingSummary(prepared.decisions);
    const routedDecision = prepared.routedDecisions[0];
    const status: EventStatus = prepared.routedDecisions.length > 0 ? "routed" : "unassigned";
    const handlingResult = input.body ? `${input.body}\n\n${routing.message}` : routing.message;
    this.connection().prepare(`
      INSERT INTO events (
        event_id, type, source, subject, correlation_id, causation_id, dedupe_key,
        correlation_depth, occurred_at, project_id, tags_json, status, matched_policy_id,
        assigned_agent_id, routing_json, handling_result, payload_json
      )
      VALUES (
        @eventId, @type, @source, @subject, @correlationId, @causationId, @dedupeKey,
        @correlationDepth, @occurredAt, @projectId, @tagsJson, @status, @matchedPolicyId,
        @assignedAgentId, @routingJson, @handlingResult, @payloadJson
      )
    `).run({
      eventId: prepared.baseEvent.eventId,
      type: prepared.baseEvent.eventType,
      source: prepared.baseEvent.source,
      subject: prepared.baseEvent.subject,
      correlationId: prepared.baseEvent.correlationId,
      causationId: prepared.baseEvent.causationId ?? null,
      dedupeKey: prepared.dedupeKey,
      correlationDepth: prepared.baseEvent.correlationDepth,
      occurredAt: prepared.baseEvent.occurredAt,
      projectId: prepared.baseEvent.projectId,
      tagsJson: stringifyJson(prepared.baseEvent.tags),
      status,
      matchedPolicyId: routedDecision?.routeId ?? prepared.decisions[0]?.routeId ?? null,
      assignedAgentId: routedDecision?.targetAgentId ?? null,
      routingJson: stringifyJson(routing),
      handlingResult,
      payloadJson: stringifyJson(prepared.baseEvent.payload)
    });
  }

  private insertAgentRuns(inputEventId: string, inputEventSeq: number, prepared: PreparedEvent): AgentRun[] {
    const runs: AgentRun[] = [];
    for (const decision of prepared.routedDecisions) {
      this.insertAgentRun(inputEventId, inputEventSeq, prepared.createdAt, decision);
      const run = this.runStore.getRunByDedupe(inputEventId, decision.routeId, decision.actionVersion, decision.targetAgentId);
      if (run) {
        decision.runId = run.runId;
        runs.push(run);
      }
    }
    return runs;
  }

  private insertAgentRun(inputEventId: string, inputEventSeq: number, createdAt: string, decision: RouteDecision): void {
    this.connection().prepare(`
      INSERT OR IGNORE INTO agent_runs (
        run_id, input_event_id, input_event_seq, policy_id, policy_version,
        agent_role, status, attempt, created_at, updated_at
      )
      VALUES (
        @runId, @inputEventId, @inputEventSeq, @policyId, @policyVersion,
        @agentRole, 'queued', 0, @createdAt, @updatedAt
      )
    `).run({
      runId: uuid(),
      inputEventId,
      inputEventSeq,
      policyId: decision.routeId,
      policyVersion: decision.actionVersion,
      agentRole: decision.targetAgentId,
      createdAt,
      updatedAt: createdAt
    });
  }

  private updateEventRouting(eventId: string, body: string | undefined, routing: EventRoutingSummary): void {
    this.connection().prepare(`
      UPDATE events
      SET routing_json = @routingJson,
          handling_result = @handlingResult
      WHERE event_id = @eventId
    `).run({
      eventId,
      routingJson: stringifyJson(routing),
      handlingResult: body ? `${body}\n\n${routing.message}` : routing.message
    });
  }

  private recordProjectorOffset(lastSeq: number): void {
    this.connection().prepare(`
      INSERT INTO consumer_offsets (consumer_name, last_seq)
      VALUES (@consumerName, @lastSeq)
      ON CONFLICT(consumer_name) DO UPDATE SET last_seq = max(last_seq, excluded.last_seq)
    `).run({ consumerName: PROJECTOR_CONSUMER, lastSeq });
  }

  private routingSummary(decisions: RouteDecision[]): EventRoutingSummary {
    const routedRuns = decisions.filter((decision) => decision.status === "routed").length;
    const skippedActions = decisions.filter((decision) => decision.status === "skipped").length;
    let message = "No automation action matched the event.";
    if (routedRuns > 0) {
      message = `Routed to ${routedRuns} agent run${routedRuns === 1 ? "" : "s"} by ${decisions.length} matching action${decisions.length === 1 ? "" : "s"}.`;
    } else if (skippedActions > 0) {
      message = `${skippedActions} matching action${skippedActions === 1 ? " was" : "s were"} skipped because target agents were disabled, missing, or human-gated.`;
    }

    return {
      matchedActions: decisions.length,
      routedRuns,
      skippedActions,
      decisions: decisions.map((decision) => ({ ...decision })),
      message
    };
  }
}
