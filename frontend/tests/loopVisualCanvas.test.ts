import { Position } from "@xyflow/react";
import {
  defaultLoopTheme,
  defaultTerminalNodes,
  loopNodeSizeCatalog,
  loopNodeSizes,
  loopNodeStyles,
  type Agent,
  type LoopRunDetails,
  type ProjectAutomationConfig
} from "@shared/api/workspace-contracts";
import { describe, expect, it } from "vitest";
import { loopApprovalEdgePath, loopEdgeDisplayLabel, loopReturnEdgePath, loopToLoopStraightEdgePath } from "../src/workspace/automation/loops/LoopSmartEdge";
import { loopConnectionPointRadius, loopEdgeEndpointGap, themedLoopEdgeProps } from "../src/workspace/automation/loops/loopFloatingEdgeGeometry";
import { loopEdgeDomAttributes, loopEdgeLineStyle, loopEdgeStyle } from "../src/workspace/automation/loops/loopEdgeStyle";
import { calculateCompositeLoopCanvasLayout, loopNodeSizes as loopLayoutNodeSizes } from "../src/workspace/automation/loops/loopLayout";
import { loopStepNodeSizes } from "../src/workspace/automation/loops/loopLayoutConfig";
import { loopReasoningGlowLevel } from "../src/workspace/automation/loops/loopReasoningGlow";
import { loopActiveHandleIdsByNodeKey, loopNodeHandles, toLoopReactFlowEdges } from "../src/workspace/automation/loops/loopReactFlowElements";
import { loopSmartEdgeRoutingOptions } from "../src/workspace/automation/loops/loopSmartEdgeRouting";
import { buildLoopVisualProjection } from "../src/workspace/automation/loops/loopVisualProjection";

const config: ProjectAutomationConfig = {
  version: 8,
  loops: [{
    id: "brief",
    start: "create",
    nodes: [{
      id: "create",
      type: "agent",
      nodeStyle: "terra",
      nodeSize: "medium",
      agentId: "brief-agent",
      description: "Create brief",
      on: { approved: "gate", rejected: "failed" }
    }, {
      id: "gate",
      type: "human",
      nodeStyle: "luna",
      nodeSize: "tiny",
      description: "Approve brief",
      on: { approved: { loop: "roadmap" }, rejected: "create" }
    }, ...defaultTerminalNodes()]
  }, {
    id: "roadmap",
    start: "create-roadmap",
    nodes: [{
      id: "create-roadmap",
      type: "agent",
      nodeStyle: "flat",
      nodeSize: "medium",
      agentId: "roadmap-agent",
      description: "Create roadmap",
      on: { approved: "completed", rejected: "blocked" }
    }, ...defaultTerminalNodes()]
  }]
};

describe("terminal canvas nodes", () => {
  it("shares one terminal node across multiple incoming transitions", () => {
    const sharedTerminalConfig: ProjectAutomationConfig = {
      version: 8,
      loops: [{
        id: "shared-terminal",
        start: "gate",
        nodes: [{
          id: "gate",
          type: "human",
          nodeStyle: "flat",
          nodeSize: "medium",
          description: "Gate",
          on: { approved: "blocked", rejected: "blocked" }
        }, ...defaultTerminalNodes()]
      }]
    };
    const loop = sharedTerminalConfig.loops[0]!;
    const projection = buildLoopVisualProjection(sharedTerminalConfig, loop);
    const layout = calculateCompositeLoopCanvasLayout({ config: projection.config, selectedLoopId: loop.id, recordsByLoopId: projection.recordsByLoopId });
    const terminal = layout.nodes.filter((node) => node.record?.step?.terminal);

    expect(terminal).toHaveLength(1);
    expect(terminal[0]?.record?.step?.displayId).toBe("blocked");
    expect(layout.edges.filter((edge) => edge.targetNodeKey === terminal[0]?.key)).toHaveLength(2);
    expect(layout.edges.some((edge) => edge.sourceNodeKey === terminal[0]?.key)).toBe(false);
  });
});

