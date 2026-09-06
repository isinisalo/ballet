import { describe, expect, it } from "vitest";
import { routeFromPath, orchestrationActionAgentPath, orchestrationActionPath, orchestrationCreateActionPath, orchestrationCreateStatePath, orchestrationEntityPath, orchestrationRunPath, orchestrationStatePath } from "../src/workspace/routing";

describe("orchestration URL-owned routing", () => {
  it.each([
    ["/project/overview", "overview"], ["/project/adrs", "adrs"],
    ["/project/constraints", "invalid"], ["/project/use-cases?id=UC-1", "invalid"], ["/project/goals", "invalid"],
    ["/automation/loops", "environment"], ["/project/instructions", "instructions"],
    ["/skills", "skills"], ["/agents", "agents"], ["/runtimes", "runtimes"],
    ["/reviews/critic", "critic-reviews"]
  ])("parses %s", (path, view) => expect(routeFromPath(path)).toMatchObject({ view: "orchestration", workspaceView: view }));
  it("roundtrips encoded State and Action IDs", () => expect(routeFromPath(orchestrationActionPath("state a", "action/b"))).toMatchObject({ stateId: "state a", actionId: "action/b" }));
  it("roundtrips URL-owned Action Agent selection and create panels", () => {
    expect(orchestrationCreateStatePath()).toBe("/automation/loops?create=state");
    expect(routeFromPath(orchestrationCreateStatePath())).toMatchObject({ workspaceView: "environment", createMode: "state" });
    expect(orchestrationCreateActionPath("state-1")).toBe("/automation/loops/states/state-1?create=action");
    expect(routeFromPath(orchestrationCreateActionPath("state-1"))).toMatchObject({ workspaceView: "state", stateId: "state-1", createMode: "action" });
    expect(routeFromPath(orchestrationActionAgentPath("state-1", "action-1", "validation"))).toMatchObject({
      workspaceView: "action", stateId: "state-1", actionId: "action-1", agentRole: "validation",
    });
    expect(routeFromPath(orchestrationActionAgentPath("state-1", "action-1", "work"))).toMatchObject({ agentRole: "work" });
    expect(routeFromPath("/automation/loops/states/state-1/actions/action-1?agent=unknown")).toMatchObject({ agentRole: "invalid" });
    expect(routeFromPath("/automation/loops/states/state-1/actions/action-1?canvas=flow").agentRole).toBeUndefined();
  });
  it("builds deep links without aliases", () => { expect(orchestrationStatePath("state-1")).toBe("/automation/loops/states/state-1"); expect(orchestrationRunPath("run-1")).toBe("/run/run-1"); });
  it("uses a canonical path segment for fixed Agents", () => {
    const path = orchestrationEntityPath("/agents", "ballet-critic-agent");
    expect(path).toBe("/agents/ballet-critic-agent");
    expect(routeFromPath(path)).toMatchObject({ workspaceView: "agents", entityId: "ballet-critic-agent" });
  });
  it("projects unknown orchestration paths as invalid", () => expect(routeFromPath("/not-real")).toMatchObject({ view: "orchestration", workspaceView: "invalid" }));
  it("owns User Story list, creation and selection and rejects malformed or ambiguous IDs", () => {
    const id = "00000000-0000-4000-8000-000000000001";
    expect(routeFromPath("/project/user-stories")).toMatchObject({ workspaceView: "user-stories" });
    expect(routeFromPath("/project/user-stories?create=story")).toMatchObject({ workspaceView: "user-stories", createMode: "story" });
    expect(routeFromPath(orchestrationEntityPath("/project/user-stories", id))).toMatchObject({ entityId: id });
    for (const query of ["id=", "id=not-a-uuid", "create=unknown", `id=${id}&create=story`, `id=${id}&id=${id}`]) {
      expect(routeFromPath(`/project/user-stories?${query}`)).toMatchObject({ workspaceView: "invalid", recoveryPath: "/project/user-stories" });
    }
  });
  it.each([
    ["/run", "run-list"], ["/run/run%201", "run-detail"],
    ["/run/run-1/states/state%201", "run-state"], ["/run/run-1/states/state-1/actions/action%2F1", "run-action"],
    ["/feedback", "feedback-list"], ["/feedback/feedback-1", "feedback-detail"],
    ["/reviews/critic", "critic-reviews"], ["/reviews/critic/critic-1", "critic-proposal"],
    ["/reviews/refinement", "refinement-reviews"], ["/reviews/refinement/refine-1", "refinement-proposal"]
  ])("parses governance route %s as %s", (path, view) => expect(routeFromPath(path)).toMatchObject({ view: "orchestration", workspaceView: view }));
  it.each(["/configure", "/products", "/run-evidence"])("rejects removed route %s", (path) =>
    expect(routeFromPath(path)).toMatchObject({ workspaceView: "invalid" }));
});
