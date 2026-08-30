import { describe, expect, it } from "vitest";
import { reportFromProbe } from "./runtimeBackendReport.js";

describe("runtimeBackendReport", () => {
  it("makes provider-default reasoning explicit for models without choices", () => {
    const report = reportFromProbe({ provider: "codex", command: "codex", installed: true, compatible: true, authStatus: "ready",
      version: "1", minimumVersion: "1", policyCapabilities: { workspaceWrite: true } }, [
      { id: "auto", name: "Auto", reasoningOptions: [] }
    ]);
    expect(report.capabilities.models[0]).toEqual(expect.objectContaining({
      reasoningOptions: ["provider-default"], defaultReasoning: "provider-default"
    }));
  });
});
