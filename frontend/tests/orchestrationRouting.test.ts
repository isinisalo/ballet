import { describe, expect, it } from "vitest";
import { routeFromPath, orchestrationActionFlowPath, orchestrationActionPath, orchestrationEntityPath, orchestrationRunPath, orchestrationStatePath } from "../src/workspace/routing";

describe("orchestration URL-owned routing", () => {
  it.each([
    ["/project/goals", "goals"], ["/project/adrs", "adrs"],
    ["/project/constraints", "constraints"], ["/project/use-cases?id=UC-1", "use-cases"],
    ["/automation/loops", "environment"], ["/project/instructions", "instructions"],
    ["/skills", "skills"], ["/agents", "agents"], ["/runtimes", "runtimes"],
    ["/reviews/critic", "critic-reviews"]
  ])("parses %s", (path, view) => expect(routeFromPath(path)).toMatchObject({ view: "orchestration", workspaceView: view }));
  it("roundtrips encoded State and Action IDs", () => expect(routeFromPath(orchestrationActionPath("state a", "action/b"))).toMatchObject({ stateId: "state a", actionId: "action/b" }));
  it("roundtrips the URL-owned Action flow canvas", () => {
    const path = orchestrationActionFlowPath("state a", "action/b");
    expect(path).toBe("/automation/loops/states/state%20a/actions/action%2Fb?canvas=flow");
    expect(routeFromPath(path)).toMatchObject({ workspaceView: "action", stateId: "state a", actionId: "action/b", canvasMode: "flow" });
    expect(routeFromPath(`${orchestrationActionPath("state a", "action/b")}?canvas=unknown`).canvasMode).toBeUndefined();
  });
  it("builds deep links without aliases", () => { expect(orchestrationStatePath("state-1")).toBe("/automation/loops/states/state-1"); expect(orchestrationRunPath("run-1")).toBe("/run/run-1"); });
  it("uses a canonical path segment for fixed Agents", () => {
    const path = orchestrationEntityPath("/agents", "ballet-critic-agent");
    expect(path).toBe("/agents/ballet-critic-agent");
    expect(routeFromPath(path)).toMatchObject({ workspaceView: "agents", entityId: "ballet-critic-agent" });
  });
  it("projects unknown orchestration paths as invalid", () => expect(routeFromPath("/not-real")).toMatchObject({ view: "orchestration", workspaceView: "invalid" }));
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
