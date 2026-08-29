import { Alert, AlertDescription } from "@/components/ui/alert";
import { validateRunnableEnvironment } from "@shared/orchestration/gates";
import type { RouteState } from "@/workspace/types";
import type { OrchestrationConfigureData } from "../types";
import type { GovernanceData, JsonRow, RunSummary } from "../runTypes";
import type { useOrchestrationMutation } from "../useOrchestrationMutation";
import { orchestrationApi } from "../orchestrationApi";
import { CriticReviewWorkspace } from "./CriticReviewWorkspace";
import { FeedbackWorkspace } from "./FeedbackWorkspace";
import { RefinementReviewWorkspace } from "./RefinementReviewWorkspace";
import { RunDetailWorkspace } from "./RunDetailWorkspace";
import { RunListWorkspace } from "./RunListWorkspace";

export function OrchestrationGovernanceOutlet({ route, configure, governance, navigate, mutation }: { route: RouteState; configure: OrchestrationConfigureData; governance: GovernanceData; navigate(path: string): void; mutation: ReturnType<typeof useOrchestrationMutation> }) {
  const config = configure.project.config; let content;
  switch (route.workspaceView) {
    case "run-list": content = <RunListWorkspace runs={governance.runs} environment={config.environment} issues={validateRunnableEnvironment(config.environment, config.direction)} configHash={configure.project.configHash} navigate={navigate} onStart={async (environmentId, hash, input) => { let started: RunSummary | undefined; if (await mutation.run(async () => { started = await orchestrationApi.startRun(environmentId, hash, input); })) navigate(`/run/${encodeURIComponent(started!.environmentRunId)}`); }} />; break;
    case "run-detail": case "run-state": case "run-action": content = <RunDetailWorkspace run={governance.selectedRun} feedback={governance.feedback} stateId={route.stateId} actionId={route.actionId} navigate={navigate} onCancel={async (id) => { await mutation.run(() => orchestrationApi.cancelRun(id)); }} onWorkInput={async (id, agentId, revision, answer) => { await mutation.run(() => orchestrationApi.answerWorkInput(id, agentId, revision, answer)); }} />; break;
    case "feedback-list": case "feedback-detail": content = <FeedbackWorkspace rows={governance.feedback} selected={governance.selectedFeedback} selectedId={route.workspaceView === "feedback-detail" ? route.entityId : undefined} navigate={navigate} onCreate={async (input) => { await mutation.run(() => orchestrationApi.createFeedback(input)); }} onDecision={async (id, from, decision) => { await mutation.run(() => orchestrationApi.decideFeedback(id, from, decision)); }} onRefinement={async (_runId, feedbackId) => { await mutation.run(() => orchestrationApi.createRefinement(feedbackId)); navigate("/reviews/refinement"); }} />; break;
    case "critic-reviews": case "critic-proposal": content = <CriticReviewWorkspace proposals={governance.criticProposals} selected={governance.selectedCritic} selectedId={route.workspaceView === "critic-proposal" ? route.entityId : undefined} navigate={navigate} onDecision={async (id, input) => { await mutation.run(() => orchestrationApi.decideCritic(id, input)); }} />; break;
    case "refinement-reviews": case "refinement-proposal": content = <RefinementReviewWorkspace proposals={governance.refinementProposals} selected={governance.selectedRefinement} selectedId={route.workspaceView === "refinement-proposal" ? route.entityId : undefined} feedback={governance.feedback} applyStatus={governance.applyStatus} continuation={governance.continuation} navigate={navigate} onDecision={async (id, input) => { await mutation.run(() => orchestrationApi.decideRefinement(id, input)); }} onApply={async (id) => { await mutation.run(() => orchestrationApi.applyRefinement(id)); }} />; break;
    default: content = <div className="p-6"><h1 className="text-xl font-semibold">Invalid orchestration route</h1><p className="text-muted-foreground">No canonical transitional workspace owns this URL.</p></div>;
  }
  return <>{mutation.error ? <Alert variant="destructive" className="m-4"><AlertDescription>{mutation.error}</AlertDescription></Alert> : null}{content}</>;
}

export const isGovernanceView = (view: RouteState["workspaceView"]) => ["run-list", "run-detail", "run-state", "run-action", "feedback-list", "feedback-detail", "critic-reviews", "critic-proposal", "refinement-reviews", "refinement-proposal"].includes(String(view));
export type { JsonRow };
