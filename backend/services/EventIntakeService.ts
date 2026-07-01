import type { AppData } from "../../shared/api/workspaceData.js";
import type { EventRecord } from "../../shared/domain/events.js";
import { notifyRuntimeChanged } from "../runtime-events.js";
import type { RuntimeDatabaseProvider } from "./RuntimeDatabaseProvider.js";

export class EventValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EventValidationError";
  }
}

export class EventIntakeService {
  constructor(
    private readonly readData: () => Promise<AppData>,
    private readonly runtimeDatabaseProvider: RuntimeDatabaseProvider
  ) {}

  async createEvent(input: Omit<Partial<EventRecord>, "id" | "createdAt" | "status"> & Pick<EventRecord, "projectId" | "eventType">) {
    const data = await this.readData();
    const hasActiveDefinition = data.eventDefinitions.some((definition) =>
      definition.active && definition.eventType === input.eventType
    );
    if (!hasActiveDefinition) {
      throw new EventValidationError(`Unknown or inactive event type: ${input.eventType}`);
    }
    const result = this.runtimeDatabaseProvider.runtimeDatabase().intakeEvent({
      projectId: input.projectId,
      eventType: input.eventType,
      source: input.source,
      subject: typeof input.subject === "string" ? input.subject : undefined,
      correlationId: typeof input.correlationId === "string" ? input.correlationId : undefined,
      causationId: typeof input.causationId === "string" ? input.causationId : undefined,
      dedupeKey: typeof input.dedupeKey === "string" ? input.dedupeKey : undefined,
      correlationDepth: typeof input.correlationDepth === "number" ? input.correlationDepth : undefined,
      tags: input.tags,
      payload: input.payload,
      body: input.body
    }, data.policies, data.agents);
    notifyRuntimeChanged("events");
    if (result.runs.length > 0) notifyRuntimeChanged("agent-runs");
    return result.event;
  }

  removeEvent(id: string): void {
    this.runtimeDatabaseProvider.runtimeDatabase().deleteEvent(id);
    notifyRuntimeChanged("events");
  }
}
