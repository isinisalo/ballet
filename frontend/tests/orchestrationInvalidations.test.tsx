import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useOrchestrationInvalidations } from "../src/orchestration/useOrchestrationInvalidations";

describe("orchestration invalidations", () => {
  it("refreshes from SSE invalidations without exposing connection status UI state", async () => {
    let invalidationListener: EventListener | undefined;
    class InvalidationEventSource {
      onerror: (() => void) | null = null;
      constructor(public readonly url: string) {}
      addEventListener(type: string, listener: EventListener) { if (type === "invalidation") invalidationListener = listener; }
      close() { /* no persistent test connection */ }
    }
    const originalEventSource = window.EventSource;
    window.EventSource = InvalidationEventSource as unknown as typeof EventSource;
    const refresh = vi.fn().mockResolvedValue(undefined);
    render(<Harness refresh={refresh} />);
    expect(invalidationListener).toBeDefined();
    invalidationListener!(new MessageEvent("invalidation", { data: JSON.stringify({ sequence: 7 }) }));
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    window.EventSource = originalEventSource;
  });
  it("closes the stream when changing workspaces or replacing the refresh callback", () => {
    const closed = vi.fn();
    class Source { onerror = null; addEventListener() {} close = closed; }
    const original = window.EventSource; window.EventSource = Source as unknown as typeof EventSource;
    const { rerender, unmount } = render(<Harness refresh={vi.fn(async () => {})} />);
    rerender(<Harness refresh={vi.fn(async () => {})} />); expect(closed).toHaveBeenCalledTimes(1);
    unmount(); expect(closed).toHaveBeenCalledTimes(2); window.EventSource = original;
  });
});

function Harness({ refresh }: { refresh(): Promise<unknown> }) {
  const value = useOrchestrationInvalidations(refresh);
  return <output>{String(value)}</output>;
}

it("shares one stream and resynchronizes after a restart with lower sequence numbers", async () => {
  vi.useFakeTimers();
  const sources: Source[] = [];
  class Source {
    onerror?: () => void; onopen?: () => void; listener?: EventListener;
    constructor(readonly url: string) { sources.push(this); }
    addEventListener(_type: string, listener: EventListener) { this.listener = listener; }
    close() {}
  }
  const original = window.EventSource;
  window.EventSource = Source as unknown as typeof EventSource;
  const refresh = vi.fn(async () => {}); const second = vi.fn(async () => {});
  const view = render(<><Harness refresh={refresh} /><Harness refresh={second} /></>);
  try {
    expect(sources).toHaveLength(1);
    sources[0].onopen?.();
    sources[0].listener!(new MessageEvent("invalidation", { data: JSON.stringify({ sequence: 20, kind: "run_changed" }) }));
    await vi.advanceTimersByTimeAsync(50);
    sources[0].onerror!(); await vi.advanceTimersByTimeAsync(1000);
    expect(sources[1].url).toBe("/api/events?after=0");
    sources[1].onopen?.();
    sources[1].listener!(new MessageEvent("invalidation", { data: JSON.stringify({ sequence: 1, kind: "project_changed" }) }));
    await vi.advanceTimersByTimeAsync(50);
    expect(refresh).toHaveBeenCalledTimes(4);
    expect(second).toHaveBeenCalledTimes(4);
  } finally { view.unmount(); window.EventSource = original; vi.useRealTimers(); }
});
