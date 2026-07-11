import type {
  RuntimeBackend,
  RuntimeDevice,
  RuntimeDeviceFilter,
  RuntimeProvider
} from "./types";

export const providerLabel = (provider: RuntimeProvider) =>
  provider === "codex" ? "Codex CLI" : "GitHub Copilot CLI";

export const deviceHasIssues = (device: RuntimeDevice) =>
  device.status !== "online" || device.backends.some((backend) =>
    backend.health !== "ready"
    || backend.authStatus !== "ready"
    || backend.capabilities.models.length === 0
  );

export const filterRuntimeDevices = (
  devices: RuntimeDevice[],
  search: string,
  status: RuntimeDeviceFilter
) => {
  const query = search.trim().toLocaleLowerCase();
  return devices.filter((device) => {
    if (status === "online" && device.status !== "online") return false;
    if (status === "issues" && !deviceHasIssues(device)) return false;
    if (!query) return true;
    return [
      device.displayName,
      device.hostname,
      device.platform,
      device.architecture,
      ...device.backends.map((backend) => backend.provider)
    ].some((value) => value.toLocaleLowerCase().includes(query));
  });
};

export const backendReadiness = (device: RuntimeDevice, backend: RuntimeBackend) => {
  if (device.status !== "online" || backend.health === "offline") {
    return { label: "Offline", tone: "muted" as const, runnable: false };
  }
  if (backend.authStatus === "required" || backend.health === "auth_required") {
    return { label: "Sign-in required", tone: "warning" as const, runnable: false };
  }
  if (backend.authStatus === "expired") {
    return { label: "Auth expired", tone: "error" as const, runnable: false };
  }
  if (backend.authStatus !== "ready") {
    return { label: "Auth unknown", tone: "warning" as const, runnable: false };
  }
  if (backend.health === "probing") {
    return { label: "Probing", tone: "warning" as const, runnable: false };
  }
  if (backend.health !== "ready") {
    return { label: backend.health.replace(/_/g, " "), tone: "error" as const, runnable: false };
  }
  if (!backend.cliVersion) return { label: "Version unknown", tone: "warning" as const, runnable: false };
  if (backend.capabilities.models.length === 0) return { label: "No models", tone: "error" as const, runnable: false };
  // Busy is an informational state: the control plane accepts the task and
  // keeps it queued until this backend can claim it.
  if (backend.busy) return { label: "Busy", tone: "warning" as const, runnable: true };
  return { label: "Ready", tone: "healthy" as const, runnable: true };
};

export const formatRuntimeTimestamp = (value?: string) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};
