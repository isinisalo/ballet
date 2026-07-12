import type { LocalProviderStatus, RuntimeProvider } from "@shared/api/workspace-contracts";

export const providerLabel = (provider: RuntimeProvider) =>
  provider === "codex" ? "Codex CLI" : "GitHub Copilot CLI";

export const providerReadiness = (provider: LocalProviderStatus) => {
  if (!provider.installed) {
    return { label: "Not installed", tone: "muted" as const, runnable: false };
  }
  if (provider.authStatus === "required" || provider.health === "auth_required") {
    return { label: "Sign-in required", tone: "warning" as const, runnable: false };
  }
  if (provider.authStatus === "expired") {
    return { label: "Auth expired", tone: "error" as const, runnable: false };
  }
  if (provider.authStatus !== "ready") {
    return { label: "Auth unknown", tone: "warning" as const, runnable: false };
  }
  if (provider.health === "probing") {
    return { label: "Probing", tone: "warning" as const, runnable: false };
  }
  if (!provider.compatible || provider.health === "unsupported_version") {
    return { label: "Unsupported version", tone: "error" as const, runnable: false };
  }
  if (provider.health !== "ready") {
    return { label: provider.health.replace(/_/g, " "), tone: "error" as const, runnable: false };
  }
  if (!provider.cliVersion) return { label: "Version unknown", tone: "warning" as const, runnable: false };
  if (provider.capabilities.models.length === 0) return { label: "No models", tone: "error" as const, runnable: false };
  if (provider.busy) return { label: "Busy", tone: "warning" as const, runnable: true };
  return { label: "Ready", tone: "healthy" as const, runnable: true };
};

export const formatRuntimeTimestamp = (value?: string) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

export const formatUptime = (seconds: number): string => {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  return [days ? `${days}d` : "", hours ? `${hours}h` : "", `${minutes}m`].filter(Boolean).join(" ");
};
