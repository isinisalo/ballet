import { Alert, AlertDescription } from "@/components/ui/alert";
import { validateRunnableEnvironment } from "@shared/vnext/gates";
import type { RouteState } from "@/workspace/types";
import type { VNextConfigureData } from "../types";
import type { GovernanceData, JsonRow, RunSummary } from "../runTypes";
import type { useVNextMutation } from "../useVNextMutation";
import { vNextApi } from "../vNextApi";
import { CriticReviewWorkspace } from "./CriticReviewWorkspace";
import { FeedbackWorkspace } from "./FeedbackWorkspace";
import { ProductWorkspace } from "./ProductWorkspace";
import { RefinementReviewWorkspace } from "./RefinementReviewWorkspace";
import { RunDetailWorkspace } from "./RunDetailWorkspace";
import { RunListWorkspace } from "./RunListWorkspace";

export function VNextGovernanceOutlet({ route, configure, governance, navigate, mutation }: { route: RouteState; configure: VNextConfigureData; governance: GovernanceData; navigate(path: string): void; mutation: ReturnType<typeof useVNextMutation> }) {
  const config = configure.project.config; let content;
  switch (route.vNextView) {
    case "run-list": content = <RunListWorkspace runs={governance.runs} environment={config.environment} issues={validateRunnableEnvironment(config.environment, config.direction)} configHash={configure.project.configHash} navigate={navigate} onStart={async (environmentId, hash, input) => { let started: RunSummary | undefined; if (await mutation.run(async () => { started = await vNextApi.startRun(environmentId, hash, input); })) navigate(`/vnext/run/${encodeURIComponent(started!.environmentRunId)}`); }} />; break;
    case "run-detail": case "run-state": case "run-action": content = <RunDetailWorkspace run={governance.selectedRun} feedback={governance.feedback} stateId={route.stateId} actionId={route.actionId} navigate={navigate} onCancel={async (id) => { await mutation.run(() => vNextApi.cancelRun(id)); }} />; break;
    case "feedback-list": case "feedback-detail": content = <FeedbackWorkspace rows={governance.feedback} runs={governance.runs} selected={governance.selectedFeedback} selectedId={route.vNextView === "feedback-detail" ? route.entityId : undefined} navigate={navigate} onCreate={async (input) => { await mutation.run(() => vNextApi.createFeedback(input)); }} onDecision={async (id, from, decision) => { await mutation.run(() => vNextApi.decideFeedback(id, from, decision)); }} onRefinement={async (runId, feedbackId) => { await mutation.run(() => vNextApi.createRefinement(runId, [feedbackId])); navigate("/vnext/reviews/refinement"); }} />; break;
    case "critic-reviews": case "critic-proposal": content = <CriticReviewWorkspace proposals={governance.criticProposals} selected={governance.selectedCritic} selectedId={route.vNextView === "critic-proposal" ? route.entityId : undefined} runs={governance.runs} navigate={navigate} onDecision={async (id, input) => { await mutation.run(() => vNextApi.decideCritic(id, input)); }} />; break;
    case "refinement-reviews": case "refinement-proposal": content = <RefinementReviewWorkspace proposals={governance.refinementProposals} selected={governance.selectedRefinement} selectedId={route.vNextView === "refinement-proposal" ? route.entityId : undefined} feedback={governance.feedback} applyStatus={governance.applyStatus} continuation={governance.continuation} navigate={navigate} onDecision={async (id, input) => { await mutation.run(() => vNextApi.decideRefinement(id, input)); }} onApply={async (id) => { await mutation.run(() => vNextApi.applyRefinement(id)); }} />; break;
    case "products": case "product-detail": content = <ProductWorkspace products={governance.products} selected={governance.selectedProduct} selectedId={route.vNextView === "product-detail" ? route.entityId : undefined} runs={governance.runs} navigate={navigate} />; break;
    default: content = <div className="p-6"><h1 className="text-xl font-semibold">Invalid vNext route</h1><p className="text-muted-foreground">No canonical transitional workspace owns this URL.</p></div>;
  }
  return <>{mutation.error ? <Alert variant="destructive" className="m-4"><AlertDescription>{mutation.error}</AlertDescription></Alert> : null}{content}</>;
}

export const isGovernanceView = (view: RouteState["vNextView"]) => ["run-list", "run-detail", "run-state", "run-action", "feedback-list", "feedback-detail", "critic-reviews", "critic-proposal", "refinement-reviews", "refinement-proposal", "products", "product-detail"].includes(String(view));
export type { JsonRow };
