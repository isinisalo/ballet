import type { AutomationTab, ProjectDocumentCreateKind, RouteState } from "./types";

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

const automationRoute = (automationTab: AutomationTab, url: URL): RouteState => ({
  view: "automation",
  automationTab,
  ...(automationTab === "loops" && url.searchParams.get("view") === "all"
    ? { automationLoopView: "all" as const }
    : { automationEntityId: url.searchParams.get("id") ?? undefined })
});

const runtimeRoute = (url: URL): RouteState => ({
  view: "runtimes",
  runtimeId: url.searchParams.get("id") ?? undefined
});

const legacyRouteAliases: Record<string, (url: URL) => RouteState> = {
  // Compatibility aliases for routes used before the automation/runtimes navigation split.
  "/automation/policies": (url) => automationRoute("loops", url),
  "/policies": (url) => automationRoute("loops", url),
  "/actions": (url) => automationRoute("actions", url),
  "/automation/runtimes": runtimeRoute,
  "/agent-runs": (url) => automationRoute("loops", url)
};

export const routeFromPath = (path: string): RouteState => {
  const url = new URL(path, "http://localhost");
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
  const automationMatch = url.pathname.match(/^\/automation\/(actions|loops)\/?$/);
  if (automationMatch) return automationRoute(automationMatch[1] as AutomationTab, url);
  if (url.pathname === "/automation") return automationRoute("loops", url);
  if (url.pathname === "/runtimes") return runtimeRoute(url);
  if (url.pathname === "/skills") return { view: "skills", documentPath: url.searchParams.get("path") ?? undefined };
  const legacyRoute = legacyRouteAliases[url.pathname];
  if (legacyRoute) return legacyRoute(url);
  return { view: "projects" };
};

export const projectDocumentPath = (relativePath: string) => `/projects/document?path=${encodeURIComponent(relativePath)}`;
export const projectCollectionDocumentPath = (projectId: string, kind: ProjectDocumentCreateKind, relativePath?: string) =>
  `/projects/${encodeURIComponent(projectId)}/${projectDocumentCollectionSegment[kind]}${relativePath ? `?path=${encodeURIComponent(relativePath)}` : ""}`;
export const agentDocumentPath = (relativePath: string) => `/agents?path=${encodeURIComponent(relativePath)}`;
export const skillDocumentPath = (relativePath: string) => `/skills?path=${encodeURIComponent(relativePath)}`;
export const automationSectionPath = (tab: AutomationTab, id?: string) => `/automation/${tab}${id ? `?id=${encodeURIComponent(id)}` : ""}`;
export const automationAllLoopsPath = () => "/automation/loops?view=all";
export const runtimePath = (id?: string) => `/runtimes${id ? `?id=${encodeURIComponent(id)}` : ""}`;
