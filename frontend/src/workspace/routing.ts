import type { BalletMode } from "@shared/api/workspace-contracts";
import type { EngineeringSection, ProjectDocumentCreateKind, RouteState } from "./types";

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
  if (url.pathname === "/automation/graph") return {
    view: "automation", engineeringLevel: "graph",
    engineeringSection: url.searchParams.get("section") === "decision-model" ? "decision-model" : "capabilities"
  };
  const action = url.pathname.match(/^\/automation\/graph\/nodes\/([^/]+)\/actions\/([^/]+)\/?$/);
  if (action) return {
    view: "automation",
    engineeringLevel: "action_node",
    graphNodeId: decodeURIComponent(action[1]),
    actionNodeId: decodeURIComponent(action[2])
  };
  const graphNode = url.pathname.match(/^\/automation\/graph\/nodes\/([^/]+)\/?$/);
  if (graphNode) return {
    view: "automation",
    engineeringLevel: "graph_node",
    graphNodeId: decodeURIComponent(graphNode[1]),
    engineeringSection: url.searchParams.get("section") === "decision-model" ? "decision-model" : "actions"
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

const matchId = (value: RegExpMatchArray | null, index = 1) => value ? decodeURIComponent(value[index]) : undefined;

const vNextRoute = (url: URL): RouteState | undefined => {
  const exact: Record<string, NonNullable<RouteState["vNextView"]>> = {
    "/vnext/configure/direction": "direction",
    "/vnext/configure/use-cases": "use-cases",
    "/vnext/configure/environment": "environment",
    "/vnext/configure/resources/instructions": "instructions",
    "/vnext/configure/resources/skills": "skills",
    "/vnext/configure/execution-profiles": "execution-profiles",
    "/vnext/configure/critic": "critic",
    "/vnext/run": "run-list",
    "/vnext/feedback": "feedback-list",
    "/vnext/reviews/critic": "critic-reviews",
    "/vnext/reviews/refinement": "refinement-reviews",
    "/vnext/products": "products"
  };
  if (exact[url.pathname]) return { view: "vnext", vNextView: exact[url.pathname], entityId: url.searchParams.get("id") ?? undefined };
  const patterns: Array<[RegExp, NonNullable<RouteState["vNextView"]>]> = [
    [/^\/vnext\/configure\/environment\/states\/([^/]+)\/actions\/([^/]+)\/?$/, "action"],
    [/^\/vnext\/configure\/environment\/states\/([^/]+)\/?$/, "state"],
    [/^\/vnext\/run\/([^/]+)\/states\/([^/]+)\/actions\/([^/]+)\/?$/, "run-action"],
    [/^\/vnext\/run\/([^/]+)\/states\/([^/]+)\/?$/, "run-state"],
    [/^\/vnext\/run\/([^/]+)\/?$/, "run-detail"],
    [/^\/vnext\/feedback\/([^/]+)\/?$/, "feedback-detail"],
    [/^\/vnext\/reviews\/critic\/([^/]+)\/?$/, "critic-proposal"],
    [/^\/vnext\/reviews\/refinement\/([^/]+)\/?$/, "refinement-proposal"],
    [/^\/vnext\/products\/([^/]+)\/?$/, "product-detail"]
  ];
  for (const [pattern, view] of patterns) {
    const match = url.pathname.match(pattern);
    if (!match) continue;
    if (view === "action") return { view: "vnext", vNextView: view, stateId: matchId(match), actionId: matchId(match, 2) };
    if (view === "run-action") return { view: "vnext", vNextView: view, entityId: matchId(match), stateId: matchId(match, 2), actionId: matchId(match, 3) };
    if (view === "run-state") return { view: "vnext", vNextView: view, entityId: matchId(match), stateId: matchId(match, 2) };
    return { view: "vnext", vNextView: view, [view === "state" ? "stateId" : "entityId"]: matchId(match) };
  }
  return url.pathname.startsWith("/vnext/") ? { view: "vnext", vNextView: "invalid" } : undefined;
};

export const routeFromPath = (path: string): RouteState => {
  const url = new URL(path, "http://localhost");
  const next = vNextRoute(url);
  if (next) return next;
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
const sectionQuery = (section?: EngineeringSection) => section ? `?section=${encodeURIComponent(section)}` : "";
export const automationGraphPath = (section?: "capabilities" | "decision-model") => `/automation/graph${sectionQuery(section)}`;
export const automationGraphNodePath = (graphNodeId: string, section?: "actions" | "decision-model") =>
  `/automation/graph/nodes/${encodeURIComponent(graphNodeId)}${sectionQuery(section)}`;
export const automationActionNodePath = (graphNodeId: string, actionNodeId: string) =>
  `${automationGraphNodePath(graphNodeId)}/actions/${encodeURIComponent(actionNodeId)}`;
export const automationThemePath = () => "/automation/theme";
export const runtimePath = () => "/runtimes";
export const runOverviewPath = (rootRunId?: string) => `/run${rootRunId ? `?run=${encodeURIComponent(rootRunId)}` : ""}`;
export const runGraphNodePath = (graphNodeId: string, rootRunId?: string) =>
  `/run/graph-nodes/${encodeURIComponent(graphNodeId)}${rootRunId ? `?run=${encodeURIComponent(rootRunId)}` : ""}`;
export const runGraphPath = (graphId: string, rootRunId?: string) =>
  `/run/graphs/${encodeURIComponent(graphId)}${rootRunId ? `?run=${encodeURIComponent(rootRunId)}` : ""}`;
export const balletModeFromRoute = (route: RouteState): BalletMode => route.view === "run" ? "run" : "configure";

export const vNextEntityPath = (base: string, id?: string) => `${base}${id ? `?id=${encodeURIComponent(id)}` : ""}`;
export const vNextStatePath = (stateId: string) => `/vnext/configure/environment/states/${encodeURIComponent(stateId)}`;
export const vNextActionPath = (stateId: string, actionId: string) => `${vNextStatePath(stateId)}/actions/${encodeURIComponent(actionId)}`;
export const vNextRunPath = (runId?: string) => runId ? `/vnext/run/${encodeURIComponent(runId)}` : "/vnext/run";
