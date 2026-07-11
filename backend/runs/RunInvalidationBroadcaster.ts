import { EventEmitter } from "node:events";
import type { RunInvalidationEvent } from "../../shared/domain/runs.js";

export interface PublishRunInvalidation {
  rootRunId?: string;
  reason?: string;
}

export interface RunInvalidationReplay {
  events: RunInvalidationEvent[];
  reset: boolean;
}

export class RunInvalidationBroadcaster {
  private readonly emitter = new EventEmitter();
  private readonly history: RunInvalidationEvent[] = [];
  private revision = 0;

  constructor(
    private readonly now: () => Date = () => new Date(),
    private readonly historyLimit = 200
  ) {
    this.emitter.setMaxListeners(200);
  }

  publish(input: PublishRunInvalidation = {}): RunInvalidationEvent {
    const event: RunInvalidationEvent = {
      id: ++this.revision,
      type: "runs-invalidated",
      at: this.now().toISOString(),
      rootRunId: input.rootRunId,
      reason: input.reason
    };
    this.history.push(event);
    if (this.history.length > this.historyLimit) this.history.splice(0, this.history.length - this.historyLimit);
    this.emitter.emit("event", event);
    return event;
  }

  eventsAfter(lastEventId = 0): RunInvalidationEvent[] {
    return this.history.filter((event) => event.id > lastEventId);
  }

  replayAfter(lastEventId = 0): RunInvalidationReplay {
    const events = this.eventsAfter(lastEventId);
    if (lastEventId === 0 || lastEventId === this.revision) return { events, reset: false };
    const oldestRetainedId = this.history[0]?.id;
    return {
      events,
      reset: lastEventId > this.revision
        || oldestRetainedId === undefined
        || lastEventId < oldestRetainedId - 1
    };
  }

  subscribe(listener: (event: RunInvalidationEvent) => void): () => void {
    this.emitter.on("event", listener);
    return () => this.emitter.off("event", listener);
  }
}
