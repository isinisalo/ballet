import type { DashboardRunStatus, RootRunSummary } from "@shared/api/workspace-contracts";
import type { OperationalStatusTone } from "@/components/shared/workspace-ui";
import { runLoopPath } from "../routing";

export const cancellableRunStatuses = new Set<DashboardRunStatus>(["queued", "running", "waiting_for_input"]);

export const runSummaryPath = (run: RootRunSummary) => runLoopPath(run.targetId, run.rootRunId);

export const currentRunLabel = (run: RootRunSummary) => {
  const parts = [run.current?.loopId, run.current?.workLoopNodeId, run.current?.nodeRole, run.current?.executionProfileId].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : run.targetId;
};

export const changedFilesLabel = (paths: string[]) => {
  if (paths.length === 0) return "no changed files";
  const visible = paths.slice(0, 5).join(" · ");
  return paths.length > 5 ? `${visible} · +${paths.length - 5} more` : visible;
};

export const runStatusTone = (status: DashboardRunStatus): OperationalStatusTone => {
  if (status === "running") return "active";
  if (status === "completed") return "healthy";
  if (["blocked", "failed", "cancelled"].includes(status)) return "danger";
  return "attention";
};
