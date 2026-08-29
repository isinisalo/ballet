import { describe, expect, it } from "vitest";
import { routeFromPath, vNextActionPath, vNextRunPath, vNextStatePath } from "../src/workspace/routing";

describe("vNext URL-owned routing", () => {
  it.each([
    ["/vnext/configure/direction", "direction"], ["/vnext/configure/use-cases?id=UC-1", "use-cases"],
    ["/vnext/configure/environment", "environment"], ["/vnext/configure/resources/instructions", "instructions"],
    ["/vnext/configure/resources/skills", "skills"], ["/vnext/configure/execution-profiles", "execution-profiles"],
    ["/vnext/configure/critic", "critic"]
  ])("parses %s", (path, view) => expect(routeFromPath(path)).toMatchObject({ view: "vnext", vNextView: view }));
  it("roundtrips encoded State and Action IDs", () => expect(routeFromPath(vNextActionPath("state a", "action/b"))).toMatchObject({ stateId: "state a", actionId: "action/b" }));
  it("builds deep links without aliases", () => { expect(vNextStatePath("state-1")).toBe("/vnext/configure/environment/states/state-1"); expect(vNextRunPath("run-1")).toBe("/vnext/run/run-1"); });
  it("projects unknown vNext paths as invalid", () => expect(routeFromPath("/vnext/not-real")).toMatchObject({ view: "vnext", vNextView: "invalid" }));
  it.each([
    ["/vnext/run", "run-list"], ["/vnext/run/run%201", "run-detail"],
    ["/vnext/run/run-1/states/state%201", "run-state"], ["/vnext/run/run-1/states/state-1/actions/action%2F1", "run-action"],
    ["/vnext/feedback", "feedback-list"], ["/vnext/feedback/feedback-1", "feedback-detail"],
    ["/vnext/reviews/critic", "critic-reviews"], ["/vnext/reviews/critic/critic-1", "critic-proposal"],
    ["/vnext/reviews/refinement", "refinement-reviews"], ["/vnext/reviews/refinement/refine-1", "refinement-proposal"],
    ["/vnext/products", "products"], ["/vnext/products/product-1", "product-detail"]
  ])("parses governance route %s as %s", (path, view) => expect(routeFromPath(path)).toMatchObject({ view: "vnext", vNextView: view }));
});
