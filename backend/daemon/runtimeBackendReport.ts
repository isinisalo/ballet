import type { LocalProviderStatus, RuntimeProvider } from "../../shared/domain/runtime.js";
import type { RuntimeModel, RuntimeProbe } from "./providers/CliRuntimeAdapter.js";

export const reportFromProbe = (probe: RuntimeProbe, models: RuntimeModel[], busy = false): LocalProviderStatus => {
  const now = new Date().toISOString();
  return {
    provider: probe.provider, cliVersion: probe.version, authStatus: probe.authStatus,
    health: health(probe), healthMessage: probe.reason, busy, updatedAt: now,
    capabilities: {
      models: models.map((model) => {
        const reasoningOptions = model.reasoningOptions?.length ? model.reasoningOptions : ["provider-default"];
        return { id: model.id, label: model.name, reasoningOptions,
          defaultReasoning: model.defaultReasoning ?? reasoningOptions[0] };
      }),
      supportsResume: true, supportsStructuredOutput: true,
      policy: probe.policyCapabilities, refreshedAt: now
    }
  };
};

export const errorReport = (provider: RuntimeProvider, error: unknown, busy = false): LocalProviderStatus => {
  const now = new Date().toISOString();
  return { provider, authStatus: "unknown", health: "error", healthMessage: message(error), busy, updatedAt: now,
    capabilities: { models: [], supportsResume: false, supportsStructuredOutput: false,
      policy: { workspaceWrite: false }, refreshedAt: now } };
};

const health = (probe: RuntimeProbe): LocalProviderStatus["health"] => {
  if (!probe.installed || !probe.compatible) return "unsupported_version";
  if (probe.authStatus !== "ready") return "auth_required";
  return "ready";
};
const message = (error: unknown): string => error instanceof Error ? error.message : String(error);
