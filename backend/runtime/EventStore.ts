import type Database from "better-sqlite3";
import { v4 as uuid } from "uuid";
import type { EventRecord, RuntimeEvent } from "../../shared/domain/events.js";
import { stringifyJson } from "./RuntimeJson.js";
import { runtimeEventToEventRecord, toEventRecord, toRuntimeEvent } from "./RuntimeRowMappers.js";
import { now, type EventRow, type IntakeEventInput, type PublishEventResult } from "./RuntimeDbTypes.js";

export class EventStore {
  constructor(
    private readonly connection: () => Database.Database,
    private readonly projectId: string
  ) {}

  listRuntimeEvents(limit = 500): RuntimeEvent[] {
    const rows = this.connection().prepare("SELECT * FROM events WHERE project_id = ? ORDER BY seq DESC LIMIT ?")
      .all(this.projectId, limit) as EventRow[];
    return rows.map(toRuntimeEvent);
  }

  listEventRecords(limit = 500): EventRecord[] {
    return this.listRuntimeEvents(limit).map(runtimeEventToEventRecord);
  }

  deleteEvent(eventId: string): void {
    this.connection().prepare("DELETE FROM events WHERE project_id = ? AND event_id = ?").run(this.projectId, eventId);
  }

  intake(input: IntakeEventInput): PublishEventResult {
    if (input.projectId !== this.projectId) throw new Error(`Event project ${input.projectId} is not the active project ${this.projectId}.`);
    const transaction = this.connection().transaction(() => {
      if (input.dedupeKey) {
        const duplicate = this.getEventByDedupeKey(input.dedupeKey);
        if (duplicate) return { event: toEventRecord(duplicate), duplicate: true };
      }
      const eventId = uuid();
      const createdAt = now();
      const payload = input.payload ?? {};
      const subject = input.subject
        ?? (typeof payload.work_item_id === "string" ? payload.work_item_id : undefined)
        ?? (typeof payload.workItemId === "string" ? payload.workItemId : undefined)
        ?? input.projectId;
      this.connection().prepare(`
        INSERT INTO events (
          event_id, type, source, subject, correlation_id, causation_id, dedupe_key,
          correlation_depth, occurred_at, project_id, tags_json, status,
          handling_result, payload_json
        ) VALUES (
          @eventId, @type, @source, @subject, @correlationId, @causationId, @dedupeKey,
          @correlationDepth, @occurredAt, @projectId, @tagsJson, 'unassigned',
          @handlingResult, @payloadJson
        )
      `).run({
        eventId,
        type: input.eventType,
        source: input.source ?? "unknown",
        subject,
        correlationId: input.correlationId ?? eventId,
        causationId: input.causationId ?? null,
        dedupeKey: input.dedupeKey ?? null,
        correlationDepth: input.correlationDepth ?? 0,
        occurredAt: createdAt,
        projectId: input.projectId,
        tagsJson: stringifyJson(input.tags ?? []),
        handlingResult: input.body ?? "Event recorded. Automation v4 loop runs are started independently.",
        payloadJson: stringifyJson(payload)
      });
      const row = this.getEventById(eventId);
      if (!row) throw new Error("Failed to read the stored event.");
      return { event: toEventRecord(row), duplicate: false };
    });
    return transaction() as PublishEventResult;
  }

  getEventById(eventId: string): EventRow | undefined {
    return this.connection().prepare("SELECT * FROM events WHERE project_id = ? AND event_id = ?")
      .get(this.projectId, eventId) as EventRow | undefined;
  }

  getEventByDedupeKey(dedupeKey: string): EventRow | undefined {
    return this.connection().prepare("SELECT * FROM events WHERE project_id = ? AND dedupe_key = ?")
      .get(this.projectId, dedupeKey) as EventRow | undefined;
  }

  toEventRecord(row: EventRow): EventRecord {
    return toEventRecord(row);
  }

  toRuntimeEvent(row: EventRow): RuntimeEvent {
    return toRuntimeEvent(row);
  }
}
