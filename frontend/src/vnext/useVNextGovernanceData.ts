import { useCallback, useEffect, useRef, useState } from "react";
import type { RouteState } from "@/workspace/types";
import { toErrorMessage } from "@/lib/errors";
import type { GovernanceData, JsonRow } from "./runTypes";
import { vNextApi } from "./vNextApi";

const optional = async <T,>(operation: () => Promise<T>): Promise<T | undefined> => { try { return await operation(); } catch { return undefined; } };

export function useVNextGovernanceData(route: RouteState) {
  const [data, setData] = useState<GovernanceData>(); const [error, setError] = useState<string>(); const [loading, setLoading] = useState(true);
  const sequence = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++sequence.current;
    try {
      const [runs, feedback, criticRuns, criticProposals, refinementRuns, refinementProposals] = await Promise.all([
        vNextApi.runs(), vNextApi.feedback(), vNextApi.criticRuns(), vNextApi.criticProposals(), vNextApi.refinementRuns(), vNextApi.refinementProposals()
      ]);
      const products = (await Promise.all(runs.filter((run) => run.status === "completed").map((run) => optional(() => vNextApi.product(run.environmentRunId))))).filter(Boolean) as JsonRow[];
      const id = route.entityId;
      const [selectedRun, selectedFeedback, selectedCritic, selectedRefinement] = await Promise.all([
        id && route.vNextView?.startsWith("run-") ? optional(() => vNextApi.run(id)) : undefined,
        id && route.vNextView === "feedback-detail" ? optional(() => vNextApi.feedbackDetail(id)) : undefined,
        id && route.vNextView === "critic-proposal" ? optional(() => vNextApi.criticProposal(id)) : undefined,
        id && route.vNextView === "refinement-proposal" ? optional(() => vNextApi.refinementProposal(id)) : undefined
      ]);
      const selectedProduct = id && route.vNextView === "product-detail" ? products.find((product) => product.product_snapshot_id === id) : undefined;
      const [applyStatus, continuation] = selectedRefinement && ["applying", "applied", "apply_failed"].includes(String(selectedRefinement.status))
        ? await Promise.all([optional(() => vNextApi.applyStatus(id!)), optional(() => vNextApi.continuation(id!))]) : [undefined, undefined];
      if (current !== sequence.current) return;
      setData({ runs, feedback, criticRuns, criticProposals, refinementRuns, refinementProposals, products, selectedRun, selectedFeedback, selectedCritic, selectedRefinement, selectedProduct, applyStatus, continuation }); setError(undefined);
    } catch (reason) { if (current === sequence.current) setError(toErrorMessage(reason, "Unable to load Run and governance data.")); }
    finally { if (current === sequence.current) setLoading(false); }
  }, [route.entityId, route.vNextView]);
  useEffect(() => { void refresh(); }, [refresh]);
  return { data, error, loading, refresh };
}
