import type { BalletMode } from "@shared/api/workspace-contracts";
import type { EngineeringView, ProjectDocumentCreateKind, RouteState } from "./types";

const projectDocumentCollectionSegment: Record<ProjectDocumentCreateKind, string> = {
  adr: "adrs",
  goal: "goals",
  instruction: "instructions"
};

const documentPathFromSearch = (url: URL) => url.searchParams.get("path") ?? undefined;
const isCreatingFromSearch = (url: URL) => url.searchParams.get("new") === "1";

const projectCollectionRoute = (view: "project-adrs" | "project-goals" | "project-instructions", url: URL): RouteState => {
  const documentPath = documentPathFromSearch(url);
  if (documentPath) return { view, documentPath };
  return isCreatingFromSearch(url) ? { view, creating: true } : { view };
};

const documentCollectionRoute = (view: "skills", url: URL): RouteState => {
  const documentPath = documentPathFromSearch(url);
  if (documentPath) return { view, documentPath };
  return isCreatingFromSearch(url) ? { view, creating: true } : { view };
};

const automationRoute = (url: URL): RouteState => {
  const requestedView = url.searchParams.get("view");
  if (requestedView === null && url.searchParams.has("level")) {
    return { view: "automation", automationRouteIssue: "invalid-view" };
  }
  const automationView: EngineeringView | undefined = requestedView === null || requestedView === "graph"
    ? "graph"
    : requestedView === "loop" ? "loop" : undefined;
  if (!automationView) return { view: "automation", automationRouteIssue: "invalid-view" };
  if (automationView === "graph") return url.searchParams.has("id") || url.searchParams.has("new")
    ? { view: "automation", automationView, automationRouteIssue: "non-canonical-graph" }
    : { view: "automation", automationView };
  const automationEntityId = url.searchParams.get("id") ?? undefined;
  const creating = isCreatingFromSearch(url) || undefined;
  return {
    view: "automation",
    automationView,
    automationEntityId,
    creating,
    automationRouteIssue: !automationEntityId && !creating ? "missing-loop-id" : undefined
  };
};

const topLevelWorkspaceRoute = (url: URL): RouteState | undefined => {
  if (url.pathname === "/execution-profiles") return {
    view: "execution-profiles",
    executionProfileId: url.searchParams.get("id") ?? undefined,
    creating: isCreatingFromSearch(url) || undefined
  };
  if (url.pathname === "/automation/theme") return { view: "loop-theme" };
  if (url.pathname === "/automation/loops" || url.pathname === "/automation") return automationRoute(url);
  if (url.pathname === "/runtimes") return { view: "runtimes" };
  if (url.pathname === "/skills") return documentCollectionRoute("skills", url);
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
export const projectCollectionCreatePath = (kind: ProjectDocumentCreateKind) => `/project/${projectDocumentCollectionSegment[kind]}?new=1`;
export const executionProfilePath = (id?: string) => `/execution-profiles${id ? `?id=${encodeURIComponent(id)}` : ""}`;
export const executionProfileCreatePath = () => "/execution-profiles?new=1";
export const skillDocumentPath = (relativePath: string) => `/skills?path=${encodeURIComponent(relativePath)}`;
export const skillCreatePath = () => "/skills?new=1";
export const automationGraphPath = () => "/automation/loops?view=graph";
export const automationLoopPath = (id: string) => {
  const params = new URLSearchParams({ view: "loop", id });
  return `/automation/loops?${params.toString()}`;
};
export const automationCreateLoopPath = () => "/automation/loops?view=loop&new=1";
export const automationThemePath = () => "/automation/theme";
export const runtimePath = () => "/runtimes";
export const runOverviewPath = (rootRunId?: string) => `/run${rootRunId ? `?run=${encodeURIComponent(rootRunId)}` : ""}`;
export const runLoopPath = (loopId: string, rootRunId?: string) =>
  `/run/loops/${encodeURIComponent(loopId)}${rootRunId ? `?run=${encodeURIComponent(rootRunId)}` : ""}`;
export const balletModeFromRoute = (route: RouteState): BalletMode => route.view === "run" ? "run" : "configure";
