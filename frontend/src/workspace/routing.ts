import type { RouteState, WorkspaceView } from "./types";

const decode = (match: RegExpMatchArray, index: number) => decodeURIComponent(match[index]);

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
    if (workspaceView === "action") return { view: "orchestration", workspaceView, stateId: decode(match, 1), actionId: decode(match, 2) };
    if (workspaceView === "run-action") return { view: "orchestration", workspaceView, entityId: decode(match, 1), stateId: decode(match, 2), actionId: decode(match, 3) };
    if (workspaceView === "run-state") return { view: "orchestration", workspaceView, entityId: decode(match, 1), stateId: decode(match, 2) };
    return workspaceView === "state"
      ? { view: "orchestration", workspaceView, stateId: decode(match, 1) }
      : { view: "orchestration", workspaceView, entityId: decode(match, 1) };
  }
  return { view: "orchestration", workspaceView: "invalid" };
};

export const orchestrationEntityPath = (base: string, id?: string) => `${base}${id ? `?id=${encodeURIComponent(id)}` : ""}`;
export const orchestrationStatePath = (stateId: string) => `/configure/environment/states/${encodeURIComponent(stateId)}`;
export const orchestrationActionPath = (stateId: string, actionId: string) => `${orchestrationStatePath(stateId)}/actions/${encodeURIComponent(actionId)}`;
export const orchestrationRunPath = (runId?: string) => runId ? `/run/${encodeURIComponent(runId)}` : "/run";
