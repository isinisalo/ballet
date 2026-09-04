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
    const workspaceView = exact[url.pathname];
    return { view: "orchestration", workspaceView, entityId: url.searchParams.get("id") ?? undefined,
      createMode: workspaceView === "environment" && url.searchParams.get("create") === "state" ? "state" : undefined };
  }

  const patterns: Array<[RegExp, WorkspaceView]> = [
    [/^\/agents\/([^/]+)\/?$/, "agents"],
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
    if (workspaceView === "action") {
      const stateId = decode(match, 1); const actionId = decode(match, 2);
      const agent = url.searchParams.get("agent");
      return stateId && actionId
        ? { view: "orchestration", workspaceView, stateId, actionId,
          agentRole: agent === "validation" || agent === "work" ? agent : agent ? "invalid" : undefined }
        : { view: "orchestration", workspaceView: "invalid" };
    }
    if (workspaceView === "run-action") { const entityId = decode(match, 1); const stateId = decode(match, 2); const actionId = decode(match, 3); return entityId && stateId && actionId ? { view: "orchestration", workspaceView, entityId, stateId, actionId } : { view: "orchestration", workspaceView: "invalid" }; }
    if (workspaceView === "run-state") { const entityId = decode(match, 1); const stateId = decode(match, 2); return entityId && stateId ? { view: "orchestration", workspaceView, entityId, stateId } : { view: "orchestration", workspaceView: "invalid" }; }
    const id = decode(match, 1);
    if (!id) return { view: "orchestration", workspaceView: "invalid" };
    return workspaceView === "state"
      ? { view: "orchestration", workspaceView, stateId: id,
        createMode: url.searchParams.get("create") === "action" ? "action" : undefined }
      : { view: "orchestration", workspaceView, entityId: id };
  }
  return { view: "orchestration", workspaceView: "invalid" };
};

export const orchestrationEntityPath = (base: string, id?: string) => id && base === "/agents"
  ? `/agents/${encodeURIComponent(id)}`
  : `${base}${id ? `?id=${encodeURIComponent(id)}` : ""}`;
export const orchestrationStatePath = (stateId: string) => `/automation/loops/states/${encodeURIComponent(stateId)}`;
export const orchestrationActionPath = (stateId: string, actionId: string) => `${orchestrationStatePath(stateId)}/actions/${encodeURIComponent(actionId)}`;
export const orchestrationActionAgentPath = (stateId: string, actionId: string, role: "validation" | "work") => `${orchestrationActionPath(stateId, actionId)}?agent=${role}`;
export const orchestrationCreateStatePath = () => "/automation/loops?create=state";
export const orchestrationCreateActionPath = (stateId: string) => `${orchestrationStatePath(stateId)}?create=action`;
export const orchestrationRunPath = (runId?: string) => runId ? `/run/${encodeURIComponent(runId)}` : "/run";
