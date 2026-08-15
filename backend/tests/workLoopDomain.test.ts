import { describe, expect, it } from "vitest";
import {
  getProjectLoopEdges,
  getProjectNodeEdges,
  getReachableProjectLoopIds,
  getReachableProjectNodeIds,
  isAllowedProjectRepairRoute,
  isProjectAgentValidationNode,
  isProjectHumanValidationNode,
  isProjectHumanWorkNode,
  isProjectNodeTerminalTarget,
  isProjectProviderWorkNode,
  isProjectScheduledWorkNode,
  resolveProjectLoopStartNode
} from "../../shared/domain/automation.js";
import { testAutomationConfig, testLoop, testWorkLoopNode } from "./v10TestConfig.js";

describe("strict-v10 Work Loop domain helpers", () => {
  it("resolves start nodes, node edges, and explicit terminal targets", () => {
    const loop = testLoop();
    expect(resolveProjectLoopStartNode(loop)?.id).toBe("work");
    expect(getProjectNodeEdges(loop, "work")).toEqual(loop.edges);
    expect(isProjectNodeTerminalTarget(loop.edges[0]!.target)).toBe(true);
    expect(getReachableProjectNodeIds(loop)).toEqual(new Set(["work"]));
  });

  it("narrows Work and Validation Node variants without Step aliases", () => {
    const node = testWorkLoopNode("scheduled", {
      scheduled: { kind: "once", date: "2026-08-16", time: "09:00", timeZone: "UTC" },
      validation: "agent"
    });
    expect(isProjectProviderWorkNode(node.work)).toBe(true);
    expect(isProjectScheduledWorkNode(node.work)).toBe(true);
    expect(isProjectHumanWorkNode(node.work)).toBe(false);
    expect(isProjectAgentValidationNode(node.validation)).toBe(true);
    expect(isProjectHumanValidationNode(node.validation)).toBe(false);
  });

  it("uses repair Loop Edges as the orchestrator route allowlist, including self-routes", () => {
    const config = testAutomationConfig();
    config.loopEdges = [
      { id: "self-repair", source: "main-loop", target: "main-loop", kind: "repair", description: "Retry via orchestrator." },
      { id: "self-flow", source: "main-loop", target: "main-loop", kind: "flow", description: "Repeat normal flow." }
    ];
    expect(getProjectLoopEdges(config, "main-loop", "repair")).toHaveLength(1);
    expect(isAllowedProjectRepairRoute(config, "main-loop", "self-repair")).toBe(true);
    expect(isAllowedProjectRepairRoute(config, "main-loop", "self-flow")).toBe(false);
    expect(getReachableProjectLoopIds(config, "main-loop", config.orchestrator.maxRepairDepth))
      .toEqual(new Set(["main-loop"]));
  });
});
