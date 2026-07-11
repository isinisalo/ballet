import type { DashboardRunStatus, RootRunSummary } from "@shared/api/workspace-contracts";
import { runAgentPath, runLoopPath } from "../routing";

export const activeRunStatuses = new Set<DashboardRunStatus>(["queued", "running", "waiting_for_human", "finalizing"]);
export const cancellableRunStatuses = new Set<DashboardRunStatus>(["queued", "running", "waiting_for_human"]);

export const runSummaryPath = (run: RootRunSummary) => run.kind === "loop"
  ? runLoopPath(run.targetId, run.rootRunId)
  : runAgentPath(run.targetId, run.rootRunId);

export const currentRunLabel = (run: RootRunSummary) => {
  const parts = [run.current?.loopId, run.current?.stepId, run.current?.agentId].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : run.targetId;
};

export const changedFilesLabel = (paths: string[]) => {
  if (paths.length === 0) return "no changed files";
  const visible = paths.slice(0, 5).join(" · ");
  return paths.length > 5 ? `${visible} · +${paths.length - 5} more` : visible;
};

export const runStatusTone = (status: DashboardRunStatus) => {
  if (status === "completed") return "secondary" as const;
  if (["blocked", "failed", "cancelled"].includes(status)) return "destructive" as const;
  return "outline" as const;
};
