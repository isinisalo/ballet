import { describe, expect, it } from "vitest";
import { routeFromPath, orchestrationActionPath, orchestrationRunPath, orchestrationStatePath } from "../src/workspace/routing";

describe("orchestration URL-owned routing", () => {
  it.each([
    ["/configure/direction", "direction"], ["/configure/use-cases?id=UC-1", "use-cases"],
    ["/configure/environment", "environment"], ["/configure/resources/instructions", "instructions"],
    ["/configure/resources/skills", "skills"], ["/configure/execution-profiles", "execution-profiles"],
    ["/configure/critic", "critic"]
  ])("parses %s", (path, view) => expect(routeFromPath(path)).toMatchObject({ view: "orchestration", workspaceView: view }));
  it("roundtrips encoded State and Action IDs", () => expect(routeFromPath(orchestrationActionPath("state a", "action/b"))).toMatchObject({ stateId: "state a", actionId: "action/b" }));
  it("builds deep links without aliases", () => { expect(orchestrationStatePath("state-1")).toBe("/configure/environment/states/state-1"); expect(orchestrationRunPath("run-1")).toBe("/run/run-1"); });
  it("projects unknown orchestration paths as invalid", () => expect(routeFromPath("/not-real")).toMatchObject({ view: "orchestration", workspaceView: "invalid" }));
  it.each([
    ["/run", "run-list"], ["/run/run%201", "run-detail"],
    ["/run/run-1/states/state%201", "run-state"], ["/run/run-1/states/state-1/actions/action%2F1", "run-action"],
    ["/feedback", "feedback-list"], ["/feedback/feedback-1", "feedback-detail"],
    ["/reviews/critic", "critic-reviews"], ["/reviews/critic/critic-1", "critic-proposal"],
    ["/reviews/refinement", "refinement-reviews"], ["/reviews/refinement/refine-1", "refinement-proposal"],
    ["/products", "products"], ["/products/product-1", "product-detail"]
  ])("parses governance route %s as %s", (path, view) => expect(routeFromPath(path)).toMatchObject({ view: "orchestration", workspaceView: view }));
});
