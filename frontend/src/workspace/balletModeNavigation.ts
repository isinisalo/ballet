import type { BalletMode } from "@shared/api/workspace-contracts";
import { automationGraphNodePath, automationGraphPath, runGraphNodePath, runGraphPath, runOverviewPath } from "./routing";
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
    if (route.view === "automation" && route.graphNodeId) return runGraphNodePath(route.graphNodeId);
    return runOverviewPath();
  }

  if (route.view !== "run") return configureRoutePath(route);
  if (route.runTargetKind === "graph_node" && route.runTargetId) return automationGraphNodePath(route.runTargetId);
  return automationGraphPath();
}

const runRoutePath = (route: RouteState) => {
  if (route.runTargetKind === "graph" && route.runTargetId) return runGraphPath(route.runTargetId, route.rootRunId);
  if (route.runTargetKind === "graph_node" && route.runTargetId) return runGraphNodePath(route.runTargetId, route.rootRunId);
  return runOverviewPath(route.rootRunId);
};

const configureRoutePath = (route: RouteState) => {
  if (route.view === "automation") {
    if (route.graphNodeId) return automationGraphNodePath(route.graphNodeId);
    return automationGraphPath();
  }
  return windowPath();
};

const windowPath = () => typeof window === "undefined" ? "/" : `${window.location.pathname}${window.location.search}`;
