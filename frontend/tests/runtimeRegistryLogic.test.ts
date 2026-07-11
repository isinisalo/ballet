import { describe, expect, it } from "vitest";
import { backendReadiness, filterRuntimeDevices } from "../src/workspace/runtimes/runtimeRegistry";
import { emptyExecutionForm, formFromBinding, modelOptions, PROVIDER_DEFAULT, reasoningOptions } from "../src/workspace/agents/execution/executionOptions";
import { runtimeBackend, runtimeDevice } from "./runtimeFixtures";

describe("runtime registry logic", () => {
  it("filters computers by query and operational issues", () => {
    const ready = runtimeDevice();
    const issue = runtimeDevice({
      id: "device-2",
      displayName: "Build Mac",
      hostname: "build.local",
      backends: [runtimeBackend({ id: "backend-2", deviceId: "device-2", authStatus: "required", health: "auth_required" })]
    });

    expect(filterRuntimeDevices([ready, issue], "build", "all")).toEqual([issue]);
    expect(filterRuntimeDevices([ready, issue], "", "issues")).toEqual([issue]);
    expect(backendReadiness(issue, issue.backends[0])).toMatchObject({ label: "Sign-in required", runnable: false });
    expect(backendReadiness(ready, { ...ready.backends[0], busy: true })).toMatchObject({ label: "Busy", runnable: true });
  });

  it("blocks empty model capabilities from UI readiness even if a backend claims ready", () => {
    const failedBackend = runtimeBackend({
      healthMessage: "Model discovery failed: catalog unavailable",
      capabilities: { ...runtimeBackend().capabilities, models: [] }
    });
    const failedDevice = runtimeDevice({ backends: [failedBackend] });

    expect(filterRuntimeDevices([failedDevice], "", "issues")).toEqual([failedDevice]);
    expect(backendReadiness(failedDevice, failedBackend)).toEqual({
      label: "No models",
      tone: "error",
      runnable: false
    });
  });

  it("keeps an unbound agent empty, requires a real model and limits provider-default to reasoning", () => {
    expect(emptyExecutionForm()).toMatchObject({ deviceId: "", runtimeBackendId: "", model: "", reasoning: "" });
    expect(formFromBinding(null)).toEqual(emptyExecutionForm());
    expect(modelOptions(runtimeBackend())).toEqual([{ value: "gpt-test", label: "GPT Test" }]);
    const backendWithoutReasoning = runtimeBackend({ capabilities: { ...runtimeBackend().capabilities, models: [{ id: "gpt-no-levels", label: "No levels", reasoningOptions: [] }] } });
    expect(reasoningOptions(backendWithoutReasoning, "gpt-no-levels")).toEqual([{ value: PROVIDER_DEFAULT, label: "Provider default" }]);
  });
});
