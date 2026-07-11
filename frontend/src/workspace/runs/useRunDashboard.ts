import { useCallback, useEffect, useRef, useState } from "react";
import type { RootRunDetail, RootRunSummary, RunTargetsResponse } from "@shared/api/workspace-contracts";
import { toErrorMessage } from "@/lib/errors";
import { runApi } from "./runApi";

export type RunInvalidationStatus = "idle" | "connecting" | "connected" | "reconnecting" | "unavailable";

export type RunDashboardState = {
  active: RootRunSummary[];
  recent: RootRunSummary[];
  targets: RunTargetsResponse;
  detail?: RootRunDetail;
  loading: boolean;
  error: string;
  streamStatus: RunInvalidationStatus;
  refresh: () => Promise<void>;
  cancel: (run: RootRunSummary) => Promise<void>;
};

const emptyTargets: RunTargetsResponse = { loops: [], agents: [] };

export function useRunDashboard({ enabled, rootRunId }: { enabled: boolean; rootRunId?: string }): RunDashboardState {
  const [active, setActive] = useState<RootRunSummary[]>([]);
  const [recent, setRecent] = useState<RootRunSummary[]>([]);
  const [targets, setTargets] = useState<RunTargetsResponse>(emptyTargets);
  const [detail, setDetail] = useState<RootRunDetail>();
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState("");
  const [streamStatus, setStreamStatus] = useState<RunInvalidationStatus>("idle");
  const generation = useRef(0);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const current = ++generation.current;
    setLoading(true);
    try {
      const [activePage, recentPage, nextTargets, nextDetail] = await Promise.all([
        runApi.list("active"),
        runApi.list("recent"),
        runApi.targets(),
        rootRunId ? runApi.detail(rootRunId) : Promise.resolve(undefined)
      ]);
      if (generation.current !== current) return;
      setActive(activePage.items);
      setRecent(recentPage.items);
      setTargets(nextTargets);
      setDetail(nextDetail);
      setError("");
    } catch (caught) {
      if (generation.current === current) setError(toErrorMessage(caught, "Unable to load Run dashboard."));
    } finally {
      if (generation.current === current) setLoading(false);
    }
  }, [enabled, rootRunId]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => runInvalidationStream(enabled, refresh, setStreamStatus), [enabled, refresh]);

  const cancel = useCallback(async (run: RootRunSummary) => {
    await runApi.cancel(run, detail);
    await refresh();
  }, [detail, refresh]);

  return { active, recent, targets, detail, loading, error, streamStatus, refresh, cancel };
}

function runInvalidationStream(enabled: boolean, refresh: () => Promise<void>, setStatus: (status: RunInvalidationStatus) => void) {
  if (!enabled) { setStatus("idle"); return; }
  if (typeof EventSource === "undefined") { setStatus("unavailable"); return; }
  setStatus("connecting");
  const source = new EventSource("/api/runs/stream");
  const invalidate = () => { void refresh(); };
  source.onopen = () => setStatus("connected");
  source.onerror = () => setStatus("reconnecting");
  source.onmessage = invalidate;
  source.addEventListener("runs-invalidated", invalidate);
  return () => {
    source.removeEventListener("runs-invalidated", invalidate);
    source.close();
  };
}
