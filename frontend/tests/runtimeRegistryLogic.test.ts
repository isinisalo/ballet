import { describe, expect, it } from "vitest";
import { providerReadiness } from "../src/workspace/runtimes/runtimeRegistry";
import { emptyExecutionForm, formFromRuntimeConfiguration, modelOptions, PROVIDER_DEFAULT, reasoningOptions } from "../src/workspace/agents/execution/executionOptions";
import { agentRuntimeConfiguration, localProvider } from "./runtimeFixtures";

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

  it("builds execution options directly from local provider capability", () => {
    expect(emptyExecutionForm()).toMatchObject({ provider: "", model: "", reasoning: "" });
    expect(formFromRuntimeConfiguration(undefined)).toEqual(emptyExecutionForm());
    expect(formFromRuntimeConfiguration(agentRuntimeConfiguration({ readOnlyRoots: ["/shared"] })).policy.readOnlyRoots).toEqual(["/shared"]);
    expect(modelOptions(localProvider())).toEqual([{ value: "gpt-test", label: "GPT Test" }]);
    const providerWithoutReasoning = localProvider({ capabilities: { ...localProvider().capabilities, models: [{ id: "gpt-no-levels", label: "No levels", reasoningOptions: [] }] } });
    expect(reasoningOptions(providerWithoutReasoning, "gpt-no-levels")).toEqual([{ value: PROVIDER_DEFAULT, label: "Provider default" }]);
  });
});
