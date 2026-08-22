import type { BalletMode } from "@shared/api/workspace-contracts";
import type { ProjectDocumentCreateKind, RouteState } from "./types";

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

const automationRoute = (url: URL): RouteState | undefined => {
  if (url.pathname === "/automation/graph") return { view: "automation", engineeringLevel: "graph" };
  const job = url.pathname.match(/^\/automation\/graph\/nodes\/([^/]+)\/jobs\/([^/]+)\/?$/);
  if (job) return {
    view: "automation",
    engineeringLevel: "job_node",
    graphNodeId: decodeURIComponent(job[1]),
    jobNodeId: decodeURIComponent(job[2])
  };
  const graphNode = url.pathname.match(/^\/automation\/graph\/nodes\/([^/]+)\/?$/);
  if (graphNode) return {
    view: "automation",
    engineeringLevel: "graph_node",
    graphNodeId: decodeURIComponent(graphNode[1])
  };
  return undefined;
};

const topLevelWorkspaceRoute = (url: URL): RouteState | undefined => {
  if (url.pathname === "/execution-profiles") return {
    view: "execution-profiles",
    executionProfileId: url.searchParams.get("id") ?? undefined,
    creating: isCreatingFromSearch(url) || undefined
  };
  if (url.pathname === "/automation/theme") return { view: "canvas-theme" };
  const automation = automationRoute(url);
  if (automation) return automation;
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

  const runGraphNodeMatch = url.pathname.match(/^\/run\/graph-nodes\/([^/]+)\/?$/);
  if (runGraphNodeMatch) return {
    view: "run",
    runTargetKind: "graph_node",
    runTargetId: decodeURIComponent(runGraphNodeMatch[1]),
    rootRunId: url.searchParams.get("run") ?? undefined
  };

  const runGraphMatch = url.pathname.match(/^\/run\/graphs\/([^/]+)\/?$/);
  if (runGraphMatch) return {
    view: "run",
    runTargetKind: "graph",
    runTargetId: decodeURIComponent(runGraphMatch[1]),
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
export const automationGraphPath = () => "/automation/graph";
export const automationGraphNodePath = (graphNodeId: string) =>
  `/automation/graph/nodes/${encodeURIComponent(graphNodeId)}`;
export const automationJobNodePath = (graphNodeId: string, jobNodeId: string) =>
  `${automationGraphNodePath(graphNodeId)}/jobs/${encodeURIComponent(jobNodeId)}`;
export const automationThemePath = () => "/automation/theme";
export const runtimePath = () => "/runtimes";
export const runOverviewPath = (rootRunId?: string) => `/run${rootRunId ? `?run=${encodeURIComponent(rootRunId)}` : ""}`;
export const runGraphNodePath = (graphNodeId: string, rootRunId?: string) =>
  `/run/graph-nodes/${encodeURIComponent(graphNodeId)}${rootRunId ? `?run=${encodeURIComponent(rootRunId)}` : ""}`;
export const runGraphPath = (graphId: string, rootRunId?: string) =>
  `/run/graphs/${encodeURIComponent(graphId)}${rootRunId ? `?run=${encodeURIComponent(rootRunId)}` : ""}`;
export const balletModeFromRoute = (route: RouteState): BalletMode => route.view === "run" ? "run" : "configure";
