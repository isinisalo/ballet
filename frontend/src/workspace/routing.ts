import type { AutomationTab, RouteState } from "./types";

export const routeFromPath = (path: string): RouteState => {
  const url = new URL(path, "http://localhost");
  const goalsMatch = url.pathname.match(/^\/projects\/([^/]+)\/goals\/?$/);
  if (goalsMatch) return { view: "project-goals", projectId: decodeURIComponent(goalsMatch[1]) };

  const adrsMatch = url.pathname.match(/^\/projects\/([^/]+)\/adrs\/?$/);
  if (adrsMatch) return { view: "project-adrs", projectId: decodeURIComponent(adrsMatch[1]) };

  const instructionsMatch = url.pathname.match(/^\/projects\/([^/]+)\/instructions\/?$/);
  if (instructionsMatch) return { view: "project-instructions", projectId: decodeURIComponent(instructionsMatch[1]) };

  if (url.pathname === "/projects/document") {
    const documentPath = url.searchParams.get("path") ?? undefined;
    return documentPath ? { view: "project-document", documentPath } : { view: "projects" };
  }

  if (url.pathname === "/agents") return { view: "agents", documentPath: url.searchParams.get("path") ?? undefined };
  if (url.pathname === "/automation/policies" || url.pathname === "/policies") {
    return { view: "automation", automationTab: "workflows", automationEntityId: url.searchParams.get("id") ?? undefined };
  }
  const automationMatch = url.pathname.match(/^\/automation\/(triggers|actions|workflows)\/?$/);
  if (automationMatch) {
    return { view: "automation", automationTab: automationMatch[1] as AutomationTab, automationEntityId: url.searchParams.get("id") ?? undefined };
  }
  if (url.pathname === "/automation/runtimes") return { view: "runtimes", runtimeId: url.searchParams.get("id") ?? undefined };
  if (url.pathname === "/automation") return { view: "automation", automationTab: "workflows", automationEntityId: url.searchParams.get("id") ?? undefined };
  if (url.pathname === "/actions") return { view: "automation", automationTab: "actions", automationEntityId: url.searchParams.get("id") ?? undefined };
  if (url.pathname === "/workflow") return { view: "automation", automationTab: "workflows", automationEntityId: url.searchParams.get("id") ?? undefined };
  if (url.pathname === "/runtimes") return { view: "runtimes", runtimeId: url.searchParams.get("id") ?? undefined };
  if (url.pathname === "/skills") return { view: "skills", documentPath: url.searchParams.get("path") ?? undefined };
  if (url.pathname === "/agent-runs") return { view: "automation", automationTab: "workflows", automationEntityId: url.searchParams.get("id") ?? undefined };
  return { view: "projects" };
};

export const projectDocumentPath = (relativePath: string) => `/projects/document?path=${encodeURIComponent(relativePath)}`;
export const agentDocumentPath = (relativePath: string) => `/agents?path=${encodeURIComponent(relativePath)}`;
export const skillDocumentPath = (relativePath: string) => `/skills?path=${encodeURIComponent(relativePath)}`;
export const automationSectionPath = (tab: AutomationTab, id?: string) => `/automation/${tab}${id ? `?id=${encodeURIComponent(id)}` : ""}`;
export const runtimePath = (id?: string) => `/runtimes${id ? `?id=${encodeURIComponent(id)}` : ""}`;
