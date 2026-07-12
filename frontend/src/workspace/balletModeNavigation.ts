import type { Agent, BalletMode } from "@shared/api/workspace-contracts";
import { agentDocumentPath, automationAllLoopsPath, automationLoopPath, automationNewThemePath, automationThemePath, runAgentPath, runLoopPath, runOverviewPath } from "./routing";
import type { RouteState } from "./types";

export function pathForBalletMode({
  route,
  nextMode,
  agents
}: {
  route: RouteState;
  nextMode: BalletMode;
  agents: Pick<Agent, "id" | "relativePath">[];
}): string {
  if (nextMode === "run") {
    if (route.view === "run") return runRoutePath(route);
    if (route.view === "automation" && route.automationEntityId) return runLoopPath(route.automationEntityId);
    if (route.view === "loop-theme" && route.loopThemeLoopId) return runLoopPath(route.loopThemeLoopId);
    if (route.view === "agents") {
      const agent = agents.find((candidate) => candidate.relativePath === route.documentPath);
      if (agent) return runAgentPath(agent.id);
    }
    return runOverviewPath();
  }

  if (route.view !== "run") return configureRoutePath(route);
  if (route.runTargetKind === "loop" && route.runTargetId) return automationLoopPath(route.runTargetId);
  if (route.runTargetKind === "agent" && route.runTargetId) {
    const agent = agents.find((candidate) => candidate.id === route.runTargetId);
    return agent?.relativePath ? agentDocumentPath(agent.relativePath) : "/agents";
  }
  return automationAllLoopsPath();
}

const runRoutePath = (route: RouteState) => {
  if (route.runTargetKind === "loop" && route.runTargetId) return runLoopPath(route.runTargetId, route.rootRunId);
  if (route.runTargetKind === "agent" && route.runTargetId) return runAgentPath(route.runTargetId, route.rootRunId);
  return runOverviewPath(route.rootRunId);
};

const configureRoutePath = (route: RouteState) => {
  if (route.view === "automation") return route.automationLoopView === "all" ? automationAllLoopsPath() : automationLoopPath(route.automationEntityId);
  if (route.view === "loop-theme" && route.loopThemeLoopId) {
    if (route.loopThemeId) return automationThemePath(route.loopThemeId, route.loopThemeLoopId);
    if (route.loopThemeSourceId) return automationNewThemePath(route.loopThemeSourceId, route.loopThemeLoopId);
  }
  if (route.view === "agents" && route.documentPath) return agentDocumentPath(route.documentPath);
  return windowPath();
};

const windowPath = () => typeof window === "undefined" ? "/" : `${window.location.pathname}${window.location.search}`;
