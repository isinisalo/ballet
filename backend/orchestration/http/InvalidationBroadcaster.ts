import type { InvalidationEvent, InvalidationKind } from "../../../shared/orchestration/httpContracts.js";

export class InvalidationBroadcaster {
  private sequence = 0;
  private readonly events: InvalidationEvent[] = [];
  private readonly listeners = new Set<(event: InvalidationEvent) => void>();

  publish(kind: InvalidationKind, createdAt: string, entityId?: string): InvalidationEvent {
    const event = { sequence: ++this.sequence, kind, entityId, createdAt };
    this.events.push(event);
    if (this.events.length > 512) this.events.splice(0, this.events.length - 512);
    for (const listener of this.listeners) listener(event);
    return event;
  }

  list(after: number): InvalidationEvent[] {
    return this.events.filter(({ sequence }) => sequence > after).slice(0, 256);
  }

  subscribe(listener: (event: InvalidationEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
