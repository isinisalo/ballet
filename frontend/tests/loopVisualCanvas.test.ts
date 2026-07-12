import { Position } from "@xyflow/react";
import type { Agent, LoopRunDetails, ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import { describe, expect, it } from "vitest";
import { loopApprovalEdgePath, loopEdgeDisplayLabel, loopReturnEdgePath, loopToLoopStraightEdgePath } from "../src/workspace/automation/loops/LoopSmartEdge";
import { loopConnectionPointRadius, loopEdgeEndpointGap, themedLoopEdgeProps } from "../src/workspace/automation/loops/loopFloatingEdgeGeometry";
import { loopEdgeDomAttributes, loopEdgeLineStyle, loopEdgeStyle } from "../src/workspace/automation/loops/loopEdgeStyle";
import { calculateCompositeLoopCanvasLayout, loopNodeSizes } from "../src/workspace/automation/loops/loopLayout";
import { loopStepNodeSizes } from "../src/workspace/automation/loops/loopLayoutConfig";
import { loopReasoningGlowLevel } from "../src/workspace/automation/loops/loopReasoningGlow";
import { toLoopReactFlowEdges } from "../src/workspace/automation/loops/loopReactFlowElements";
import { loopSmartEdgeRoutingOptions } from "../src/workspace/automation/loops/loopSmartEdgeRouting";
import { buildLoopVisualProjection } from "../src/workspace/automation/loops/loopVisualProjection";
import { loopThemes } from "../src/workspace/automation/loops/loopTheme";

const config: ProjectAutomationConfig = {
  version: 5,
  loops: [{
    id: "brief",
    theme: "open-ai",
    start: "create",
    steps: [{
      id: "create",
      type: "agent",
      nodeSize: "medium",
      agentId: "brief-agent",
      description: "Create brief",
      on: { approved: "gate", rejected: { end: "failed" } }
    }, {
      id: "gate",
      type: "human",
      nodeSize: "small",
      description: "Approve brief",
      on: { approved: { loop: "roadmap" }, rejected: "create" }
    }]
  }, {
    id: "roadmap",
    theme: "open-ai",
    start: "create-roadmap",
    steps: [{
      id: "create-roadmap",
      type: "agent",
      nodeSize: "medium",
      agentId: "roadmap-agent",
      description: "Create roadmap",
      on: { approved: { end: "completed" }, rejected: { end: "failed" } }
    }]
  }]
};

describe("v5 compact loop canvas", () => {
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
      version: 5,
      loops: [{
        id: "cycle",
        theme: "open-ai",
        start: "prepare",
        steps: [{
          id: "prepare",
          type: "agent",
          nodeSize: "medium",
          agentId: "agent",
          description: "Prepare",
          on: { approved: "review", rejected: "repair" }
        }, {
          id: "review",
          type: "agent",
          nodeSize: "medium",
          agentId: "agent",
          description: "Review",
          on: { approved: { end: "completed" }, rejected: "prepare" }
        }, {
          id: "repair",
          type: "agent",
          nodeSize: "medium",
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
    expect(loopEdgeDomAttributes(rejected, loopThemes["open-ai"], true)).toMatchObject({
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
  it("keeps a scheduled start in 28px Luna geometry with one triggered edge", () => {
    const scheduledLoop = {
      id: "scheduled",
      theme: "open-ai",
      start: "timer",
      steps: [{
        id: "timer",
        type: "scheduled",
        nodeSize: "small",
        description: "",
        schedule: { kind: "recurring", cadence: "weekdays", startsOn: "2026-07-13", time: "09:00", timeZone: "Europe/Helsinki" },
        on: { triggered: "run" }
      }, {
        id: "run",
        type: "agent",
        nodeSize: "medium",
        agentId: "agent",
        description: "",
        on: { approved: { end: "completed" }, rejected: { end: "failed" } }
      }]
    } satisfies ProjectAutomationConfig["loops"][number];
    const scheduledConfig = { version: 5, loops: [scheduledLoop] } satisfies ProjectAutomationConfig;
    const projection = buildLoopVisualProjection(scheduledConfig, scheduledLoop);
    const layout = calculateCompositeLoopCanvasLayout({ config: projection.config, selectedLoopId: scheduledLoop.id, recordsByLoopId: projection.recordsByLoopId });
    const scheduledNode = layout.nodes.find((node) => node.record?.step?.scheduled);

    expect(scheduledNode).toMatchObject({ width: 28, height: 28 });
    expect(scheduledNode?.record?.step?.scheduleLabel).toBe("Weekdays · 09:00 · Europe/Helsinki");
    expect(layout.edges.some((edge) => edge.route?.outputId === "triggered")).toBe(true);
  });

  it("projects small, medium, large, and human Steps into dynamic collision-safe sizes", () => {
    const agents = (["bot", "rocket", "sparkles"] as const).map((avatar, index) => ({ id: `agent-${index}`, avatar })) as Agent[];
    const styledLoop = {
      id: "styled",
      theme: "open-ai",
      start: "luna",
      steps: [
        { id: "luna", type: "agent", nodeSize: "small", agentId: "agent-0", description: "", on: { approved: "terra", rejected: { end: "failed" } } },
        { id: "terra", type: "agent", nodeSize: "medium", agentId: "agent-1", description: "", on: { approved: "sol", rejected: { end: "failed" } } },
        { id: "sol", type: "agent", nodeSize: "large", agentId: "agent-2", description: "", on: { approved: "human", rejected: { end: "failed" } } },
        { id: "human", type: "human", nodeSize: "small", description: "", on: { approved: { end: "completed" }, rejected: { end: "failed" } } }
      ]
    } satisfies ProjectAutomationConfig["loops"][number];
    const styledConfig = { version: 5, loops: [styledLoop] } satisfies ProjectAutomationConfig;
    const projection = buildLoopVisualProjection(styledConfig, styledLoop, null, agents, [
      { agentId: "agent-0", status: "idle", reasoning: "low" },
      { agentId: "agent-1", status: "idle", reasoning: "medium" },
      { agentId: "agent-2", status: "idle", reasoning: "xhigh" }
    ]);
    const layout = calculateCompositeLoopCanvasLayout({ config: projection.config, selectedLoopId: styledLoop.id, recordsByLoopId: projection.recordsByLoopId });
    const steps = layout.nodes.filter((node) => node.kind === "step");

    expect(projection.config.steps.map((step) => step.nodeSize)).toEqual(["small", "medium", "large", "small"]);
    expect(projection.config.steps.map((step) => step.avatar)).toEqual(["bot", "rocket", "sparkles", undefined]);
    expect(projection.config.steps.map((step) => step.reasoningEffort)).toEqual(["low", "medium", "xhigh", undefined]);
    expect(steps.map((node) => node.width)).toEqual([loopStepNodeSizes.small, loopStepNodeSizes.medium, loopStepNodeSizes.large, loopStepNodeSizes.small]);
    expect(steps.every((node, index) => index === 0 || node.x > steps[index - 1]!.x + steps[index - 1]!.width)).toBe(true);
    expect(Math.min(...steps.slice(1).map((node, index) => node.x - (steps[index]!.x + steps[index]!.width)))).toBeGreaterThanOrEqual(208);
    expect(new Set(steps.map((node) => node.y + node.height / 2))).toEqual(new Set([96]));
    expect(loopNodeSizes.step.maxWidth).toBe(loopStepNodeSizes.large);
  });

  it("maps increasing reasoning effort to progressively stronger glow levels", () => {
    expect([undefined, "provider-default", "light", "low", "medium", "high", "xhigh", "max", "ultra"].map(loopReasoningGlowLevel)).toEqual([0, 0, 1, 2, 3, 4, 5, 6, 7]);
    expect(loopReasoningGlowLevel("custom-effort")).toBe(3);
  });
});

describe("Loop theme rendering", () => {
  it("resolves normal, rejected, and cross-Loop line styles from each built-in theme", () => {
    const normal = { key: "normal", sourceNodeKey: "one", targetNodeKey: "two" };
    const rejected = { ...normal, key: "rejected", route: { outputId: "rejected" } };
    const crossLoop = { ...normal, key: "cross-loop", tone: "cross-loop" as const };

    for (const theme of Object.values(loopThemes)) {
      expect(loopEdgeLineStyle(normal, theme)).toBe("solid");
      expect(loopEdgeLineStyle(rejected, theme)).toBe("dashed");
      expect(loopEdgeLineStyle(crossLoop, theme)).toBe("dotted");
      expect(loopEdgeStyle(rejected, undefined, false, theme)?.strokeDasharray).toBe("6 5");
      expect(loopEdgeStyle(crossLoop, undefined, false, theme)?.strokeDasharray).toBe("1 5");
    }
    expect(toLoopReactFlowEdges([crossLoop], [], undefined, "cross-loop")[0]).toMatchObject({
      animated: true,
      className: "loop-edge-animated",
      domAttributes: { "data-loop-edge-style": "dotted" }
    });
  });

  it("applies theme styles to terminal normal and rejected edges", () => {
    const themed = {
      ...structuredClone(loopThemes.default),
      edge: {
        ...loopThemes.default.edge,
        style: "dotted" as const,
        rejectedStyle: "solid" as const
      }
    };
    const completed = { key: "completed", sourceNodeKey: "one", targetNodeKey: "output-event-completed", eventType: "completed" };
    const rejected = { key: "rejected", sourceNodeKey: "one", targetNodeKey: "output-event-rejected", eventType: "rejected" };

    expect(loopEdgeLineStyle(completed, themed)).toBe("dotted");
    expect(loopEdgeLineStyle(rejected, themed)).toBe("solid");
  });

  it("keeps the built-in theme tokens and avatar visibility explicit", () => {
    expect(loopThemes["open-ai"]).toMatchObject({
      node: { labelColor: "#ffb95f", showAgentAvatarInNode: false },
      edge: { color: "#76d4ca", labelColor: "#c1c6d7" },
      connectionPoint: { style: "near", color: "#e3fffb" }
    });
    expect(loopThemes.default).toMatchObject({
      node: { labelColor: "#c1c6d7", glowColor: "#adc6ff", showAgentAvatarInNode: true },
      edge: { color: "#8b90a0", labelColor: "#c1c6d7" },
      connectionPoint: { style: "flow", color: "#adc6ff" }
    });
  });

  it("uses the immutable execution-plan avatar instead of mutable live agent metadata", () => {
    const avatarLoop = {
      id: "avatar-loop",
      theme: "default",
      start: "build",
      steps: [{
        id: "build",
        type: "agent",
        nodeSize: "medium",
        agentId: "builder",
        description: "",
        on: { approved: { end: "completed" }, rejected: { end: "failed" } }
      }]
    } satisfies ProjectAutomationConfig["loops"][number];
    const avatarConfig = { version: 5, loops: [avatarLoop] } satisfies ProjectAutomationConfig;
    const run = {
      executionPlan: {
        steps: [{ loopId: avatarLoop.id, stepId: "build", agentId: "builder", agent: { avatar: "rocket" } }]
      },
      stepRuns: []
    } as unknown as LoopRunDetails;

    const projection = buildLoopVisualProjection(avatarConfig, avatarLoop, run, [{ id: "builder", avatar: "bot" } as Agent]);
    expect(projection.config.steps[0]?.avatar).toBe("rocket");
  });

  it("resolves near and flow endpoints from the theme and uses five-pixel connection points", () => {
    const props = {
      sourceX: 20,
      sourceY: 30,
      targetX: 120,
      targetY: 80,
      sourcePosition: Position.Right,
      targetPosition: Position.Top
    } as never;
    const detached = themedLoopEdgeProps(props, "near");
    const attached = themedLoopEdgeProps(props, "flow");

    expect(detached).toMatchObject({ sourceX: 28, sourceY: 30, targetX: 120, targetY: 72 });
    expect(attached).toMatchObject({ sourceX: 20, sourceY: 30, targetX: 120, targetY: 80 });
    expect(loopEdgeEndpointGap).toBe(8);
    expect(loopConnectionPointRadius * 2).toBe(5);
    expect(loopEdgeStyle({ key: "flow", sourceNodeKey: "one", targetNodeKey: "two" }, undefined, false, loopThemes["open-ai"])).toMatchObject({
      strokeWidth: 1.5,
      opacity: 0.64
    });
  });
});
