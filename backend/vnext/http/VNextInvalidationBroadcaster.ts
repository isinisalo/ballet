import type { VNextInvalidationEvent, VNextInvalidationKind } from "../../../shared/vnext/httpContracts.js";

export class VNextInvalidationBroadcaster {
  private sequence = 0;
  private readonly events: VNextInvalidationEvent[] = [];

  publish(kind: VNextInvalidationKind, createdAt: string, entityId?: string): VNextInvalidationEvent {
    const event = { sequence: ++this.sequence, kind, entityId, createdAt };
    this.events.push(event);
    if (this.events.length > 512) this.events.splice(0, this.events.length - 512);
    return event;
  }

  list(after: number): VNextInvalidationEvent[] {
    return this.events.filter(({ sequence }) => sequence > after).slice(0, 256);
  }
}
