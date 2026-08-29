import { describe, expect, test } from "vitest";
import {
  VNextProhibitedRoutes, VNextRouteInventory, VNextSchemaInventory
} from "../../../shared/vnext/routeInventory.js";
import type { VNextApiController } from "./VNextApiController.js";
import { createVNextRouter } from "./createVNextRouter.js";

describe("vNext API contract inventory", () => {
  test("contains only whole-Environment Run creation and keeps continuation source server-owned", () => {
    expect(VNextRouteInventory).toContain("POST /api/vnext/environment-runs");
    expect(VNextRouteInventory.some((route) => /states\/[^/]+\/runs|actions\/[^/]+\/runs/.test(route))).toBe(false);
    expect(VNextRouteInventory.some((route) => /environment-runs.*source/.test(route))).toBe(false);
    expect(VNextProhibitedRoutes).toHaveLength(4);
  });

  test("pins every strict contract version at the HTTP composition boundary", () => {
    expect(VNextSchemaInventory).toEqual({
      projectConfig: 20, rootSnapshot: 13, taskEnvelope: 10, roleOutcome: 10,
      promptComposition: 11, executionSpec: 12, sqlite: 16,
      feedback: 1, critic: 1, refinement: 1
    });
  });

  test("matches the mounted Express router exactly and contains no duplicate contract route", () => {
    const controller = new Proxy({} as VNextApiController, { get: () => () => undefined });
    const router = createVNextRouter({ controller, actor: () => ({ id: "test", source: "request_context" }) });
    const stack = Reflect.get(router as object, "stack") as Array<{
      route?: { path: string; methods: Record<string, boolean> };
    }>;
    const actual = stack.flatMap(({ route }) => route ? Object.entries(route.methods)
      .filter(([, enabled]) => enabled)
      .map(([method]) => `${method.toUpperCase()} /api/vnext${route.path}`) : []);
    expect([...actual].sort()).toEqual([...VNextRouteInventory].sort());
    expect(new Set(VNextRouteInventory).size).toBe(VNextRouteInventory.length);
  });
});
