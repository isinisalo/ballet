import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStream } from "../src/app/useAppStream";

const originalEventSource = globalThis.EventSource;
const rootRunId = "10000000-0000-4000-8000-000000000001";

class ControlledEventSource extends EventTarget {
  static instances: ControlledEventSource[] = [];
  readonly url: string;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(url: string | URL) {
    super();
    this.url = String(url);
    ControlledEventSource.instances.push(this);
  }

  close() {}

  emit(type: string, data: unknown) {
    this.dispatchEvent(new MessageEvent(type, { data: JSON.stringify(data) }));
  }
}

beforeEach(() => {
  ControlledEventSource.instances = [];
  globalThis.EventSource = ControlledEventSource as unknown as typeof EventSource;
  window.EventSource = ControlledEventSource as unknown as typeof EventSource;
});

afterEach(() => {
  globalThis.EventSource = originalEventSource;
  window.EventSource = originalEventSource;
});

describe("useAppStream", () => {
  it("dispatches only strict typed invalidations", async () => {
    const onWorkspaceChanged = vi.fn();
    const onRunsChanged = vi.fn();
    renderHook(() => useAppStream({ onWorkspaceChanged, onRunsChanged }));
    const source = ControlledEventSource.instances[0]!;

    act(() => source.emit("runs-changed", {
      id: 1,
      type: "runs-changed",
      at: "2026-01-01T00:00:00.000Z",
      rootRunId,
      stateRevision: 2,
      status: "running"
    }));
    await waitFor(() => expect(onRunsChanged).toHaveBeenCalledWith(expect.objectContaining({
      rootRunId,
      stateRevision: 2,
      status: "running"
    })));

    act(() => source.emit("runs-changed", {
      id: 2,
      type: "runs-changed",
      at: "2026-01-01T00:00:00.000Z",
      rootRunId,
      route: "provider-text"
    }));
    expect(onRunsChanged).toHaveBeenCalledTimes(1);
    expect(onWorkspaceChanged).not.toHaveBeenCalled();
  });
});
