import type { RouteState, WorkspaceView } from "./types";

const decode = (match: RegExpMatchArray, index: number): string | undefined => {
  try { return decodeURIComponent(match[index]); } catch { return undefined; }
};

export const routeFromPath = (path: string): RouteState => {
  const url = new URL(path, "http://localhost");
  const exact: Record<string, WorkspaceView> = {
    "/": "environment",
    "/automation/loops": "environment",
    "/agents": "agents",
    "/skills": "skills",
    "/runtimes": "runtimes",
    "/project/goals": "goals",
    "/project/adrs": "adrs",
    "/project/constraints": "constraints",
    "/project/use-cases": "use-cases",
    "/project/instructions": "instructions",
    "/run": "run-list",
    "/feedback": "feedback-list",
    "/reviews/critic": "critic-reviews",
    "/reviews/refinement": "refinement-reviews"
  };
  if (exact[url.pathname]) {
    return { view: "orchestration", workspaceView: exact[url.pathname], entityId: url.searchParams.get("id") ?? undefined };
  }

  const patterns: Array<[RegExp, WorkspaceView]> = [
    [/^\/automation\/loops\/states\/([^/]+)\/actions\/([^/]+)\/?$/, "action"],
    [/^\/automation\/loops\/states\/([^/]+)\/?$/, "state"],
    [/^\/run\/([^/]+)\/states\/([^/]+)\/actions\/([^/]+)\/?$/, "run-action"],
    [/^\/run\/([^/]+)\/states\/([^/]+)\/?$/, "run-state"],
    [/^\/run\/([^/]+)\/?$/, "run-detail"],
    [/^\/feedback\/([^/]+)\/?$/, "feedback-detail"],
    [/^\/reviews\/critic\/([^/]+)\/?$/, "critic-proposal"],
    [/^\/reviews\/refinement\/([^/]+)\/?$/, "refinement-proposal"]
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
export const orchestrationStatePath = (stateId: string) => `/automation/loops/states/${encodeURIComponent(stateId)}`;
export const orchestrationActionPath = (stateId: string, actionId: string) => `${orchestrationStatePath(stateId)}/actions/${encodeURIComponent(actionId)}`;
export const orchestrationRunPath = (runId?: string) => runId ? `/run/${encodeURIComponent(runId)}` : "/run";
