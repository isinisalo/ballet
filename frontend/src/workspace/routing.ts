import type { BalletMode } from "@shared/api/workspace-contracts";
import type { ProjectDocumentCreateKind, RouteState } from "./types";

const projectDocumentCollectionSegment: Record<ProjectDocumentCreateKind, string> = {
  adr: "adrs",
  goal: "goals",
  instruction: "instructions"
};

const documentPathFromSearch = (url: URL) => url.searchParams.get("path") ?? undefined;

const projectCollectionRoute = (view: "project-adrs" | "project-goals" | "project-instructions", url: URL): RouteState => {
  const documentPath = documentPathFromSearch(url);
  return documentPath ? { view, documentPath } : { view };
};

const automationRoute = (url: URL): RouteState => ({
  view: "automation",
  ...(url.searchParams.get("view") === "all"
    ? { automationLoopView: "all" as const }
    : {
        automationEntityId: url.searchParams.get("id") ?? undefined
      })
});

const loopThemeRoute = (url: URL): RouteState => {
  const loopThemeId = url.searchParams.get("id") ?? undefined;
  return {
    view: "loop-theme",
    loopThemeId,
    loopThemeSourceId: loopThemeId ? undefined : url.searchParams.get("newFrom") ?? undefined,
    loopThemeLoopId: url.searchParams.get("loop") ?? undefined
  };
};

const topLevelWorkspaceRoute = (url: URL): RouteState | undefined => {
  if (url.pathname === "/agents") return { view: "agents", documentPath: url.searchParams.get("path") ?? undefined };
  if (url.pathname === "/automation/themes") return loopThemeRoute(url);
  if (url.pathname === "/automation/loops" || url.pathname === "/automation") return automationRoute(url);
  if (url.pathname === "/runtimes") return { view: "runtimes" };
  if (url.pathname === "/skills") return { view: "skills", documentPath: url.searchParams.get("path") ?? undefined };
  return undefined;
};

export const routeFromPath = (path: string): RouteState => {
  const url = new URL(path, "http://localhost");
  if (url.pathname === "/run" || url.pathname === "/run/") return {
    view: "run",
    rootRunId: url.searchParams.get("run") ?? undefined
  };

  const runLoopMatch = url.pathname.match(/^\/run\/loops\/([^/]+)\/?$/);
  if (runLoopMatch) return {
    view: "run",
    runTargetKind: "loop",
    runTargetId: decodeURIComponent(runLoopMatch[1]),
    rootRunId: url.searchParams.get("run") ?? undefined
  };

  const runAgentMatch = url.pathname.match(/^\/run\/agents\/([^/]+)\/?$/);
  if (runAgentMatch) return {
    view: "run",
    runTargetKind: "agent",
    runTargetId: decodeURIComponent(runAgentMatch[1]),
    rootRunId: url.searchParams.get("run") ?? undefined
  };

  if (url.pathname === "/project/goals") return projectCollectionRoute("project-goals", url);
  if (url.pathname === "/project/adrs") return projectCollectionRoute("project-adrs", url);
  if (url.pathname === "/project/instructions") return projectCollectionRoute("project-instructions", url);

  if (url.pathname === "/project/document") {
    const documentPath = documentPathFromSearch(url);
    return documentPath ? { view: "project-document", documentPath } : { view: "projects" };
  }

  return topLevelWorkspaceRoute(url) ?? { view: "projects" };
};

export const projectDocumentPath = (relativePath: string) => `/project/document?path=${encodeURIComponent(relativePath)}`;
export const projectCollectionDocumentPath = (kind: ProjectDocumentCreateKind, relativePath?: string) =>
  `/project/${projectDocumentCollectionSegment[kind]}${relativePath ? `?path=${encodeURIComponent(relativePath)}` : ""}`;
export const agentDocumentPath = (relativePath: string) => `/agents?path=${encodeURIComponent(relativePath)}`;
export const skillDocumentPath = (relativePath: string) => `/skills?path=${encodeURIComponent(relativePath)}`;
export const automationLoopPath = (id?: string) => {
  if (!id) return "/automation/loops";
  const params = new URLSearchParams({ id });
  return `/automation/loops?${params.toString()}`;
};
export const automationAllLoopsPath = () => "/automation/loops?view=all";
export const automationThemePath = (themeId: string, loopId: string) => {
  const params = new URLSearchParams({ id: themeId, loop: loopId });
  return `/automation/themes?${params.toString()}`;
};
export const automationNewThemePath = (sourceThemeId: string, loopId: string) => {
  const params = new URLSearchParams({ newFrom: sourceThemeId, loop: loopId });
  return `/automation/themes?${params.toString()}`;
};
export const runtimePath = () => "/runtimes";
export const runOverviewPath = (rootRunId?: string) => `/run${rootRunId ? `?run=${encodeURIComponent(rootRunId)}` : ""}`;
export const runLoopPath = (loopId: string, rootRunId?: string) =>
  `/run/loops/${encodeURIComponent(loopId)}${rootRunId ? `?run=${encodeURIComponent(rootRunId)}` : ""}`;
export const runAgentPath = (agentId: string, rootRunId?: string) =>
  `/run/agents/${encodeURIComponent(agentId)}${rootRunId ? `?run=${encodeURIComponent(rootRunId)}` : ""}`;

export const balletModeFromRoute = (route: RouteState): BalletMode => route.view === "run" ? "run" : "configure";
