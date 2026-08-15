import { describe, expect, it } from "vitest";
import {
  executionProfileBlockingReason,
  modelOptions,
  profileIdFromName,
  PROVIDER_DEFAULT_REASONING,
  providerOptions,
  reasoningOptions
} from "../src/workspace/executionProfiles/executionProfileOptions";
import { providerReadiness } from "../src/workspace/runtimes/runtimeRegistry";
import { localProvider, localRuntime } from "./runtimeFixtures";

describe("local runtime logic", () => {
  it("maps local provider health to runnable readiness", () => {
    expect(providerReadiness(localProvider())).toMatchObject({ label: "Ready", runnable: true });
    expect(providerReadiness(localProvider({ authStatus: "required", health: "auth_required" }))).toMatchObject({ label: "Sign-in required", runnable: false });
    expect(providerReadiness(localProvider({ busy: true }))).toMatchObject({ label: "Busy", runnable: true });
    expect(providerReadiness(localProvider({ installed: false, compatible: false }))).toMatchObject({ label: "Not installed", runnable: false });
  });

  it("blocks empty model capabilities even if a provider probe claims ready", () => {
    const provider = localProvider({ capabilities: { ...localProvider().capabilities, models: [] } });
    expect(providerReadiness(provider)).toEqual({ label: "No models", tone: "error", runnable: false });
  });

  it("derives ExecutionProfile choices directly from provider capabilities", () => {
    const runtime = localRuntime();
    expect(providerOptions(runtime)).toEqual([{ value: "codex", label: "codex" }]);
    expect(modelOptions(localProvider())).toEqual([{ value: "gpt-test", label: "GPT Test" }]);
    expect(reasoningOptions(localProvider(), "gpt-test")).toEqual([
      { value: "low", label: "low" },
      { value: "high", label: "high" }
    ]);
    const providerWithoutReasoning = localProvider({
      capabilities: {
        ...localProvider().capabilities,
        models: [{ id: "gpt-no-levels", label: "No levels", reasoningOptions: [] }]
      }
    });
    expect(reasoningOptions(providerWithoutReasoning, "gpt-no-levels")).toEqual([
      { value: PROVIDER_DEFAULT_REASONING, label: "Provider default" }
    ]);
  });

  it("generates canonical ids and fails closed for unavailable profile intent", () => {
    expect(profileIdFromName("  Delivery / Primary  ")).toBe("delivery-primary");
    expect(executionProfileBlockingReason({
      id: "review",
      name: "Review",
      provider: "copilot",
      model: "missing",
      reasoningEffort: "high",
      networkAccess: false
    }, localRuntime())).toBe("Provider copilot is unavailable.");
  });
});
