import { ApiRequestError } from "@/apiClient";
import type { InvalidationEvent } from "@shared/orchestration/httpContracts";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RouteState } from "@/workspace/types";
import { toErrorMessage } from "@/lib/errors";
import type { GovernanceData } from "./runTypes";
import { orchestrationApi } from "./orchestrationApi";

const optional = async <T,>(operation: () => Promise<T>): Promise<T | undefined> => { try { return await operation(); } catch (error) { if (error instanceof ApiRequestError && error.status === 404) return undefined; throw error; } };

export function useOrchestrationGovernanceData(route: RouteState) {
  const [data, setData] = useState<GovernanceData>(); const [error, setError] = useState<string>(); const [loading, setLoading] = useState(true);
  const sequence = useRef(0);
  const refresh = useCallback(async (events?: InvalidationEvent[]) => {
    const view = route.workspaceView ?? "";
    const runView = view.startsWith("run-"); const feedbackView = view.startsWith("feedback-");
    const criticView = view.startsWith("critic-"); const refinementView = view.startsWith("refinement-");
    if (events && !events.some(({ kind }) => kind === "project_changed" || kind === "run_changed"
      || (feedbackView && kind === "feedback_changed") || (criticView && kind === "critic_changed")
      || (refinementView && ["refinement_changed", "feedback_changed"].includes(kind)))) return;
    const current = ++sequence.current;
    try {
      const [runs, feedback, criticRuns, criticProposals, refinementRuns, refinementProposals] = await Promise.all([
        view === "run-list" ? orchestrationApi.runs() : [],
        runView || feedbackView || refinementView ? orchestrationApi.feedback() : [],
        [], criticView ? orchestrationApi.criticProposals() : [], [],
        refinementView ? orchestrationApi.refinementProposals() : []
      ]);
      const id = route.entityId;
      const [selectedRun, selectedFeedback, selectedCritic, selectedRefinement] = await Promise.all([
        id && route.workspaceView?.startsWith("run-") ? optional(() => orchestrationApi.run(id)) : undefined,
        id && route.workspaceView === "feedback-detail" ? optional(() => orchestrationApi.feedbackDetail(id)) : undefined,
        id && route.workspaceView === "critic-proposal" ? optional(() => orchestrationApi.criticProposal(id)) : undefined,
        id && route.workspaceView === "refinement-proposal" ? optional(() => orchestrationApi.refinementProposal(id)) : undefined
      ]);
      const [applyStatus, continuation] = selectedRefinement && ["applying", "applied", "apply_failed"].includes(String(selectedRefinement.status))
        ? await Promise.all([optional(() => orchestrationApi.applyStatus(id!)), optional(() => orchestrationApi.continuation(id!))]) : [undefined, undefined];
      if (current !== sequence.current) return;
      setData({ runs, feedback, criticRuns, criticProposals, refinementRuns, refinementProposals, selectedRun, selectedFeedback, selectedCritic, selectedRefinement, applyStatus, continuation }); setError(undefined);
    } catch (reason) { if (current === sequence.current) setError(toErrorMessage(reason, "Unable to load Run and governance data.")); }
    finally { if (current === sequence.current) setLoading(false); }
  }, [route.entityId, route.workspaceView]);
  useEffect(() => { setLoading(true); void refresh(); return () => { sequence.current++; }; }, [refresh]);
  return { data, error, loading, refresh };
}
