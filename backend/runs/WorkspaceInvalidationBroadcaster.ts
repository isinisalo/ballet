import { EventEmitter } from "node:events";
import { workspaceInvalidationEventSchema } from "../../shared/api/runtime-schemas.js";
import type {
  WorkspaceInvalidationEvent, WorkspaceInvalidationInput
} from "../../shared/domain/runs.js";

export class WorkspaceInvalidationBroadcaster {
  private readonly emitter = new EventEmitter();
  private readonly history: WorkspaceInvalidationEvent[] = [];
  private revision = 0;

  constructor(private readonly limit = 200) { this.emitter.setMaxListeners(200); }

  publish(input: WorkspaceInvalidationInput): WorkspaceInvalidationEvent {
    const id = this.revision + 1;
    const event = workspaceInvalidationEventSchema.parse({
      id, at: new Date().toISOString(), ...input
    });
    this.revision = id;
    this.history.push(event);
    if (this.history.length > this.limit) this.history.splice(0, this.history.length - this.limit);
    this.emitter.emit("event", event);
    return event;
  }

  resetEvent(): WorkspaceInvalidationEvent {
    return workspaceInvalidationEventSchema.parse({
      id: this.revision,
      type: "workspace-changed",
      at: new Date().toISOString(),
      reason: "reconnected"
    });
  }

  replay(lastId: number): { events: WorkspaceInvalidationEvent[]; reset: boolean } {
    const oldest = this.history[0]?.id;
    return {
      events: this.history.filter((event) => event.id > lastId),
      reset: lastId > this.revision || (oldest !== undefined && lastId < oldest - 1)
    };
  }

  subscribe(listener: (event: WorkspaceInvalidationEvent) => void): () => void {
    this.emitter.on("event", listener);
    return () => this.emitter.off("event", listener);
  }
}
