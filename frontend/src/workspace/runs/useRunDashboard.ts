import { useCallback, useEffect, useRef, useState } from "react";
import type { RootRunDetail, RootRunSummary, RunTargetsResponse } from "@shared/api/workspace-contracts";
import { toErrorMessage } from "@/lib/errors";
import type { AppStreamStatus } from "@/app/useAppStream";
import { runApi } from "./runApi";

export type RunDashboardState = {
  active: RootRunSummary[];
  recent: RootRunSummary[];
  targets: RunTargetsResponse;
  detail?: RootRunDetail;
  loading: boolean;
  error: string;
  streamStatus: AppStreamStatus;
  refresh: () => Promise<void>;
  cancel: (run: RootRunSummary) => Promise<void>;
};

export type RunDashboardData = Omit<RunDashboardState, "streamStatus">;

export function useRunDashboard({ enabled, rootRunId, targets }: { enabled: boolean; rootRunId?: string; targets: RunTargetsResponse }): RunDashboardData {
  const [active, setActive] = useState<RootRunSummary[]>([]);
  const [recent, setRecent] = useState<RootRunSummary[]>([]);
  const [detail, setDetail] = useState<RootRunDetail>();
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState("");
  const generation = useRef(0);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const current = ++generation.current;
    setLoading(true);
    try {
      const [activePage, recentPage, nextDetail] = await Promise.all([
        runApi.list("active"),
        runApi.list("recent"),
        rootRunId ? runApi.detail(rootRunId) : Promise.resolve(undefined)
      ]);
      if (generation.current !== current) return;
      setActive(activePage.items);
      setRecent(recentPage.items);
      setDetail(nextDetail);
      setError("");
    } catch (caught) {
      if (generation.current === current) setError(toErrorMessage(caught, "Unable to load Run dashboard."));
    } finally {
      if (generation.current === current) setLoading(false);
    }
  }, [enabled, rootRunId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const cancel = useCallback(async (run: RootRunSummary) => {
    await runApi.cancel(run);
    await refresh();
  }, [refresh]);

  return { active, recent, targets, detail, loading, error, refresh, cancel };
}
