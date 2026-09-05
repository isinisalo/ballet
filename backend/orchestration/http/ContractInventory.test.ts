import { describe, expect, test } from "vitest";
import {
  OrchestrationProhibitedRoutes, OrchestrationRouteInventory
} from "../../../shared/orchestration/routeInventory.js";
import type { ApiController } from "./ApiController.js";
import { createOrchestrationRouter } from "./createOrchestrationRouter.js";

describe("orchestration API contract inventory", () => {
  test("contains only whole-Environment Run creation and keeps continuation source server-owned", () => {
    expect(OrchestrationRouteInventory).toContain("POST /api/environment-runs");
    expect(OrchestrationRouteInventory.some((route) => /states\/[^/]+\/runs|actions\/[^/]+\/runs/.test(route))).toBe(false);
    expect(OrchestrationRouteInventory.some((route) => /environment-runs.*source/.test(route))).toBe(false);
    expect(OrchestrationProhibitedRoutes).toHaveLength(3);
  });

  test("matches the mounted Express router exactly and contains no duplicate contract route", () => {
    const controller = new Proxy({} as ApiController, { get: () => () => undefined });
    const router = createOrchestrationRouter({ controller, actor: () => ({ id: "test", source: "request_context" }) });
    const stack = Reflect.get(router as object, "stack") as Array<{
      route?: { path: string; methods: Record<string, boolean> };
    }>;
    const actual = stack.flatMap(({ route }) => route ? Object.entries(route.methods)
      .filter(([, enabled]) => enabled)
      .map(([method]) => `${method.toUpperCase()} /api${route.path}`) : []);
    expect([...actual].sort()).toEqual([...OrchestrationRouteInventory].sort());
    expect(new Set(OrchestrationRouteInventory).size).toBe(OrchestrationRouteInventory.length);
  });
});
