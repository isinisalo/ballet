import { ApiRequestError } from "@/apiClient";
import type { InvalidationEvent } from "@shared/orchestration/httpContracts";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RouteState } from "@/workspace/types";
import { toErrorMessage } from "@/lib/errors";
import type { GovernanceData } from "./runTypes";
import { orchestrationApi } from "./orchestrationApi";

async function optional<T>(operation: () => Promise<T>): Promise<T | undefined> {
  try { return await operation(); }
  catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) return undefined;
    throw error;
  }
}

function relevantEvent(view: string, { kind }: InvalidationEvent) {
  if (kind === "project_changed") return true;
  if (view.startsWith("run-") || view.startsWith("feedback-")) return kind === "run_changed" || kind === "feedback_changed";
  if (view.startsWith("critic-")) return kind === "critic_changed";
  if (view.startsWith("refinement-")) return ["refinement_changed", "feedback_changed", "run_changed"].includes(kind);
  return false;
}

async function loadGovernance(view: string, id?: string): Promise<GovernanceData> {
  const [runs, feedback, criticProposals, refinementProposals] = await Promise.all([
    view === "run-list" ? orchestrationApi.runs() : [],
    /^(run|feedback|refinement)-/.test(view) ? orchestrationApi.feedback() : [],
    view.startsWith("critic-") ? orchestrationApi.criticProposals() : [],
    view.startsWith("refinement-") ? orchestrationApi.refinementProposals() : []
  ]);
  const details = id ? await loadSelection(view, id) : {};
  return { runs, feedback, criticProposals, refinementProposals, ...details };
}

async function loadSelection(view: string, id: string): Promise<Partial<GovernanceData>> {
  if (view.startsWith("run-")) return { selectedRun: await optional(() => orchestrationApi.run(id)) };
  if (view === "feedback-detail") return { selectedFeedback: await optional(() => orchestrationApi.feedbackDetail(id)) };
  if (view === "critic-proposal") return { selectedCritic: await optional(() => orchestrationApi.criticProposal(id)) };
  if (view !== "refinement-proposal") return {};
  const selectedRefinement = await optional(() => orchestrationApi.refinementProposal(id));
  if (!selectedRefinement || !["applying", "applied", "apply_failed"].includes(String(selectedRefinement.status))) return { selectedRefinement };
  const [applyStatus, continuation] = await Promise.all([
    optional(() => orchestrationApi.applyStatus(id)), optional(() => orchestrationApi.continuation(id))
  ]);
  return { selectedRefinement, applyStatus, continuation };
}

export function useOrchestrationGovernanceData(route: RouteState) {
  const [data, setData] = useState<GovernanceData>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const sequence = useRef(0);
  const refresh = useCallback(async (events?: InvalidationEvent[]) => {
    const view = route.workspaceView ?? "";
    if (events && !events.some((event) => relevantEvent(view, event))) return;
    const current = ++sequence.current;
    try {
      const next = await loadGovernance(view, route.entityId);
      if (current !== sequence.current) return;
      setData(next); setError(undefined);
    } catch (reason) {
      if (current === sequence.current) setError(toErrorMessage(reason, "Unable to load Run and governance data."));
    } finally { if (current === sequence.current) setLoading(false); }
  }, [route.entityId, route.workspaceView]);
  useEffect(() => { setLoading(true); void refresh(); return () => { sequence.current++; }; }, [refresh]);
  return { data, error, loading, refresh };
}