describe("v8 compact loop canvas", () => {
  it("projects styled nodes, reachable terminal nodes, and cross-Loop transitions", () => {
    const projection = buildLoopVisualProjection(config, config.loops[0]!);
    const layout = calculateCompositeLoopCanvasLayout({
      config: projection.config,
      selectedLoopId: "brief",
      recordsByLoopId: projection.recordsByLoopId
    });
    const stepNodes = layout.nodes.filter((node) => node.kind === "step" && !node.record?.step?.terminal);
    const terminalNodes = layout.nodes.filter((node) => node.record?.step?.terminal);

    expect(stepNodes).toHaveLength(2);
    expect(stepNodes.map((node) => [node.width, node.height])).toEqual([[48, 48], [24, 24]]);
    expect(layout.nodes.some((node) => node.kind === "loop" && node.loopSummary?.loopId === "roadmap")).toBe(true);
    expect(terminalNodes.map((node) => node.record?.step?.displayId)).toEqual(["failed"]);
    expect(layout.nodes.some((node) => node.kind === "output-event")).toBe(false);
    const crossLoopEdge = layout.edges.find((edge) => edge.tone === "cross-loop" && edge.route?.targetLoopId === "roadmap");
    expect(crossLoopEdge).toBeDefined();
    expect(loopEdgeDisplayLabel(crossLoopEdge)).toBeUndefined();
    expect(layout.edges.map((edge) => edge.route?.outputId)).toEqual(expect.arrayContaining(["approved", "rejected"]));
    expect(layout.edges.some((edge) => edge.route?.outputId === "rejected" && ["top", "bottom"].includes(edge.sourceHandleId ?? ""))).toBe(true);
  });

  it("keeps direct branches, semantic terminals, and cycle return arcs", () => {
    const cyclic: ProjectAutomationConfig = {
      version: 8,
      loops: [{
        id: "cycle",
        start: "prepare",
        nodes: [{
          id: "prepare",
          type: "agent",
          nodeStyle: "flat",
          nodeSize: "medium",
          agentId: "agent",
          description: "Prepare",
          on: { approved: "review", rejected: "repair" }
        }, {
          id: "review",
          type: "agent",
          nodeStyle: "mars",
          nodeSize: "small",
          agentId: "agent",
          description: "Review",
          on: { approved: "completed", rejected: "prepare" }
        }, {
          id: "repair",
          type: "agent",
          nodeStyle: "vector-planet",
          nodeSize: "tiny",
          agentId: "agent",
          description: "Repair",
          on: { approved: "blocked", rejected: "failed" }
        }, ...defaultTerminalNodes()]
      }]
    };
    const projection = buildLoopVisualProjection(cyclic, cyclic.loops[0]!);
    const layout = calculateCompositeLoopCanvasLayout({
      config: projection.config,
      selectedLoopId: "cycle",
      recordsByLoopId: projection.recordsByLoopId
    });
    const approved = layout.edges.find((edge) => edge.route?.sourceStepIndex === 0 && edge.route.outputId === "approved")!;
    const rejected = layout.edges.find((edge) => edge.route?.sourceStepIndex === 0 && edge.route.outputId === "rejected")!;
    const terminalNodes = layout.nodes.filter((node) => node.record?.step?.terminal);

    expect(layout.nodes.filter((node) => node.kind === "step" && !node.record?.step?.terminal)).toHaveLength(3);
    expect(approved.targetNodeKey).not.toBe(rejected.targetNodeKey);
    expect(loopEdgeDisplayLabel(approved)).toBeUndefined();
    expect(loopEdgeDisplayLabel(rejected)).toBeUndefined();
    expect(layout.edges.some((edge) => edge.tone === "return" && edge.route?.outputId === "rejected")).toBe(true);
    expect(terminalNodes.map((node) => node.record?.step?.displayId)).toEqual(expect.arrayContaining(["completed", "blocked", "failed"]));
    expect(terminalNodes.every((node) => node.width === 24 && node.height === 24)).toBe(true);
    expect(terminalNodes.every((node) => layout.edges.some((edge) => edge.targetNodeKey === node.key))).toBe(true);
    expect(terminalNodes.every((node) => layout.edges.every((edge) => edge.sourceNodeKey !== node.key))).toBe(true);
    const activeHandleIds = loopActiveHandleIdsByNodeKey(layout.edges);
    expect(terminalNodes.every((node) => loopNodeHandles(node, activeHandleIds.get(node.key) ?? []).every((handle) => handle.type === "target"))).toBe(true);
    expect(layout.nodes.some((node) => node.kind === "first-step-ghost")).toBe(false);
    expect(loopEdgeDomAttributes(rejected, defaultLoopTheme, true)).toMatchObject({
      "data-loop-edge-animated": "true",
      "data-loop-edge-output-slot-kind": "rework"
    });

    const terminalEdge = layout.edges.find((edge) => terminalNodes.some((node) => node.key === edge.targetNodeKey))!;
    const terminalNode = terminalNodes.find((node) => node.key === terminalEdge.targetNodeKey);
    expect(loopEdgeStyle(terminalEdge, terminalNode, false, defaultLoopTheme)?.opacity).toBe(0.64);
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

describe("Loop node style geometry", () => {
  it("uses all 27 × 4 independent style and size combinations and keeps mixed-size lanes centered", () => {
    const combinations = loopNodeStyles.flatMap((nodeStyle) => loopNodeSizes.map((nodeSize) => [nodeStyle, nodeSize] as const));
    const steps = combinations.map(([nodeStyle, nodeSize], index) => ({
      id: `${nodeStyle}-${nodeSize}`,
      type: "agent" as const,
      nodeStyle,
      nodeSize,
      agentId: `agent-${nodeStyle}-${nodeSize}`,
      description: "",
      on: { approved: combinations[index + 1] ? `${combinations[index + 1]![0]}-${combinations[index + 1]![1]}` : "completed", rejected: "blocked" }
    }));
    const styledLoop = { id: "styled", start: "flat-tiny", nodes: [...steps, ...defaultTerminalNodes()] } satisfies ProjectAutomationConfig["loops"][number];
    const styledConfig = { version: 8, loops: [styledLoop] } satisfies ProjectAutomationConfig;
    const agents = steps.map((step) => ({ id: step.agentId })) as Agent[];
    const projection = buildLoopVisualProjection(styledConfig, styledLoop, null, agents);
    const layout = calculateCompositeLoopCanvasLayout({ config: projection.config, selectedLoopId: styledLoop.id, recordsByLoopId: projection.recordsByLoopId });
    const stepNodes = layout.nodes.filter((node) => node.kind === "step" && !node.record?.step?.terminal);

    expect(projection.config.steps.filter((step) => !step.terminal).map((step) => [step.nodeStyle, step.nodeSize])).toEqual(
      combinations
    );
    expect(stepNodes.map((node) => node.width)).toEqual(loopNodeStyles.flatMap(() => loopNodeSizes.map((size) => loopNodeSizeCatalog[size].pixels)));
    expect(loopStepNodeSizes).toEqual({ tiny: 24, small: 36, medium: 48, large: 64 });
    expect(stepNodes.every((node, index) => index === 0 || node.x > stepNodes[index - 1]!.x + stepNodes[index - 1]!.width)).toBe(true);
    expect(Math.min(...stepNodes.slice(1).map((node, index) => node.x - (stepNodes[index]!.x + stepNodes[index]!.width)))).toBeGreaterThanOrEqual(208);
    expect(new Set(stepNodes.map((node) => node.y + node.height / 2)).size).toBe(1);
    expect(loopLayoutNodeSizes.step).toMatchObject({ minWidth: 24, maxWidth: 64, height: 64 });
  });

  it("projects a scheduled agent into Luna geometry with immutable agent reasoning", () => {
    const scheduledLoop = {
      id: "scheduled",
      start: "timer",
      nodes: [{
        id: "timer",
        type: "scheduled",
        nodeStyle: "luna",
        nodeSize: "tiny",
        agentId: "deploy-agent",
        description: "Deploy",
        schedule: { kind: "recurring", cadence: "weekdays", startsOn: "2026-07-13", time: "09:00", timeZone: "Europe/Helsinki" },
        on: { approved: "completed", rejected: "blocked" }
      }, ...defaultTerminalNodes()]
    } satisfies ProjectAutomationConfig["loops"][number];
    const scheduledConfig = { version: 8, loops: [scheduledLoop] } satisfies ProjectAutomationConfig;
    const run = {
      executionPlan: {
        steps: [{
          loopId: scheduledLoop.id,
          stepId: "timer",
          agentId: "deploy-agent",
          agent: {},
          runtime: { reasoning: "xhigh" }
        }]
      },
      stepRuns: []
    } as unknown as LoopRunDetails;
    const projection = buildLoopVisualProjection(scheduledConfig, scheduledLoop, run, [], [{ agentId: "deploy-agent", status: "idle", reasoning: "low" }]);
    const layout = calculateCompositeLoopCanvasLayout({ config: projection.config, selectedLoopId: scheduledLoop.id, recordsByLoopId: projection.recordsByLoopId });
    const scheduledNode = layout.nodes.find((node) => node.record?.step?.scheduled);

    expect(scheduledNode).toMatchObject({ width: 24, height: 24 });
    expect(scheduledNode?.record?.step).toMatchObject({
      agentId: "deploy-agent",
      nodeStyle: "luna",
      reasoningEffort: "xhigh",
      scheduleLabel: "Weekdays · 09:00 · Europe/Helsinki"
    });
    expect(layout.edges.map((edge) => edge.route?.outputId)).toEqual(expect.arrayContaining(["approved", "rejected"]));
  });

  it("maps increasing reasoning effort to progressively stronger glow levels", () => {
    expect([undefined, "provider-default", "light", "low", "medium", "high", "xhigh", "max", "ultra"].map(loopReasoningGlowLevel)).toEqual([0, 0, 1, 2, 3, 4, 5, 6, 7]);
    expect(loopReasoningGlowLevel("custom-effort")).toBe(3);
  });
});

describe("global Loop theme rendering", () => {
  it("uses the global normal, rejected, and cross-Loop line styles", () => {
    const normal = { key: "normal", sourceNodeKey: "one", targetNodeKey: "two" };
    const rejected = { ...normal, key: "rejected", route: { outputId: "rejected" } };
    const crossLoop = { ...normal, key: "cross-loop", tone: "cross-loop" as const };

    expect(loopEdgeLineStyle(normal, defaultLoopTheme)).toBe("solid");
    expect(loopEdgeLineStyle(rejected, defaultLoopTheme)).toBe("dotted");
    expect(loopEdgeLineStyle(crossLoop, defaultLoopTheme)).toBe("dashed");
    expect(loopEdgeStyle(rejected, undefined, false, defaultLoopTheme)?.strokeDasharray).toBe("1 5");
    expect(loopEdgeStyle(crossLoop, undefined, false, defaultLoopTheme)?.strokeDasharray).toBe("6 5");
    expect(toLoopReactFlowEdges([crossLoop], [], undefined, "cross-loop")[0]).toMatchObject({
      animated: true,
      className: "loop-edge-animated",
      domAttributes: { "data-loop-edge-style": "dashed" }
    });
  });

  it("applies customized global styles to normal and rejected terminal edges", () => {
    const themed = {
      ...structuredClone(defaultLoopTheme),
      edge: {
        ...defaultLoopTheme.edge,
        style: "dotted" as const,
        rejectedStyle: "solid" as const
      }
    };
    const completed = { key: "completed", sourceNodeKey: "one", targetNodeKey: "node-completed", eventType: "completed" };
    const rejected = { key: "rejected", sourceNodeKey: "one", targetNodeKey: "node-failed", eventType: "rejected" };

    expect(loopEdgeLineStyle(completed, themed)).toBe("dotted");
    expect(loopEdgeLineStyle(rejected, themed)).toBe("solid");
  });

  it("keeps the global theme tokens and avatar visibility explicit", () => {
    expect(defaultLoopTheme).toMatchObject({
      version: 2,
      node: { labelColor: "#ffb95f", glowColor: "#8b90a0", showAgentAvatarInNode: false },
      edge: { color: "#76d4ca", labelColor: "#c1c6d7" },
      connectionPoint: { style: "near", color: "#e3fffb" }
    });
  });

  it("uses the immutable execution-plan avatar instead of mutable live agent metadata", () => {
    const avatarLoop = {
      id: "avatar-loop",
      start: "build",
      nodes: [{
        id: "build",
        type: "agent",
        nodeStyle: "flat",
        nodeSize: "medium",
        agentId: "builder",
        description: "",
        on: { approved: "completed", rejected: "blocked" }
      }, ...defaultTerminalNodes()]
    } satisfies ProjectAutomationConfig["loops"][number];
    const avatarConfig = { version: 8, loops: [avatarLoop] } satisfies ProjectAutomationConfig;
    const run = {
      executionPlan: {
        steps: [{ loopId: avatarLoop.id, stepId: "build", agentId: "builder", agent: { avatar: "rocket" }, runtime: { reasoning: "medium" } }]
      },
      stepRuns: []
    } as unknown as LoopRunDetails;

    const projection = buildLoopVisualProjection(avatarConfig, avatarLoop, run, [{ id: "builder", avatar: "bot" } as Agent]);
    expect(projection.config.steps[0]).toMatchObject({ avatar: "rocket", reasoningEffort: "medium" });
  });

  it("resolves near and flow endpoints and uses five-pixel connection points", () => {
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
    expect(loopEdgeStyle({ key: "flow", sourceNodeKey: "one", targetNodeKey: "two" }, undefined, false, defaultLoopTheme)).toMatchObject({
      strokeWidth: 1.5,
      opacity: 0.64
    });
  });
});
