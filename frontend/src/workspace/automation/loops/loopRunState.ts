import type { LoopRunDetails } from "@shared/api/workspace-contracts";

export const activeLoopRunStatuses = new Set(["running", "waiting_for_human"]);

export const isActiveLoopRun = (run?: LoopRunDetails | null) =>
  Boolean(run && activeLoopRunStatuses.has(run.status));

export const loopRunStatusVariant = (status: LoopRunDetails["status"]): "default" | "secondary" | "destructive" | "outline" => {
  if (status === "failed" || status === "blocked") return "destructive";
  if (status === "completed") return "secondary";
  if (status === "running" || status === "waiting_for_human") return "default";
  return "outline";
};
