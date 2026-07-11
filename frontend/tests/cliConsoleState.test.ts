import { describe, expect, it } from "vitest";
import { appendConsoleEvents, mergeConsoleDeltas } from "../src/workspace/components/cliConsoleState";
import type { CliConsoleEvent } from "../src/workspace/components/cliConsoleTypes";
import { now } from "./runtimeFixtures";

const event = (id: number, patch: Partial<CliConsoleEvent> = {}): CliConsoleEvent => ({
  id,
  taskId: "task-1",
  sequence: id,
  source: "codex",
  kind: "output",
  level: "info",
  phase: "completed",
  message: `line-${id}`,
  contentBytes: 6,
  terminal: false,
  createdAt: now,
  ...patch
});

describe("CLI console state", () => {
  it("drops explicitly raw reasoning and renders semantic summary deltas", () => {
    const result = appendConsoleEvents([], [
      event(1, { kind: "think", phase: "delta", message: "private reasoning", data: { raw: true } }),
      event(2, { kind: "think", phase: "delta", message: "Reviewed the plan" })
    ]);
    expect(result.entries.map((entry) => entry.message)).toEqual(["Reviewed the plan"]);
  });

  it("keeps a bounded latest window and merges streamed deltas", () => {
    const bounded = appendConsoleEvents([], [event(1), event(2), event(3)], 12);
    expect(bounded.truncated).toBe(true);
    expect(bounded.entries.map((entry) => entry.id)).toEqual([2, 3]);

    const merged = mergeConsoleDeltas([
      event(4, { phase: "delta", itemId: "stdout", message: "hello " }),
      event(5, { phase: "delta", itemId: "stdout", message: "world" })
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].message).toBe("hello world");
  });
});
