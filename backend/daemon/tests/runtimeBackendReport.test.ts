import { describe, expect, it } from "vitest";
import { reportFromProbe } from "../runtimeBackendReport.js";

const probe = {
  provider: "codex" as const,
  command: "codex",
  installed: true,
  compatible: true,
  version: "0.144.1",
  minimumVersion: "0.144.1",
  authStatus: "ready" as const,
  policyCapabilities: { workspaceWrite: true, networkControl: true, readOnlyRoots: false }
};

describe("runtime backend capability reports", () => {
  it("publishes exact provider reasoning levels without inventing a default option", () => {
    const report = reportFromProbe("backend-1", probe, [{
      id: "gpt-5.6",
      name: "GPT-5.6",
      reasoningOptions: ["low", "high"],
      defaultReasoning: "high"
    }]);

    expect(report.capabilities.models[0]).toMatchObject({
      reasoningOptions: ["low", "high"],
      defaultReasoning: "high"
    });
  });

  it("uses provider-default only when the model exposes no reasoning levels", () => {
    const report = reportFromProbe("backend-1", probe, [{ id: "plain", name: "Plain" }]);
    expect(report.capabilities.models[0]).toMatchObject({
      reasoningOptions: ["provider-default"],
      defaultReasoning: "provider-default"
    });
  });

  it("fails closed when an otherwise ready runtime reports no models", () => {
    const report = reportFromProbe("backend-1", probe, []);

    expect(report).toMatchObject({
      health: "error",
      healthMessage: "Model discovery returned no available models.",
      capabilities: { models: [] }
    });
  });

  it("preserves the exact probe reason for an unsupported CLI version", () => {
    const reason = "Codex CLI 0.143.0 is below the required version 0.144.1.";
    const report = reportFromProbe("backend-1", {
      ...probe,
      compatible: false,
      version: "0.143.0",
      reason
    }, []);

    expect(report).toMatchObject({ health: "unsupported_version", healthMessage: reason });
  });
});
