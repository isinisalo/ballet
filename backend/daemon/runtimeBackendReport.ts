import type { RuntimeProvider } from "../../shared/domain/runtime.js";
import type { RuntimeModel, RuntimeProbe } from "./providers/CliRuntimeAdapter.js";
import type { DaemonBackendReport } from "./transport/DaemonControlPlane.js";

export const reportFromProbe = (
  id: string,
  probe: RuntimeProbe,
  models: RuntimeModel[]
): DaemonBackendReport => {
  const probeHealth = !probe.installed
    ? "error"
    : !probe.compatible
      ? "unsupported_version"
      : probe.authStatus !== "ready"
        ? "auth_required"
        : "ready";
  const noModels = probeHealth === "ready" && models.length === 0;
  return {
    id,
    provider: probe.provider,
    cliVersion: probe.version,
    executablePath: probe.command,
    authStatus: probe.authStatus,
    health: noModels ? "error" : probeHealth,
    healthMessage: noModels ? "Model discovery returned no available models." : probe.reason,
    capabilities: {
      models: models.map((model) => ({
        id: model.id,
        label: model.name,
        reasoningOptions: model.reasoningOptions?.length
          ? [...model.reasoningOptions]
          : ["provider-default"],
        defaultReasoning: model.reasoningOptions?.includes(model.defaultReasoning ?? "")
          ? model.defaultReasoning
          : model.reasoningOptions?.[0] ?? "provider-default"
      })),
      supportsResume: true,
      supportsStructuredOutput: true,
      policy: probe.policyCapabilities,
      refreshedAt: new Date().toISOString()
    }
  };
};

export const modelDiscoveryErrorReport = (
  id: string,
  probe: RuntimeProbe,
  error: unknown
): DaemonBackendReport => ({
  ...reportFromProbe(id, probe, []),
  health: probe.compatible ? "error" : "unsupported_version",
  healthMessage: `Model discovery failed: ${error instanceof Error ? error.message : String(error)}`
});

export const errorReport = (id: string, provider: RuntimeProvider, error: unknown): DaemonBackendReport => ({
  id,
  provider,
  authStatus: "unknown",
  health: "error",
  healthMessage: error instanceof Error ? error.message : String(error),
  capabilities: {
    models: [],
    supportsResume: true,
    supportsStructuredOutput: true,
    policy: { workspaceWrite: false, networkControl: false, readOnlyRoots: false },
    refreshedAt: new Date().toISOString()
  }
});
