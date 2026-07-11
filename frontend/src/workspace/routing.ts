import type { BalletMode } from "@shared/api/workspace-contracts";
import type { ProjectDocumentCreateKind, RouteState } from "./types";

const projectDocumentCollectionSegment: Record<ProjectDocumentCreateKind, string> = {
  adr: "adrs",
  goal: "goals",
  instruction: "instructions"
};

const documentPathFromSearch = (url: URL) => url.searchParams.get("path") ?? undefined;

const projectCollectionRoute = (view: "project-adrs" | "project-goals" | "project-instructions", projectId: string, url: URL): RouteState => {
  const documentPath = documentPathFromSearch(url);
  return documentPath ? { view, projectId, documentPath } : { view, projectId };
};

const automationRoute = (url: URL): RouteState => ({
  view: "automation",
  ...(url.searchParams.get("view") === "all"
    ? { automationLoopView: "all" as const }
    : {
        automationEntityId: url.searchParams.get("id") ?? undefined
      })
});

const runtimeRoute = (url: URL): RouteState => ({
  view: "runtimes",
  runtimeDeviceId: url.searchParams.get("id") ?? undefined
});

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

  const goalsMatch = url.pathname.match(/^\/projects\/([^/]+)\/goals\/?$/);
  if (goalsMatch) return projectCollectionRoute("project-goals", decodeURIComponent(goalsMatch[1]), url);

  const adrsMatch = url.pathname.match(/^\/projects\/([^/]+)\/adrs\/?$/);
  if (adrsMatch) return projectCollectionRoute("project-adrs", decodeURIComponent(adrsMatch[1]), url);

  const instructionsMatch = url.pathname.match(/^\/projects\/([^/]+)\/instructions\/?$/);
  if (instructionsMatch) return projectCollectionRoute("project-instructions", decodeURIComponent(instructionsMatch[1]), url);

  if (url.pathname === "/projects/document") {
    const documentPath = documentPathFromSearch(url);
    return documentPath ? { view: "project-document", documentPath } : { view: "projects" };
  }

  if (url.pathname === "/agents") return { view: "agents", documentPath: url.searchParams.get("path") ?? undefined };
  if (url.pathname === "/automation/loops" || url.pathname === "/automation") return automationRoute(url);
  if (url.pathname === "/runtimes") return runtimeRoute(url);
  if (url.pathname === "/skills") return { view: "skills", documentPath: url.searchParams.get("path") ?? undefined };
  return { view: "projects" };
};

export const projectDocumentPath = (relativePath: string) => `/projects/document?path=${encodeURIComponent(relativePath)}`;
export const projectCollectionDocumentPath = (projectId: string, kind: ProjectDocumentCreateKind, relativePath?: string) =>
  `/projects/${encodeURIComponent(projectId)}/${projectDocumentCollectionSegment[kind]}${relativePath ? `?path=${encodeURIComponent(relativePath)}` : ""}`;
export const agentDocumentPath = (relativePath: string) => `/agents?path=${encodeURIComponent(relativePath)}`;
export const skillDocumentPath = (relativePath: string) => `/skills?path=${encodeURIComponent(relativePath)}`;
export const automationLoopPath = (id?: string) => {
  if (!id) return "/automation/loops";
  const params = new URLSearchParams({ id });
  return `/automation/loops?${params.toString()}`;
};
export const automationAllLoopsPath = () => "/automation/loops?view=all";
export const runtimePath = (id?: string) => `/runtimes${id ? `?id=${encodeURIComponent(id)}` : ""}`;
export const runOverviewPath = (rootRunId?: string) => `/run${rootRunId ? `?run=${encodeURIComponent(rootRunId)}` : ""}`;
export const runLoopPath = (loopId: string, rootRunId?: string) =>
  `/run/loops/${encodeURIComponent(loopId)}${rootRunId ? `?run=${encodeURIComponent(rootRunId)}` : ""}`;
export const runAgentPath = (agentId: string, rootRunId?: string) =>
  `/run/agents/${encodeURIComponent(agentId)}${rootRunId ? `?run=${encodeURIComponent(rootRunId)}` : ""}`;

export const balletModeFromRoute = (route: RouteState): BalletMode => route.view === "run" ? "run" : "configure";
