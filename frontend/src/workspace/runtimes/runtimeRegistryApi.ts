import { request } from "@/apiClient";
import type {
  PairingSession,
  RuntimeDevice,
  RuntimeDeviceFilter,
  RuntimeDeviceListResponse,
  RuntimeLogsResponse
} from "./types";

const devicePath = (deviceId: string) => `/api/runtimes/devices/${encodeURIComponent(deviceId)}`;
const pairingPath = (pairingId: string) => `/api/pairing/sessions/${encodeURIComponent(pairingId)}`;

export const runtimeRegistryApi = {
  listDevices: async (search = "", status: RuntimeDeviceFilter = "all") => {
    const query = new URLSearchParams();
    if (search.trim()) query.set("search", search.trim());
    if (status !== "all") query.set("status", status);
    const suffix = query.size ? `?${query.toString()}` : "";
    const response = await request<RuntimeDeviceListResponse | RuntimeDevice[]>(`/api/runtimes/devices${suffix}`);
    return Array.isArray(response) ? response : response.devices;
  },
  getDevice: (deviceId: string) => request<RuntimeDevice>(devicePath(deviceId)),
  refreshDevice: (deviceId: string) => request<RuntimeDevice>(`${devicePath(deviceId)}/refresh`, { method: "POST", body: "{}" }),
  restartDevice: (deviceId: string) => request<RuntimeDevice>(`${devicePath(deviceId)}/restart`, { method: "POST", body: "{}" }),
  getDeviceLogs: (deviceId: string) => request<RuntimeLogsResponse>(`${devicePath(deviceId)}/logs`),
  disconnectDevice: (deviceId: string) => request<void>(devicePath(deviceId), { method: "DELETE" }),
  createPairingSession: () => request<PairingSession>("/api/pairing/sessions", { method: "POST", body: "{}" }),
  getPairingSession: (pairingId: string) => request<PairingSession>(pairingPath(pairingId)),
  approvePairingSession: (pairingId: string) => request<PairingSession>(`${pairingPath(pairingId)}/approve`, { method: "POST", body: "{}" })
};
