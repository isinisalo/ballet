import { useEffect, useState } from "react";
import { request } from "@/apiClient";
import type { RuntimeConfigurationIssue } from "@shared/api/workspace-contracts";

export function useRuntimeConfigurationIssues({ enabled, refreshSignal }: { enabled: boolean; refreshSignal: unknown }) {
  const [issues, setIssues] = useState<RuntimeConfigurationIssue[]>([]);
  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    const refresh = () => request<RuntimeConfigurationIssue[]>("/api/agents/runtime/issues")
      .then((next) => { if (!disposed) setIssues(next); })
      .catch(() => { if (!disposed) setIssues([]); });
    const onFocus = () => { void refresh(); };
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 5_000);
    window.addEventListener("focus", onFocus);
    return () => { disposed = true; window.clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [enabled, refreshSignal]);
  return issues;
}
