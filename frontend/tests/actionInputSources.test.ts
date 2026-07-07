import { describe, expect, it } from "vitest";
import { actionInputSources } from "../src/workspace/automation/actions/actionInputSources";

describe("actionInputSources", () => {
  it("returns trigger and event inputs for matching action policies in config order", () => {
    expect(actionInputSources([
      { action: "build", source: "trigger", trigger: "manual-start" },
      { action: "review", source: "event", event: "build.ready" },
      { action: "build", source: "event", event: "build.failed" }
    ], "build")).toEqual([
      { type: "trigger", id: "manual-start", label: "manual-start" },
      { type: "event", id: "build.failed", label: "build.failed" }
    ]);
  });

  it("skips policies without a concrete trigger or event id", () => {
    expect(actionInputSources([
      { action: "build", source: "trigger" },
      { action: "build", source: "event" }
    ], "build")).toEqual([]);
  });
});
