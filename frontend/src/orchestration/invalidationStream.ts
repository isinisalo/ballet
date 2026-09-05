import type { InvalidationEvent } from "@shared/orchestration/httpContracts";

export type InvalidationListener = (events?: InvalidationEvent[]) => Promise<unknown>;
const listeners = new Set<InvalidationListener>();
let stream: EventSource | undefined;
let reconnect: ReturnType<typeof setTimeout> | undefined;
let batchTimer: ReturnType<typeof setTimeout> | undefined;
let batch: InvalidationEvent[] = [];

const notify = (events?: InvalidationEvent[]) => {
  for (const listener of listeners) void listener(events).catch(() => undefined); // Owning hooks expose load errors.
};
const connect = () => {
  if (!listeners.size) return;
  let after = 0;
  const source = new EventSource("/api/events?after=0");
  stream = source;
  // Every connection gets current facts: process-local cursors and truncated replay are not durable state.
  source.onopen = () => { if (stream === source) notify(); };
  source.addEventListener("invalidation", (message) => {
    if (stream !== source) return;
    let event: InvalidationEvent;
    try { event = JSON.parse((message as MessageEvent<string>).data) as InvalidationEvent; } catch { return; }
    if (!Number.isSafeInteger(event.sequence) || event.sequence <= after) return;
    after = event.sequence;
    batch.push(event);
    if (!batchTimer) batchTimer = setTimeout(() => {
      const events = batch; batch = []; batchTimer = undefined; notify(events);
    }, 25);
  });
  source.onerror = () => {
    if (stream !== source) return;
    source.close(); stream = undefined;
    reconnect = setTimeout(connect, 1000);
  };
};
export function subscribeInvalidations(listener: InvalidationListener) {
  listeners.add(listener);
  if (listeners.size === 1) connect();
  return () => {
    listeners.delete(listener);
    if (listeners.size) return;
    clearTimeout(reconnect); clearTimeout(batchTimer); reconnect = undefined; batchTimer = undefined; batch = [];
    stream?.close(); stream = undefined;
  };
}
