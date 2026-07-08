import { describe, expect, it } from "vitest";
import { actionInputSources } from "../src/workspace/automation/actions/actionInputSources";

describe("actionInputSources", () => {
  it("returns event inputs for matching action policies in config order", () => {
    expect(actionInputSources([
      { action: "build", event: "manual-start" },
      { action: "review", event: "build.ready" },
      { action: "build", event: "build.failed" }
    ], "build")).toEqual([
      { type: "event", id: "manual-start", label: "manual-start" },
      { type: "event", id: "build.failed", label: "build.failed" }
    ]);
  });

  it("skips policies without a concrete event id", () => {
    expect(actionInputSources([
      { action: "build", event: "" }
    ], "build")).toEqual([]);
  });
});
