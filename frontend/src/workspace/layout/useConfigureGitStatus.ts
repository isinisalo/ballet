import { useEffect, useState } from "react";
import { request } from "@/apiClient";
import type { ConfigureGitState } from "./ConfigureGitStatus";

type ConfigureGitStatusResponse = {
  clean: boolean;
  changes: Array<{ path: string; status: string }>;
};

export function useConfigureGitStatus({ enabled, refreshSignal }: { enabled: boolean; refreshSignal: unknown }) {
  const [state, setState] = useState<ConfigureGitState>();

  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    const refresh = () => request<ConfigureGitStatusResponse>("/api/project/config-status")
      .then((response) => { if (!disposed) setState({ clean: response.clean, changeCount: response.changes.length, paths: response.changes.map((change) => change.path) }); })
      .catch(() => { if (!disposed) setState(undefined); });
    const onFocus = () => { void refresh(); };
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 5_000);
    window.addEventListener("focus", onFocus);
    return () => { disposed = true; window.clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [enabled, refreshSignal]);

  return state;
}
