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
});

function Harness({ refresh }: { refresh(): Promise<unknown> }) {
  const value = useOrchestrationInvalidations(refresh);
  return <output>{String(value)}</output>;
}
