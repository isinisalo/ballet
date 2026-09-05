import type { RouteState, WorkspaceView } from "./types";
import { userStoryIdSchema } from "@shared/orchestration/userStories";

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
    "/project/user-stories": "user-stories",
    "/project/instructions": "instructions",
    "/run": "run-list",
    "/feedback": "feedback-list",
    "/reviews/critic": "critic-reviews",
    "/reviews/refinement": "refinement-reviews"
  };
  if (exact[url.pathname]) {
    return exactRoute(exact[url.pathname], url);
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

function exactRoute(workspaceView: WorkspaceView, url: URL): RouteState {
  if (workspaceView === "user-stories") return userStoryRoute(url);
  return { view: "orchestration", workspaceView, entityId: url.searchParams.get("id") ?? undefined,
    createMode: workspaceView === "environment" && url.searchParams.get("create") === "state" ? "state" : undefined };
}

function userStoryRoute(url: URL): RouteState {
  const id = url.searchParams.get("id"); const create = url.searchParams.get("create");
  const invalid = (id !== null && !userStoryIdSchema.safeParse(id).success)
    || (create !== null && create !== "story") || (id !== null && create !== null)
    || url.searchParams.getAll("id").length > 1 || url.searchParams.getAll("create").length > 1;
  if (invalid) return { view: "orchestration", workspaceView: "invalid", recoveryPath: "/project/user-stories" };
  return { view: "orchestration", workspaceView: "user-stories", entityId: id ?? undefined, createMode: create === "story" ? "story" : undefined };
}
export const orchestrationStatePath = (stateId: string) => `/automation/loops/states/${encodeURIComponent(stateId)}`;
export const orchestrationActionPath = (stateId: string, actionId: string) => `${orchestrationStatePath(stateId)}/actions/${encodeURIComponent(actionId)}`;
export const orchestrationActionAgentPath = (stateId: string, actionId: string, role: "validation" | "work") => `${orchestrationActionPath(stateId, actionId)}?agent=${role}`;
export const orchestrationCreateStatePath = () => "/automation/loops?create=state";
export const orchestrationCreateActionPath = (stateId: string) => `${orchestrationStatePath(stateId)}?create=action`;
export const orchestrationRunPath = (runId?: string) => runId ? `/run/${encodeURIComponent(runId)}` : "/run";
