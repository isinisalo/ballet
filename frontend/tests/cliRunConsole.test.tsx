import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CliRunConsole } from "../src/workspace/components/CliRunConsole";
import type { CliConsoleEvent } from "../src/workspace/components/cliConsoleTypes";
import { now } from "./runtimeFixtures";

const originalEventSource = globalThis.EventSource;

class ControlledEventSource extends EventTarget {
  static instances: ControlledEventSource[] = [];
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  close = vi.fn();

  constructor(public readonly url: string) {
    super();
    ControlledEventSource.instances.push(this);
    window.setTimeout(() => this.onopen?.(), 0);
  }
}

const entry: CliConsoleEvent = {
  id: 7,
  taskId: "task-1",
  sequence: 7,
  source: "copilot",
  kind: "agent",
  level: "info",
  phase: "completed",
  message: "Stored response",
  contentBytes: 15,
  terminal: false,
  createdAt: now
};

afterEach(() => {
  ControlledEventSource.instances = [];
  globalThis.EventSource = originalEventSource;
  window.EventSource = originalEventSource;
});

describe("CLI run console", () => {
  it("continues SSE from the stored cursor, copies output and reports reconnecting", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    globalThis.EventSource = ControlledEventSource as unknown as typeof EventSource;
    window.EventSource = ControlledEventSource as unknown as typeof EventSource;
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ entries: [entry], lastId: 7, hasMore: false, truncated: false })));
    const onRunEvent = vi.fn();

    render(<CliRunConsole taskId="task-1" provider="copilot" active onRunEvent={onRunEvent} />);
    expect(await screen.findByText("Stored response")).toBeInTheDocument();
    await waitFor(() => expect(ControlledEventSource.instances[0]?.url).toBe("/api/execution-tasks/task-1/console/stream?after=7"));
    expect(screen.getByLabelText("COPILOT CLI console")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Copy console" }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("Stored response"));
    ControlledEventSource.instances[0].dispatchEvent(new MessageEvent("task", { data: JSON.stringify({ id: "task-1", status: "running" }) }));
    expect(onRunEvent).toHaveBeenCalledWith({ id: "task-1", status: "running" });
    ControlledEventSource.instances[0].onerror?.();
    expect(await screen.findByText(/reconnecting/i)).toBeInTheDocument();
  });
});
