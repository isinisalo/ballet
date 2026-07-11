import { useCallback, useEffect, useState } from "react";
import { toErrorMessage } from "@/lib/errors";
import { runtimeRegistryApi } from "./runtimeRegistryApi";
import type { RuntimeDevice, RuntimeDeviceFilter } from "./types";

export type RuntimeDeviceAction = "refresh" | "restart" | "disconnect";

export function useRuntimeRegistry(selectedDeviceId?: string) {
  const [devices, setDevices] = useState<RuntimeDevice[]>([]);
  const [device, setDevice] = useState<RuntimeDevice | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<RuntimeDeviceFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingAction, setPendingAction] = useState<RuntimeDeviceAction | null>(null);

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [nextDevices, nextDevice] = await Promise.all([
        runtimeRegistryApi.listDevices(search, status),
        selectedDeviceId ? runtimeRegistryApi.getDevice(selectedDeviceId) : Promise.resolve(null)
      ]);
      setDevices(nextDevices);
      setDevice(nextDevice);
      setError("");
    } catch (caught) {
      setError(toErrorMessage(caught, "Unable to load runtime devices."));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [search, selectedDeviceId, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 180);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh(true);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const runAction = useCallback(async (action: RuntimeDeviceAction) => {
    if (!selectedDeviceId) return false;
    setPendingAction(action);
    setError("");
    try {
      if (action === "refresh") setDevice(await runtimeRegistryApi.refreshDevice(selectedDeviceId));
      if (action === "restart") setDevice(await runtimeRegistryApi.restartDevice(selectedDeviceId));
      if (action === "disconnect") {
        await runtimeRegistryApi.disconnectDevice(selectedDeviceId);
        setDevice(null);
      }
      const nextDevices = await runtimeRegistryApi.listDevices(search, status);
      setDevices(nextDevices);
      return true;
    } catch (caught) {
      setError(toErrorMessage(caught, `Unable to ${action} runtime device.`));
      return false;
    } finally {
      setPendingAction(null);
    }
  }, [search, selectedDeviceId, status]);

  return {
    devices,
    device,
    search,
    status,
    loading,
    error,
    pendingAction,
    setSearch,
    setStatus,
    refresh,
    runAction
  };
}
