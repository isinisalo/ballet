import type { BalletMode } from "@shared/api/workspace-contracts";
import { automationGraphPath, automationLoopPath, runLoopPath, runOverviewPath } from "./routing";
import type { RouteState } from "./types";

export function pathForBalletMode({
  route,
  nextMode,
}: {
  route: RouteState;
  nextMode: BalletMode;
}): string {
  if (nextMode === "run") {
    if (route.view === "run") return runRoutePath(route);
    if (route.view === "automation" && route.automationEntityId) return runLoopPath(route.automationEntityId);
    return runOverviewPath();
  }

  if (route.view !== "run") return configureRoutePath(route);
  if (route.runTargetKind === "loop" && route.runTargetId) return automationLoopPath(route.runTargetId);
  return automationGraphPath();
}

const runRoutePath = (route: RouteState) => {
  if (route.runTargetKind === "loop" && route.runTargetId) return runLoopPath(route.runTargetId, route.rootRunId);
  return runOverviewPath(route.rootRunId);
};

const configureRoutePath = (route: RouteState) => {
  if (route.view === "automation") {
    if (route.automationView === "workflow" && route.automationEntityId) return automationLoopPath(route.automationEntityId);
    return automationGraphPath();
  }
  return windowPath();
};

const windowPath = () => typeof window === "undefined" ? "/" : `${window.location.pathname}${window.location.search}`;
