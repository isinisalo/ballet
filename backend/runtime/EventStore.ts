import type Database from "better-sqlite3";
import type { EventRecord, RuntimeEvent } from "../../shared/domain/events.js";
import { runtimeEventToEventRecord, toEventRecord, toRuntimeEvent } from "./RuntimeRowMappers.js";
import type { EventRow } from "./RuntimeDbTypes.js";

export class EventStore {
  constructor(private readonly connection: () => Database.Database) {}

  listRuntimeEvents(limit = 500): RuntimeEvent[] {
    const rows = this.connection().prepare("SELECT * FROM events ORDER BY seq DESC LIMIT ?").all(limit) as EventRow[];
    return rows.map(toRuntimeEvent);
  }

  listEventRecords(limit = 500): EventRecord[] {
    return this.listRuntimeEvents(limit).map(runtimeEventToEventRecord);
  }

  deleteEvent(eventId: string): void {
    this.connection().prepare("DELETE FROM events WHERE event_id = ?").run(eventId);
  }

  getTriggerEvent(run: import("../../shared/domain/runtime.js").AgentRun): RuntimeEvent | undefined {
    const row = this.getEventById(run.triggerEventId);
    return row ? toRuntimeEvent(row) : undefined;
  }

  getEventById(eventId: string): EventRow | undefined {
    return this.connection().prepare("SELECT * FROM events WHERE event_id = ?").get(eventId) as EventRow | undefined;
  }

  getEventByDedupeKey(dedupeKey: string): EventRow | undefined {
    return this.connection().prepare("SELECT * FROM events WHERE dedupe_key = ?").get(dedupeKey) as EventRow | undefined;
  }

  toEventRecord(row: EventRow): EventRecord {
    return toEventRecord(row);
  }

  toRuntimeEvent(row: EventRow): RuntimeEvent {
    return toRuntimeEvent(row);
  }
}
