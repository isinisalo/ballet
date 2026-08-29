import type { RouteState, WorkspaceView } from "./types";

const decode = (match: RegExpMatchArray, index: number): string | undefined => {
  try { return decodeURIComponent(match[index]); } catch { return undefined; }
};

export const routeFromPath = (path: string): RouteState => {
  const url = new URL(path, "http://localhost");
  const exact: Record<string, WorkspaceView> = {
    "/": "direction",
    "/configure/direction": "direction",
    "/configure/use-cases": "use-cases",
    "/configure/environment": "environment",
    "/configure/resources/instructions": "instructions",
    "/configure/resources/skills": "skills",
    "/configure/execution-profiles": "execution-profiles",
    "/configure/critic": "critic",
    "/run": "run-list",
    "/feedback": "feedback-list",
    "/reviews/critic": "critic-reviews",
    "/reviews/refinement": "refinement-reviews",
    "/products": "products"
  };
  if (exact[url.pathname]) {
    return { view: "orchestration", workspaceView: exact[url.pathname], entityId: url.searchParams.get("id") ?? undefined };
  }

  const patterns: Array<[RegExp, WorkspaceView]> = [
    [/^\/configure\/environment\/states\/([^/]+)\/actions\/([^/]+)\/?$/, "action"],
    [/^\/configure\/environment\/states\/([^/]+)\/?$/, "state"],
    [/^\/run\/([^/]+)\/states\/([^/]+)\/actions\/([^/]+)\/?$/, "run-action"],
    [/^\/run\/([^/]+)\/states\/([^/]+)\/?$/, "run-state"],
    [/^\/run\/([^/]+)\/?$/, "run-detail"],
    [/^\/feedback\/([^/]+)\/?$/, "feedback-detail"],
    [/^\/reviews\/critic\/([^/]+)\/?$/, "critic-proposal"],
    [/^\/reviews\/refinement\/([^/]+)\/?$/, "refinement-proposal"],
    [/^\/products\/([^/]+)\/?$/, "product-detail"]
  ];
  for (const [pattern, workspaceView] of patterns) {
    const match = url.pathname.match(pattern);
    if (!match) continue;
    if (workspaceView === "action") { const stateId = decode(match, 1); const actionId = decode(match, 2); return stateId && actionId ? { view: "orchestration", workspaceView, stateId, actionId } : { view: "orchestration", workspaceView: "invalid" }; }
    if (workspaceView === "run-action") { const entityId = decode(match, 1); const stateId = decode(match, 2); const actionId = decode(match, 3); return entityId && stateId && actionId ? { view: "orchestration", workspaceView, entityId, stateId, actionId } : { view: "orchestration", workspaceView: "invalid" }; }
    if (workspaceView === "run-state") { const entityId = decode(match, 1); const stateId = decode(match, 2); return entityId && stateId ? { view: "orchestration", workspaceView, entityId, stateId } : { view: "orchestration", workspaceView: "invalid" }; }
    const id = decode(match, 1);
    if (!id) return { view: "orchestration", workspaceView: "invalid" };
    return workspaceView === "state"
      ? { view: "orchestration", workspaceView, stateId: id }
      : { view: "orchestration", workspaceView, entityId: id };
  }
  return { view: "orchestration", workspaceView: "invalid" };
};

export const orchestrationEntityPath = (base: string, id?: string) => `${base}${id ? `?id=${encodeURIComponent(id)}` : ""}`;
export const orchestrationStatePath = (stateId: string) => `/configure/environment/states/${encodeURIComponent(stateId)}`;
export const orchestrationActionPath = (stateId: string, actionId: string) => `${orchestrationStatePath(stateId)}/actions/${encodeURIComponent(actionId)}`;
export const orchestrationRunPath = (runId?: string) => runId ? `/run/${encodeURIComponent(runId)}` : "/run";
