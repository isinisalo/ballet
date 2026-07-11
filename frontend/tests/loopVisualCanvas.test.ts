import { Position } from "@xyflow/react";
import type { Agent, ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import { describe, expect, it } from "vitest";
import { loopApprovalEdgePath, loopEdgeDisplayLabel, loopReturnEdgePath, loopToLoopStraightEdgePath } from "../src/workspace/automation/loops/LoopSmartEdge";
import { detachedLoopEdgeProps, loopConnectionPointRadius, loopEdgeEndpointGap } from "../src/workspace/automation/loops/loopFloatingEdgeGeometry";
import { loopEdgeDomAttributes } from "../src/workspace/automation/loops/loopEdgeStyle";
import { calculateCompositeLoopCanvasLayout, loopNodeSizes } from "../src/workspace/automation/loops/loopLayout";
import { loopPlanetNodeSizes } from "../src/workspace/automation/loops/loopLayoutConfig";
import { loopSmartEdgeRoutingOptions } from "../src/workspace/automation/loops/loopSmartEdgeRouting";
import { buildLoopVisualProjection } from "../src/workspace/automation/loops/loopVisualProjection";

const config: ProjectAutomationConfig = {
  version: 3,
  loops: [{
    id: "brief",
    start: "create",
    steps: [{
      id: "create",
      type: "agent",
      agentId: "brief-agent",
      description: "Create brief",
      on: { approved: "gate", rejected: { end: "failed" } }
    }, {
      id: "gate",
      type: "human",
      description: "Approve brief",
      on: { approved: { loop: "roadmap" }, rejected: "create" }
    }]
  }, {
    id: "roadmap",
    start: "create-roadmap",
    steps: [{
      id: "create-roadmap",
      type: "agent",
      agentId: "roadmap-agent",
      description: "Create roadmap",
      on: { approved: { end: "completed" }, rejected: { end: "failed" } }
    }]
  }]
};

describe("v3 compact loop canvas", () => {
  it("projects Steps and Transitions into the original compact geometry", () => {
    const projection = buildLoopVisualProjection(config, config.loops[0]!);
    const layout = calculateCompositeLoopCanvasLayout({
      config: projection.config,
      selectedLoopId: "brief",
      recordsByLoopId: projection.recordsByLoopId
    });
    const stepNodes = layout.nodes.filter((node) => node.kind === "step");
    expect(stepNodes).toHaveLength(2);
    expect(stepNodes.map((node) => [node.width, node.height])).toEqual([[44, 44], [28, 28]]);
    expect(layout.nodes.some((node) => node.kind === "loop" && node.loopSummary?.loopId === "roadmap")).toBe(true);
    expect(layout.nodes.some((node) => node.kind === "output-event" && node.outputEvent?.eventType === "failed")).toBe(true);
    const crossLoopEdge = layout.edges.find((edge) => edge.tone === "cross-loop" && edge.route?.targetLoopId === "roadmap");
    expect(crossLoopEdge).toBeDefined();
    expect(loopEdgeDisplayLabel(crossLoopEdge)).toBeUndefined();
    expect(layout.edges.map((edge) => edge.route?.outputId)).toEqual(expect.arrayContaining(["approved", "rejected"]));
    expect(layout.edges.some((edge) => edge.route?.outputId === "rejected" && ["top", "bottom"].includes(edge.sourceHandleId ?? ""))).toBe(true);
  });

  it("keeps direct branches, terminal ghosts, labels, and cycle return arcs", () => {
    const cyclic: ProjectAutomationConfig = {
      version: 3,
      loops: [{
        id: "cycle",
        start: "prepare",
        steps: [{
          id: "prepare",
          type: "agent",
          agentId: "agent",
          description: "Prepare",
          on: { approved: "review", rejected: "repair" }
        }, {
          id: "review",
          type: "agent",
          agentId: "agent",
          description: "Review",
          on: { approved: { end: "completed" }, rejected: "prepare" }
        }, {
          id: "repair",
          type: "agent",
          agentId: "agent",
          description: "Repair",
          on: { approved: "review", rejected: { end: "failed" } }
        }]
      }]
    };
    const projection = buildLoopVisualProjection(cyclic, cyclic.loops[0]!);
    const layout = calculateCompositeLoopCanvasLayout({
      config: projection.config,
      selectedLoopId: "cycle",
      recordsByLoopId: projection.recordsByLoopId
    });
    const stepNodes = layout.nodes.filter((node) => node.kind === "step");
    const approved = layout.edges.find((edge) => edge.route?.sourceStepIndex === 0 && edge.route.outputId === "approved")!;
    const rejected = layout.edges.find((edge) => edge.route?.sourceStepIndex === 0 && edge.route.outputId === "rejected")!;

    expect(stepNodes).toHaveLength(3);
    expect(approved.targetNodeKey).not.toBe(rejected.targetNodeKey);
    expect(loopEdgeDisplayLabel(approved)).toBeUndefined();
    expect(loopEdgeDisplayLabel(rejected)).toBeUndefined();
    expect(layout.edges.some((edge) => edge.tone === "return" && edge.route?.outputId === "rejected")).toBe(true);
    expect(layout.nodes.map((node) => node.outputEvent?.eventType)).toEqual(expect.arrayContaining(["completed", "failed"]));
    expect(loopEdgeDomAttributes(rejected, true)).toMatchObject({
      "data-loop-edge-animated": "true",
      "data-loop-edge-output-slot-kind": "rework"
    });
  });

  it("keeps the golden straight, smart, and return edge geometry", () => {
    expect(loopApprovalEdgePath({ sourceX: 10, sourceY: 20, targetX: 90, targetY: 20 }).path).toBe("M 10,20 L 90,20");
    expect(loopToLoopStraightEdgePath({ sourceX: 10, sourceY: 20, targetX: 90, targetY: 60 })).toMatchObject({
      path: "M 10,20 L 90,60",
      labelX: 50,
      labelY: 40
    });
    expect(loopSmartEdgeRoutingOptions({ sourceY: 20, targetY: 80 })).toMatchObject({ gridRatio: 5, nodePadding: 6 });
    const returnPath = loopReturnEdgePath({
      sourceX: 90,
      sourceY: 60,
      targetX: 10,
      targetY: 20,
      data: {
        loopEdge: { key: "return", sourceNodeKey: "step-1", targetNodeKey: "step-0", sourceHandleId: "bottom", targetHandleId: "top", tone: "return" }
      }
    } as never);
    expect(returnPath.path).toContain("M 90,60");
    expect(returnPath.path).toContain("L 10,20");
  });

});

describe("celestial Loop Canvas geometry", () => {
  it("projects Luna, Terra, Sol, and human gates into dynamic collision-safe sizes", () => {
    const agents = (["luna", "terra", "sol"] as const).map((nodeStyle, index) => ({ id: `agent-${index}`, nodeStyle })) as Agent[];
    const styledLoop = {
      id: "styled",
      start: "luna",
      steps: [
        { id: "luna", type: "agent", agentId: "agent-0", description: "", on: { approved: "terra", rejected: { end: "failed" } } },
        { id: "terra", type: "agent", agentId: "agent-1", description: "", on: { approved: "sol", rejected: { end: "failed" } } },
        { id: "sol", type: "agent", agentId: "agent-2", description: "", on: { approved: "human", rejected: { end: "failed" } } },
        { id: "human", type: "human", description: "", on: { approved: { end: "completed" }, rejected: { end: "failed" } } }
      ]
    } satisfies ProjectAutomationConfig["loops"][number];
    const styledConfig = { version: 3, loops: [styledLoop] } satisfies ProjectAutomationConfig;
    const projection = buildLoopVisualProjection(styledConfig, styledLoop, null, agents);
    const layout = calculateCompositeLoopCanvasLayout({ config: projection.config, selectedLoopId: styledLoop.id, recordsByLoopId: projection.recordsByLoopId });
    const steps = layout.nodes.filter((node) => node.kind === "step");

    expect(projection.config.steps.map((step) => step.nodeStyle)).toEqual(["luna", "terra", "sol", "luna"]);
    expect(steps.map((node) => node.width)).toEqual([loopPlanetNodeSizes.luna, loopPlanetNodeSizes.terra, loopPlanetNodeSizes.sol, loopPlanetNodeSizes.luna]);
    expect(steps.every((node, index) => index === 0 || node.x > steps[index - 1]!.x + steps[index - 1]!.width)).toBe(true);
    expect(new Set(steps.map((node) => node.y + node.height / 2))).toEqual(new Set([96]));
    expect(loopNodeSizes.step.maxWidth).toBe(loopPlanetNodeSizes.sol);
  });

  it("detaches edge endpoints by eight pixels and uses five-pixel connection points", () => {
    const detached = detachedLoopEdgeProps({
      sourceX: 20,
      sourceY: 30,
      targetX: 120,
      targetY: 80,
      sourcePosition: Position.Right,
      targetPosition: Position.Top
    } as never);

    expect(detached).toMatchObject({ sourceX: 28, sourceY: 30, targetX: 120, targetY: 72 });
    expect(loopEdgeEndpointGap).toBe(8);
    expect(loopConnectionPointRadius * 2).toBe(5);
  });
});
