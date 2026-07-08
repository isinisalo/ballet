import type { ProjectAutomationConfig, ProjectPolicy } from "@shared/api/workspace-contracts";
import { policyOutputEventTypes } from "@shared/policy-actions";
import { getSmartEdge, smartEdgePresets } from "@tisoap/react-flow-smart-edge";
import { Position, type Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import { toLoopReactFlowEdges } from "../src/workspace/automation/loops/LoopCanvas";
import { loopApprovalEdgePath, loopEdgeLabelTransform, loopReturnEdgePath } from "../src/workspace/automation/loops/LoopSmartEdge";
import { loopCrossLoopSmoothStepPath } from "../src/workspace/automation/loops/loopCrossLoopSmoothStepPath";
import { loopRoutedEdgeLabelAnchor } from "../src/workspace/automation/loops/loopEdgeLabelGeometry";
import { buildLoopGraph, type LoopStepRecord } from "../src/workspace/automation/loops/loopGraph";
import { calculateAllLoopsCanvasLayout, calculateCompositeLoopCanvasLayout, calculateLoopCanvasLayout, loopCanvasLayoutConfig, loopCanvasNodeAnchorY, loopNodeSizes, loopOutputSourceHandleId, loopPolicyOutputHandleY, loopPolicyStackHeight, type LoopLayoutDirection } from "../src/workspace/automation/loops/loopLayout";
import { positionLoopNodes } from "../src/workspace/automation/loops/loopLayoutPositioning";
import { loopOutputTargetsForPolicy } from "../src/workspace/automation/loops/loopOutputTargets";
import { loopSmartEdgeRoutingOptions } from "../src/workspace/automation/loops/loopSmartEdgeRouting";

const policy = (id: string, event: string | undefined, action = "build"): ProjectPolicy => ({
  id,
  source: event ? "event" : "trigger",
  event,
  trigger: event ? undefined : "project.updated",
  action,
  enabled: true
});

const layoutFor = (policies: ProjectPolicy[], steps: string[], editingPolicyIndex: number | null = null, direction: LoopLayoutDirection = "horizontal") => {
  const policyById = new Map(policies.map((item) => [item.id, item]));
  const records: LoopStepRecord[] = steps.map((policyId, index) => ({
    policyId,
    index,
    policy: policyById.get(policyId),
    outputEvents: policyById.get(policyId) ? policyOutputEventTypes(policyById.get(policyId)!, [{ id: policyById.get(policyId)!.action, outputIds: ["complete", "failed"] }]) : undefined
  }));

  return calculateLoopCanvasLayout({
    loopGraph: buildLoopGraph(records),
    editingPolicyIndex,
    direction
  });
};

const compositeConfig = (
  loopIds: string[],
  outputRoutes: ProjectAutomationConfig["outputRoutes"] = [],
  sourceStartTrigger = "source-trigger"
): ProjectAutomationConfig => {
  const upstreamPolicy = policy("upstream-start", undefined, "upstream-gate");
  upstreamPolicy.trigger = "upstream-trigger";
  const sourcePolicy = policy("source-start", undefined, "source-gate");
  sourcePolicy.trigger = sourceStartTrigger;
  const targetPolicy = policy("target-start", undefined, "target-gate");
  targetPolicy.trigger = "source-gate.ready";
  const downstreamPolicy = policy("downstream-start", undefined, "final-gate");
  downstreamPolicy.trigger = "target-gate.done";
  const policyByLoopId = new Map([
    ["upstream", upstreamPolicy],
    ["source", sourcePolicy],
    ["target", targetPolicy],
    ["downstream", downstreamPolicy]
  ]);

  return {
    version: 1,
    actions: [
      { id: "upstream-gate", description: "Upstream gate", outputIds: ["ready", "blocked"], agentIds: [], humanGate: true },
      { id: "source-gate", description: "Source gate", outputIds: ["ready", "blocked"], agentIds: [], humanGate: true },
      { id: "target-gate", description: "Target gate", outputIds: ["done", "blocked"], agentIds: [], humanGate: true },
      { id: "final-gate", description: "Final gate", outputIds: ["done", "blocked"], agentIds: [], humanGate: true }
    ],
    outputs: [{ id: "ready" }, { id: "blocked" }, { id: "done" }],
    outputRoutes,
    humanGateResponses: [],
    policies: [upstreamPolicy, sourcePolicy, targetPolicy, downstreamPolicy],
    loops: loopIds.map((loopId) => {
      const loopPolicy = policyByLoopId.get(loopId);
      return {
        id: loopId,
        steps: loopPolicy ? [loopPolicy.id] : []
      };
    }),
    runtimes: []
  };
};

const compositeRecords = (config: ProjectAutomationConfig) => {
  const policyById = new Map(config.policies.map((item) => [item.id, item]));
  return new Map(config.loops.map((loop) => [loop.id, loop.steps.map((policyId, index) => {
    const policy = policyById.get(policyId);
    const outputTargets = policy ? loopOutputTargetsForPolicy(config, policy) : undefined;
    return {
      policyId,
      index,
      loopId: loop.id,
      policy,
      outputTargets,
      outputEvents: outputTargets?.flatMap((output) => "eventType" in output ? [output.eventType] : [])
    };
  })] as const));
};

const loopTestRectsOverlap = (
  firstNode: { x: number; y: number; width: number; height: number },
  secondNode: { x: number; y: number; width: number; height: number }
) => firstNode.x < secondNode.x + secondNode.width &&
  firstNode.x + firstNode.width > secondNode.x &&
  firstNode.y < secondNode.y + secondNode.height &&
  firstNode.y + firstNode.height > secondNode.y;

const loopRoutingTestNode = ({ id, x, y, width, height }: { id: string; x: number; y: number; width: number; height: number }): Node => ({
  id,
  position: { x, y },
  data: {},
  measured: { width, height },
  width,
  height
} as Node);

const firstRoutedPointMovingVertically = (points: number[][], sourceY: number) =>
  points.find((point) => typeof point[1] === "number" && Math.abs(point[1] - sourceY) > 0.5);

describe("loop layout helper modules", () => {
  it("keeps exported node anchor and output handle calculations stable", () => {
    expect(loopCanvasNodeAnchorY({ kind: "trigger", height: 99 })).toBe(loopCanvasLayoutConfig.triggerAnchorY);
    expect(loopCanvasNodeAnchorY({ kind: "policy", height: 99 })).toBe(loopCanvasLayoutConfig.policyAnchorY);
    expect(loopCanvasNodeAnchorY({ kind: "output-event", height: 46 })).toBe(23);
    expect(loopOutputSourceHandleId()).toBe("right");
    expect(loopPolicyOutputHandleY(-1, 3)).toBe(loopCanvasLayoutConfig.policyAnchorY);
    expect(loopPolicyOutputHandleY(99, 3)).toBe(loopNodeSizes.policy.height - loopCanvasLayoutConfig.edgePad / 2);
  });

  it("positions primary nodes through the extracted dagre layout helper", () => {
    const nodes = positionLoopNodes([
      {
        key: "trigger",
        kind: "trigger",
        width: loopNodeSizes.trigger.minWidth,
        height: loopNodeSizes.trigger.height,
        direction: "horizontal"
      },
      {
        key: "policy-0",
        kind: "policy",
        width: loopNodeSizes.policy.minWidth,
        height: loopNodeSizes.policy.height,
        direction: "horizontal"
      }
    ], [{ source: "trigger", target: "policy-0", label: "project.updated" }], "horizontal");

    const triggerNode = nodes.find((node) => node.key === "trigger");
    const policyNode = nodes.find((node) => node.key === "policy-0");

    expect(triggerNode).toMatchObject({
      x: loopCanvasLayoutConfig.startX,
      y: loopCanvasLayoutConfig.startY
    });
    expect(policyNode?.x).toBeGreaterThan((triggerNode?.x ?? 0) + loopNodeSizes.trigger.minWidth);
    expect(policyNode?.y).toBe(triggerNode?.y);
  });

  it("caps horizontal spacing for long edge labels", () => {
    const nodes = positionLoopNodes([
      {
        key: "trigger",
        kind: "trigger",
        width: loopNodeSizes.trigger.minWidth,
        height: loopNodeSizes.trigger.height,
        direction: "horizontal"
      },
      {
        key: "policy-0",
        kind: "policy",
        width: loopNodeSizes.policy.minWidth,
        height: loopNodeSizes.policy.height,
        direction: "horizontal"
      }
    ], [{ source: "trigger", target: "policy-0", label: "x".repeat(500) }], "horizontal");

    const policyNode = nodes.find((node) => node.key === "policy-0");

    expect(policyNode ? policyNode.x - loopCanvasLayoutConfig.startX : undefined).toBeLessThan(300);
  });

  it("keeps default smart edge routing for same-row edges and tightens cross-row routing", () => {
    expect(loopSmartEdgeRoutingOptions({ sourceY: 125.5, targetY: 125.5 })).toBe(smartEdgePresets.step);
    expect(loopSmartEdgeRoutingOptions({ sourceY: 125.5, targetY: 75.5 })).toMatchObject({
      gridRatio: 5,
      nodePadding: 6,
      drawEdge: smartEdgePresets.step.drawEdge,
      generatePath: smartEdgePresets.step.generatePath
    });
  });

  it("routes dev deployment cross-row forward edges toward the target row first", () => {
    const sourceY = 125.5;
    const targetY = 75.5;
    const nodes = [
      loopRoutingTestNode({ id: "trigger", x: 32, y: 64, width: 28, height: 22 }),
      loopRoutingTestNode({ id: "policy-0", x: 238, y: 64, width: 174, height: 22 }),
      loopRoutingTestNode({ id: "policy-1", x: 597, y: 64, width: 112, height: 22 }),
      loopRoutingTestNode({ id: "policy-3", x: 956, y: 64, width: 181, height: 22 }),
      loopRoutingTestNode({ id: "policy-6", x: 1315, y: 64, width: 112, height: 22 }),
      loopRoutingTestNode({ id: "policy-2", x: 597, y: 114, width: 132, height: 22 }),
      loopRoutingTestNode({ id: "policy-8", x: 956, y: 114, width: 118, height: 22 }),
      loopRoutingTestNode({ id: "output-event-8-ready", x: 1315, y: 114, width: 76, height: 22 }),
      loopRoutingTestNode({ id: "output-event-8-blocked", x: 1315, y: 160, width: 76, height: 22 })
    ];
    const baseParams = {
      sourceX: 730,
      sourceY,
      sourcePosition: Position.Right,
      targetX: 1315,
      targetY,
      targetPosition: Position.Left,
      nodes
    };
    const defaultRoute = getSmartEdge({
      ...baseParams,
      options: smartEdgePresets.step
    });
    const directedRoute = getSmartEdge({
      ...baseParams,
      options: loopSmartEdgeRoutingOptions({ sourceY, targetY })
    });

    expect(defaultRoute).not.toBeInstanceOf(Error);
    expect(directedRoute).not.toBeInstanceOf(Error);
    expect(defaultRoute instanceof Error ? undefined : firstRoutedPointMovingVertically(defaultRoute.points, sourceY)?.[1]).toBeGreaterThan(sourceY);
    expect(directedRoute instanceof Error ? undefined : firstRoutedPointMovingVertically(directedRoute.points, sourceY)?.[1]).toBeLessThan(sourceY);
  });

  it("centers labels on long nearly-horizontal routed edge segments", () => {
    expect(loopRoutedEdgeLabelAnchor({
      source: { x: 371, y: 295.5 },
      points: [
        { x: 371, y: 300 },
        { x: 371, y: 305 },
        { x: 371, y: 325 },
        { x: 655, y: 327 },
        { x: 659.5, y: 327 }
      ],
      target: { x: 659.5, y: 327 },
      fallback: { x: 640, y: 327 }
    })).toEqual({ x: 513, y: 326 });
  });

  it("centers bottom-source edge labels on the routed edge", () => {
    expect(loopEdgeLabelTransform({
      isReturnEdge: false,
      sourceX: 371,
      sourceY: 295.5,
      targetX: 659.5,
      targetY: 327
    })).toBe("translate(-50%, -50%) translate(515.25px, 311.25px)");
  });
});

describe("calculateLoopCanvasLayout", () => {
  it("uses selected action outputs as policy output events", () => {
    expect(policyOutputEventTypes({ action: "build" }, [{ id: "build", outputIds: ["complete", "failed"] }])).toEqual([
      "build.complete",
      "build.failed"
    ]);
  });

  it("creates a trigger and first-policy ghost for an empty loop", () => {
    const layout = layoutFor([], []);
    const triggerNode = layout.nodes.find((node) => node.key === "trigger");

    expect(layout.nodes.map((node) => node.kind)).toEqual(["trigger", "first-policy-ghost"]);
    expect(triggerNode).toMatchObject({
      width: loopNodeSizes.trigger.minWidth,
      height: loopNodeSizes.trigger.height
    });
    expect(layout.edges).toEqual([
      expect.objectContaining({
        key: "trigger-first-policy",
        sourceNodeKey: "trigger",
        targetNodeKey: "first-policy-ghost",
        sourceHandleId: "right",
        targetHandleId: "left",
        dashed: true
      })
    ]);
  });

  it("renders multiple unhandled outputs as separate output-event nodes", () => {
    const start = policy("start", undefined, "build");
    const layout = calculateLoopCanvasLayout({
      loopGraph: buildLoopGraph([{
        policyId: start.id,
        index: 0,
        policy: start,
        outputEvents: ["build.complete", "build.failed", "build.blocked"]
      }]),
      editingPolicyIndex: null
    });
    const outputEventNodes = layout.nodes.filter((node) => node.kind === "output-event");

    expect(outputEventNodes.map((node) => node.outputEvent?.eventType)).toEqual([
      "build.complete",
      "build.failed",
      "build.blocked"
    ]);
    expect(outputEventNodes.map((node) => node.key)).toEqual([
      "output-event-0-build.complete",
      "output-event-0-build.failed",
      "output-event-0-build.blocked"
    ]);
    expect(layout.edges.filter((edge) => edge.sourceNodeKey === "policy-0" && edge.targetNodeKey.startsWith("output-event-"))).toHaveLength(3);
  });

  it("does not render output nodes for an agentless action", () => {
    const start = policy("manual-gate", undefined, "manual-gate");
    const layout = calculateLoopCanvasLayout({
      loopGraph: buildLoopGraph([{
        policyId: start.id,
        index: 0,
        policy: start,
        outputEvents: policyOutputEventTypes(start, [{ id: "manual-gate", outputIds: ["complete"], agentIds: [] }])
      }]),
      editingPolicyIndex: null
    });

    expect(layout.nodes.some((node) => node.kind === "output-event")).toBe(false);
    expect(layout.edges.some((edge) => edge.sourceNodeKey === "policy-0" && edge.targetNodeKey.startsWith("output-event-"))).toBe(false);
  });

  it("keeps terminal output events beside the source policy edge", () => {
    const routeProject = policy("route-project", undefined, "route-project");
    const aggregateReview = policy("aggregate-review", "route-project.blocked", "aggregate-review");
    const layout = calculateLoopCanvasLayout({
      loopGraph: buildLoopGraph([
        {
          policyId: routeProject.id,
          index: 0,
          policy: routeProject,
          outputEvents: ["route-project.blocked"]
        },
        {
          policyId: aggregateReview.id,
          index: 1,
          policy: aggregateReview,
          outputEvents: [
            "aggregate-review.approved",
            "aggregate-review.changes-requested",
            "aggregate-review.blocked"
          ]
        }
      ]),
      editingPolicyIndex: null
    });
    const sourceNode = layout.nodes.find((node) => node.key === "policy-1");
    const outputEventNodes = [
      layout.nodes.find((node) => node.key === "output-event-1-aggregate-review.approved"),
      layout.nodes.find((node) => node.key === "output-event-1-aggregate-review.changes-requested"),
      layout.nodes.find((node) => node.key === "output-event-1-aggregate-review.blocked")
    ];

    expect(sourceNode).toBeDefined();
    expect(outputEventNodes.every(Boolean)).toBe(true);
    outputEventNodes.forEach((node) => expect(node?.x).toBeGreaterThan(sourceNode?.x ?? 0));
    const outputEventStep = loopNodeSizes.outputEvent.height + loopNodeSizes.outputEvent.rowGap;
    expect(outputEventNodes.map((node) => node?.y)).toEqual([
      sourceNode ? sourceNode.y : undefined,
      sourceNode ? sourceNode.y + outputEventStep : undefined,
      sourceNode ? sourceNode.y + outputEventStep * 2 : undefined
    ]);
  });

  it("renders every output target as an output-event node", () => {
    const start = policy("start", undefined, "build");
    const layout = calculateLoopCanvasLayout({
      loopGraph: buildLoopGraph([{
        policyId: start.id,
        index: 0,
        policy: start,
        outputEvents: ["build.failed"],
        outputTargets: [
          { outputId: "failed", eventType: "build.failed", type: "event" },
          { outputId: "summary", eventType: "build.summary", type: "event" }
        ]
      }]),
      editingPolicyIndex: null
    });
    const policyNode = layout.nodes.find((node) => node.key === "policy-0");
    const outputEventNode = layout.nodes.find((node) => node.key === "output-event-0-failed");
    const summaryOutputNode = layout.nodes.find((node) => node.key === "output-event-0-summary");

    expect(policyNode?.outputHandleCount).toBe(2);
    expect(outputEventNode).toMatchObject({
      kind: "output-event",
      outputEvent: { outputId: "failed", eventType: "build.failed", outputType: "event" },
      width: loopNodeSizes.outputEvent.minWidth
    });
    expect(summaryOutputNode).toMatchObject({
      kind: "output-event",
      outputEvent: { outputId: "summary", eventType: "build.summary", outputType: "event" },
      width: loopNodeSizes.outputEvent.minWidth
    });
    expect(summaryOutputNode?.y).toBe(outputEventNode
      ? outputEventNode.y + loopNodeSizes.outputEvent.height + loopNodeSizes.outputEvent.rowGap
      : undefined);
    expect(layout.edges).toContainEqual(expect.objectContaining({
      key: "policy-output-event-0-failed",
      sourceNodeKey: "policy-0",
      targetNodeKey: "output-event-0-failed",
      sourceHandleId: "bottom",
      targetHandleId: "bottom",
      dashed: true,
      eventType: "build.failed",
      label: "failed"
    }));
    expect(layout.edges).toContainEqual(expect.objectContaining({
      key: "policy-output-event-0-summary",
      sourceNodeKey: "policy-0",
      targetNodeKey: "output-event-0-summary",
      sourceHandleId: "right",
      targetHandleId: "left",
      dashed: true,
      eventType: "build.summary",
      label: "summary"
    }));
  });

  it("routes approval outputs from the right and same-row rework outputs through bottom handles", () => {
    const start = policy("start", undefined, "build");
    const completeHandler = policy("complete-handler", "build.complete", "done");
    const failedHandler = policy("failed-handler", "build.failed", "done");
    const layout = layoutFor([start, completeHandler, failedHandler], [
      start.id,
      completeHandler.id,
      failedHandler.id
    ]);

    expect(layout.edges.find((edge) => edge.eventType === "build.complete")).toMatchObject({
      sourceNodeKey: "policy-0",
      sourceHandleId: "right",
      targetHandleId: "left",
      label: "complete"
    });
    expect(layout.edges.find((edge) => edge.eventType === "build.failed")).toMatchObject({
      sourceNodeKey: "policy-0",
      sourceHandleId: "bottom",
      targetHandleId: "bottom",
      label: "failed"
    });
  });

  it("renders human gate action outputs without requiring agents", () => {
    const start = policy("human-review", undefined, "human-review");
    const outputEvents = policyOutputEventTypes(start, [{
      id: "human-review",
      outputIds: ["approved", "changes-requested"],
      agentIds: [],
      humanGate: true
    }]);
    const layout = calculateLoopCanvasLayout({
      loopGraph: buildLoopGraph([{
        policyId: start.id,
        index: 0,
        policy: start,
        outputEvents
      }]),
      editingPolicyIndex: null
    });
    const outputEventNodes = layout.nodes.filter((node) => node.kind === "output-event");

    expect(outputEvents).toEqual(["trigger.human-review.approved", "human-review.changes-requested"]);
    expect(outputEventNodes.map((node) => node.outputEvent?.outputId)).toEqual(["trigger.human-review.approved", "human-review.changes-requested"]);
    expect(layout.edges).toContainEqual(expect.objectContaining({
      key: "policy-output-event-0-trigger.human-review.approved",
      sourceNodeKey: "policy-0",
      targetNodeKey: "output-event-0-trigger.human-review.approved",
      sourceHandleId: "right",
      targetHandleId: "left",
      eventType: "trigger.human-review.approved",
      label: "approved"
    }));
  });

  it("places unhandled done output events after active child policies", () => {
    const start = policy("start", undefined, "design");
    const child = policy("release", "design.ready", "release");
    const layout = calculateLoopCanvasLayout({
      loopGraph: buildLoopGraph([
        {
          policyId: start.id,
          index: 0,
          policy: start,
          outputEvents: ["design.ready"],
          outputTargets: [
            { outputId: "ready", eventType: "design.ready", type: "event" },
            { outputId: "done", eventType: "design.done", type: "event" }
          ]
        },
        {
          policyId: child.id,
          index: 1,
          policy: child,
          outputEvents: ["release.complete"]
        }
      ]),
      editingPolicyIndex: null
    });
    const sourceNode = layout.nodes.find((node) => node.key === "policy-0");
    const childNode = layout.nodes.find((node) => node.key === "policy-1");
    const doneOutputNode = layout.nodes.find((node) => node.key === "output-event-0-done");

    expect(doneOutputNode).toBeDefined();
    expect(childNode).toBeDefined();
    expect(sourceNode).toBeDefined();
    expect(loopTestRectsOverlap(doneOutputNode!, childNode!)).toBe(false);
    expect(doneOutputNode!.x).toBe(childNode!.x);
    expect(doneOutputNode!.y).toBe(childNode!.y + childNode!.height + loopNodeSizes.outputEvent.rowGap);
  });

  it("places unhandled output events in the next policy column after active policies", () => {
    const first = policy("first", undefined, "build");
    const child = policy("child", "build.complete", "deploy");
    const layout = layoutFor([first, child], [first.id, child.id]);
    const firstNode = layout.nodes.find((node) => node.key === "policy-0");
    const childNode = layout.nodes.find((node) => node.key === "policy-1");
    const outputEventNode = layout.nodes.find((node) => node.key === "output-event-0-build.failed");
    const outputEventEdge = layout.edges.find((edge) => edge.key === "policy-output-event-0-build.failed");
    const triggerPolicyEdge = layout.edges.find((edge) => edge.key === "trigger-policy-0");
    const childPolicyEdge = layout.edges.find((edge) => edge.key === "policy-policy-0-1-build.complete");

    expect(layout.nodes.filter((node) => node.kind === "policy").map((node) => node.record?.policyId)).toEqual(["first", "child"]);
    expect(childNode?.x).toBeGreaterThan(firstNode?.x ?? 0);
    expect(childNode?.y).toBe(firstNode?.y);
    expect(layout.edges).toContainEqual(expect.objectContaining({
      key: "policy-policy-0-1-build.complete",
      sourceNodeKey: "policy-0",
      targetNodeKey: "policy-1",
      sourceHandleId: "right",
      targetHandleId: "left",
      eventType: "build.complete"
    }));
    expect(triggerPolicyEdge?.label).toBe("project.updated");
    expect(childPolicyEdge?.label).toBe("complete");
    expect(outputEventNode).toMatchObject({
      kind: "output-event",
      sourcePolicyId: first.id,
      outputEvent: { eventType: "build.failed" }
    });
    expect(outputEventEdge).toMatchObject({
      sourceNodeKey: "policy-0",
      targetNodeKey: "output-event-0-build.failed",
      sourceHandleId: "bottom",
      targetHandleId: "top",
      dashed: true,
      eventType: "build.failed",
      label: "failed"
    });
    expect(outputEventNode?.x).toBe(childNode?.x);
    expect(outputEventNode?.y).toBe(childNode
      ? childNode.y + loopPolicyStackHeight() + loopNodeSizes.outputEvent.rowGap
      : undefined);
    expect(layout.nodes.some((node) => node.kind === "output-event" && node.outputEvent?.eventType === "build.complete")).toBe(false);
  });

  it("reserves horizontal space for incoming policy edge labels", () => {
    const first = policy("first", undefined, "route-project");
    const child = policy("child", "review-intent.changes-requested", "analyze-intent");
    const layout = calculateLoopCanvasLayout({
      loopGraph: buildLoopGraph([
        {
          policyId: first.id,
          index: 0,
          policy: first,
          outputEvents: ["review-intent.changes-requested"]
        },
        {
          policyId: child.id,
          index: 1,
          policy: child,
          outputEvents: ["analyze-intent.ready"]
        }
      ]),
      editingPolicyIndex: null
    });
    const firstNode = layout.nodes.find((node) => node.key === "policy-0");
    const childNode = layout.nodes.find((node) => node.key === "policy-1");

    expect(firstNode).toBeDefined();
    expect(childNode).toBeDefined();
    expect(childNode!.x - (firstNode!.x + firstNode!.width)).toBeGreaterThan(120);
  });

  it("keeps the primary horizontal policy path on the trigger baseline and stacks branches compactly below it", () => {
    const first = policy("first", undefined, "build");
    const completeChild = policy("complete-child", "build.complete", "deploy");
    const failedChild = policy("failed-child", "build.failed", "debug");
    const layout = calculateLoopCanvasLayout({
      loopGraph: buildLoopGraph([
        {
          policyId: first.id,
          index: 0,
          policy: first,
          outputEvents: ["build.complete", "build.failed", "build.blocked"]
        },
        {
          policyId: completeChild.id,
          index: 1,
          policy: completeChild,
          outputEvents: ["deploy.complete"]
        },
        {
          policyId: failedChild.id,
          index: 2,
          policy: failedChild,
          outputEvents: ["debug.complete"]
        }
      ]),
      editingPolicyIndex: null
    });
    const triggerNode = layout.nodes.find((node) => node.key === "trigger");
    const firstNode = layout.nodes.find((node) => node.key === "policy-0");
    const completeChildNode = layout.nodes.find((node) => node.key === "policy-1");
    const failedChildNode = layout.nodes.find((node) => node.key === "policy-2");
    const outputEventNode = layout.nodes.find((node) => node.key === "output-event-0-build.blocked");

    expect(firstNode?.y).toBe(triggerNode?.y);
    expect(completeChildNode?.y).toBe(firstNode?.y);
    expect(failedChildNode?.y).toBe(firstNode ? firstNode.y + loopPolicyStackHeight() + loopCanvasLayoutConfig.branchGap : undefined);
    expect(outputEventNode?.x).toBe(completeChildNode?.x);
    expect(outputEventNode?.y).toBe(failedChildNode
      ? failedChildNode.y + loopPolicyStackHeight() + loopNodeSizes.outputEvent.rowGap
      : undefined);
  });

  it("reserves clearance below output ghost nodes before the next horizontal lane", () => {
    const createMilestones = policy("create-milestones", undefined, "create-milestones");
    createMilestones.trigger = "technical_plan_approved";
    const challengeMilestones = policy("challenge-milestones", "create-milestones.ready", "challenge-milestones");
    const reworkMilestones = policy("rework-milestones", "challenge-milestones.changes-requested", "create-milestones");
    const createTaskSpecs = policy("create-task-specs", undefined, "create-task-specs");
    createTaskSpecs.trigger = "milestones_approved";
    const challengeTaskSpecs = policy("challenge-task-specs", "create-task-specs.ready", "challenge-task-specs");
    const reworkTaskSpecs = policy("rework-task-specs", "challenge-task-specs.changes-requested", "create-task-specs");
    const layout = calculateLoopCanvasLayout({
      loopGraph: buildLoopGraph([
        {
          policyId: createMilestones.id,
          index: 0,
          policy: createMilestones,
          outputTargets: [
            { outputId: "ready", eventType: "create-milestones.ready", type: "event" },
            { outputId: "blocked", eventType: "create-milestones.blocked", type: "event" }
          ]
        },
        {
          policyId: challengeMilestones.id,
          index: 1,
          policy: challengeMilestones,
          outputTargets: [
            { outputId: "approved", eventType: "challenge-milestones.approved", type: "event" },
            { outputId: "changes-requested", eventType: "challenge-milestones.changes-requested", type: "event" }
          ]
        },
        {
          policyId: reworkMilestones.id,
          index: 2,
          policy: reworkMilestones,
          outputTargets: [
            { outputId: "ready", eventType: "create-milestones.ready", type: "event" },
            { outputId: "blocked", eventType: "create-milestones.blocked", type: "event" }
          ]
        },
        {
          policyId: createTaskSpecs.id,
          index: 3,
          policy: createTaskSpecs,
          outputTargets: [
            { outputId: "ready", eventType: "create-task-specs.ready", type: "event" },
            { outputId: "blocked", eventType: "create-task-specs.blocked", type: "event" }
          ]
        },
        {
          policyId: challengeTaskSpecs.id,
          index: 4,
          policy: challengeTaskSpecs,
          outputTargets: [
            { outputId: "approved", eventType: "challenge-task-specs.approved", type: "event" },
            { outputId: "changes-requested", eventType: "challenge-task-specs.changes-requested", type: "event" }
          ]
        },
        {
          policyId: reworkTaskSpecs.id,
          index: 5,
          policy: reworkTaskSpecs,
          outputTargets: [
            { outputId: "ready", eventType: "create-task-specs.ready", type: "event" },
            { outputId: "blocked", eventType: "create-task-specs.blocked", type: "event" }
          ]
        }
      ]),
      editingPolicyIndex: null
    });
    const createMilestonesNode = layout.nodes.find((node) => node.key === "policy-0");
    const challengeMilestonesNode = layout.nodes.find((node) => node.key === "policy-1");
    const createTaskSpecsNode = layout.nodes.find((node) => node.key === "policy-3");
    const blockedOutputNode = layout.nodes.find((node) => node.key === "output-event-0-blocked");

    expect(createMilestonesNode).toBeDefined();
    expect(challengeMilestonesNode).toBeDefined();
    expect(createTaskSpecsNode).toBeDefined();
    expect(blockedOutputNode).toBeDefined();
    expect(blockedOutputNode?.y).toBe(challengeMilestonesNode
      ? challengeMilestonesNode.y + loopPolicyStackHeight() + loopNodeSizes.outputEvent.rowGap
      : undefined);
    expect(createTaskSpecsNode?.y).toBe(createMilestonesNode
      ? createMilestonesNode.y +
        loopPolicyStackHeight() +
        loopNodeSizes.outputEvent.rowGap +
        loopNodeSizes.outputEvent.height +
        loopCanvasLayoutConfig.outputEventLaneClearance +
        loopCanvasLayoutConfig.branchGap
      : undefined);
    expect(createTaskSpecsNode && blockedOutputNode
      ? createTaskSpecsNode.y - (blockedOutputNode.y + blockedOutputNode.height)
      : undefined).toBe(loopCanvasLayoutConfig.outputEventLaneClearance + loopCanvasLayoutConfig.branchGap);
  });

  it("keeps folded approval edges on right-to-left handles even when they return to an earlier canonical node", () => {
    const createMilestones = policy("create-milestones", undefined, "create-milestones");
    createMilestones.trigger = "technical_plan_approved";
    const challengeMilestones = policy("challenge-milestones", "create-milestones.ready", "challenge-milestones");
    const reworkMilestones = policy("rework-milestones", "challenge-milestones.changes-requested", "create-milestones");
    const doneMilestones = policy("done-milestones", "challenge-milestones.approved", "done");
    const createTaskSpecs = policy("create-task-specs", undefined, "create-task-specs");
    createTaskSpecs.trigger = "milestones_approved";
    const challengeTaskSpecs = policy("challenge-task-specs", "create-task-specs.ready", "challenge-task-specs");
    const reworkTaskSpecs = policy("rework-task-specs", "challenge-task-specs.changes-requested", "create-task-specs");
    const doneTaskSpecs = policy("done-task-specs", "challenge-task-specs.approved", "done");
    const layout = calculateLoopCanvasLayout({
      loopGraph: buildLoopGraph([
        {
          policyId: createMilestones.id,
          index: 0,
          policy: createMilestones,
          outputTargets: [
            { outputId: "ready", eventType: "create-milestones.ready", type: "event" },
            { outputId: "blocked", eventType: "create-milestones.blocked", type: "event" }
          ]
        },
        {
          policyId: challengeMilestones.id,
          index: 1,
          policy: challengeMilestones,
          outputTargets: [
            { outputId: "approved", eventType: "challenge-milestones.approved", type: "event" },
            { outputId: "changes-requested", eventType: "challenge-milestones.changes-requested", type: "event" }
          ]
        },
        {
          policyId: reworkMilestones.id,
          index: 2,
          policy: reworkMilestones,
          outputTargets: [
            { outputId: "ready", eventType: "create-milestones.ready", type: "event" },
            { outputId: "blocked", eventType: "create-milestones.blocked", type: "event" }
          ]
        },
        { policyId: doneMilestones.id, index: 3, policy: doneMilestones, outputTargets: [] },
        {
          policyId: createTaskSpecs.id,
          index: 4,
          policy: createTaskSpecs,
          outputTargets: [
            { outputId: "ready", eventType: "create-task-specs.ready", type: "event" },
            { outputId: "blocked", eventType: "create-task-specs.blocked", type: "event" }
          ]
        },
        {
          policyId: challengeTaskSpecs.id,
          index: 5,
          policy: challengeTaskSpecs,
          outputTargets: [
            { outputId: "approved", eventType: "challenge-task-specs.approved", type: "event" },
            { outputId: "changes-requested", eventType: "challenge-task-specs.changes-requested", type: "event" }
          ]
        },
        {
          policyId: reworkTaskSpecs.id,
          index: 6,
          policy: reworkTaskSpecs,
          outputTargets: [
            { outputId: "ready", eventType: "create-task-specs.ready", type: "event" },
            { outputId: "blocked", eventType: "create-task-specs.blocked", type: "event" }
          ]
        },
        { policyId: doneTaskSpecs.id, index: 7, policy: doneTaskSpecs, outputTargets: [] }
      ]),
      editingPolicyIndex: null
    });

    expect(layout.edges.find((edge) => edge.eventType === "challenge-task-specs.approved")).toMatchObject({
      sourceNodeKey: "policy-5",
      targetNodeKey: "policy-3",
      sourceHandleId: "right",
      targetHandleId: "left",
      tone: "return",
      label: "approved"
    });
  });

  it("keeps return approval edges away from top and bottom handles in implementation review loops", () => {
    const implementTask = policy("implement-task", undefined, "implement-task");
    implementTask.trigger = "task_specs_approved";
    const runTests = policy("run-tests", "implement-task.ready", "run-tests");
    const classifyFailure = policy("classify-failure", "implement-task.blocked", "classify-failure");
    const reworkImplementTask = policy("rework-implement-task", "classify-failure.ready", "implement-task");
    const layout = calculateLoopCanvasLayout({
      loopGraph: buildLoopGraph([
        {
          policyId: implementTask.id,
          index: 0,
          policy: implementTask,
          outputTargets: [
            { outputId: "ready", eventType: "implement-task.ready", type: "event" },
            { outputId: "blocked", eventType: "implement-task.blocked", type: "event" }
          ]
        },
        {
          policyId: runTests.id,
          index: 1,
          policy: runTests,
          outputTargets: [
            { outputId: "ready", eventType: "run-tests.ready", type: "event" },
            { outputId: "failed", eventType: "run-tests.failed", type: "event" }
          ]
        },
        {
          policyId: classifyFailure.id,
          index: 2,
          policy: classifyFailure,
          outputTargets: [
            { outputId: "ready", eventType: "classify-failure.ready", type: "event" },
            { outputId: "blocked", eventType: "classify-failure.blocked", type: "event" }
          ]
        },
        {
          policyId: reworkImplementTask.id,
          index: 7,
          policy: reworkImplementTask,
          outputTargets: [
            { outputId: "ready", eventType: "implement-task.ready", type: "event" },
            { outputId: "blocked", eventType: "implement-task.blocked", type: "event" }
          ]
        }
      ]),
      editingPolicyIndex: null
    });

    expect(layout.edges.find((edge) => edge.eventType === "classify-failure.ready")).toMatchObject({
      sourceNodeKey: "policy-2",
      targetNodeKey: "policy-0",
      sourceHandleId: "right",
      targetHandleId: "left",
      tone: "return",
      label: "ready"
    });
  });

  it("lays out child event policies below the source policy in vertical mode", () => {
    const first = policy("first", undefined, "build");
    const child = policy("child", "build.complete", "deploy");
    const layout = layoutFor([first, child], [first.id, child.id], null, "vertical");
    const triggerNode = layout.nodes.find((node) => node.key === "trigger");
    const firstNode = layout.nodes.find((node) => node.key === "policy-0");
    const childNode = layout.nodes.find((node) => node.key === "policy-1");
    const outputEventNode = layout.nodes.find((node) => node.key === "output-event-0-build.failed");
    const triggerPolicyEdge = layout.edges.find((edge) => edge.key === "trigger-policy-0");

    expect(layout.direction).toBe("vertical");
    expect(triggerNode ? triggerNode.x + triggerNode.width / 2 : undefined).toBe(firstNode ? firstNode.x + firstNode.width / 2 : undefined);
    expect(childNode?.y).toBeGreaterThan(firstNode?.y ?? 0);
    expect(outputEventNode?.x).toBe(childNode ? childNode.x + childNode.width + loopCanvasLayoutConfig.branchGap : undefined);
    expect(outputEventNode?.y).toBe(childNode?.y);
    expect(triggerPolicyEdge).toMatchObject({
      sourceHandleId: "right",
      targetHandleId: "left",
      label: "project.updated"
    });
    expect(layout.edges).toContainEqual(expect.objectContaining({
      key: "policy-policy-0-1-build.complete",
      sourceHandleId: "right",
      targetHandleId: "left"
    }));
  });

  it("links repeated output events directly to existing handler policies", () => {
    const implement = (id: string, event: string | undefined): ProjectPolicy => ({
      id,
      source: event ? "event" : "trigger",
      event,
      trigger: event ? undefined : "plan_approved",
      action: "implement",
      enabled: true
    });
    const review: ProjectPolicy = {
      id: "architect-review",
      source: "event",
      event: "implement.completed",
      action: "review",
      enabled: true
    };
    const records: LoopStepRecord[] = [
      {
        policyId: "developer-implement-initial",
        index: 0,
        policy: implement("developer-implement-initial", undefined),
        outputEvents: ["implement.completed", "implement.failed"]
      },
      {
        policyId: review.id,
        index: 1,
        policy: review,
        outputEvents: ["review.accepted", "review.rejected"]
      },
      {
        policyId: "developer-implement-rework",
        index: 2,
        policy: implement("developer-implement-rework", "review.rejected"),
        outputEvents: ["implement.completed", "implement.failed"]
      }
    ];
    const layout = calculateLoopCanvasLayout({
      loopGraph: buildLoopGraph(records),
      editingPolicyIndex: null
    });

    const returnEdge = layout.edges.find((edge) => edge.key === "policy-policy-1-0-2-review.rejected");
    const policyNodes = layout.nodes.filter((node) => node.kind === "policy");
    const foldedImplementNode = layout.nodes.find((node) => node.key === "policy-0");
    const reworkPolicyNode = layout.nodes.find((node) => node.key === "policy-2");
    const reworkOutputEventNodes = layout.nodes.filter((node) => node.kind === "output-event" && node.record?.index === 2);

    expect(policyNodes.map((node) => node.record?.policyId)).toEqual([
      "developer-implement-initial",
      "architect-review"
    ]);
    expect(foldedImplementNode?.records?.map((record) => record.policyId)).toEqual([
      "developer-implement-initial",
      "developer-implement-rework"
    ]);
    expect(reworkPolicyNode).toBeUndefined();
    expect(returnEdge).toBeDefined();
    expect(returnEdge).toMatchObject({
      sourceNodeKey: "policy-1",
      targetNodeKey: "policy-0",
      sourceHandleId: "top",
      targetHandleId: "top",
      tone: "return",
      eventType: "review.rejected",
      label: "rejected"
    });
    expect(reworkOutputEventNodes).toHaveLength(0);
  });

  it("folds roadmap rework into the original create-roadmap node", () => {
    const createRoadmap = policy("p05.on.project-brief-gate-approved.create-roadmap", undefined, "create-roadmap");
    createRoadmap.trigger = "project-brief-gate.approved";
    const challengeRoadmap = policy("p06.on.roadmap-ready.challenge-roadmap", "create-roadmap.ready", "challenge-roadmap");
    const reworkRoadmap = policy("p07.on.roadmap-rework.create-roadmap", "challenge-roadmap.changes-requested", "create-roadmap");
    const done = policy("p08.on.roadmap-approved.done", "challenge-roadmap.approved", "done");
    const records: LoopStepRecord[] = [
      {
        policyId: createRoadmap.id,
        index: 0,
        policy: createRoadmap,
        outputTargets: [
          { outputId: "ready", eventType: "create-roadmap.ready", type: "event" },
          { outputId: "blocked", eventType: "create-roadmap.blocked", type: "event" }
        ]
      },
      {
        policyId: challengeRoadmap.id,
        index: 1,
        policy: challengeRoadmap,
        outputTargets: [
          { outputId: "approved", eventType: "challenge-roadmap.approved", type: "event" },
          { outputId: "changes-requested", eventType: "challenge-roadmap.changes-requested", type: "event" }
        ]
      },
      {
        policyId: reworkRoadmap.id,
        index: 2,
        policy: reworkRoadmap,
        outputTargets: [
          { outputId: "ready", eventType: "create-roadmap.ready", type: "event" },
          { outputId: "blocked", eventType: "create-roadmap.blocked", type: "event" }
        ]
      },
      {
        policyId: done.id,
        index: 3,
        policy: done,
        outputTargets: []
      }
    ];
    const layout = calculateLoopCanvasLayout({
      loopGraph: buildLoopGraph(records),
      editingPolicyIndex: null
    });
    const policyNodes = layout.nodes.filter((node) => node.kind === "policy");
    const returnEdge = layout.edges.find((edge) => edge.eventType === "challenge-roadmap.changes-requested");

    expect(policyNodes.map((node) => node.record?.policy?.action)).toEqual([
      "create-roadmap",
      "challenge-roadmap",
      "done"
    ]);
    expect(layout.nodes.find((node) => node.key === "policy-2")).toBeUndefined();
    expect(layout.nodes.filter((node) => node.kind === "output-event" && node.record?.index === 2)).toHaveLength(0);
    expect(layout.nodes.find((node) => node.key === "policy-0")?.records?.map((record) => record.policyId)).toEqual([
      "p05.on.project-brief-gate-approved.create-roadmap",
      "p07.on.roadmap-rework.create-roadmap"
    ]);
    expect(returnEdge).toMatchObject({
      sourceNodeKey: "policy-1",
      targetNodeKey: "policy-0",
      tone: "return",
      label: "changes-requested"
    });
  });
});

describe("calculateCompositeLoopCanvasLayout", () => {
  it("keeps a selected loop alone when no loop starts from its derived trigger", () => {
    const config = compositeConfig(["source", "observer"]);
    const layout = calculateCompositeLoopCanvasLayout({
      config,
      selectedLoopId: "source",
      recordsByLoopId: compositeRecords(config)
    });

    expect(layout.nodes.map((node) => node.key)).toEqual(expect.arrayContaining([
      "loop:source:trigger",
      "loop:source:policy-0",
      "loop:source:output-event-0-ready",
      "loop:source:output-event-0-blocked"
    ]));
    expect(layout.nodes.some((node) => node.key.startsWith("loop:observer:"))).toBe(false);
  });

  it("renders a derived trigger target loop as a compact loop node below the selected loop", () => {
    const config = compositeConfig(["source", "target"]);
    const layout = calculateCompositeLoopCanvasLayout({
      config,
      selectedLoopId: "source",
      recordsByLoopId: compositeRecords(config)
    });
    const sourceTrigger = layout.nodes.find((node) => node.key === "loop:source:trigger");
    const targetLoop = layout.nodes.find((node) => node.key === "loop:target:loop");
    const crossEdge = layout.edges.find((edge) => edge.key === "loop:source:output:0:ready:to:target:loop");

    expect(layout.nodes.every((node) => node.key.startsWith("loop:"))).toBe(true);
    expect(new Set(layout.nodes.map((node) => node.key)).size).toBe(layout.nodes.length);
    expect(layout.nodes.map((node) => node.key)).toEqual(expect.arrayContaining([
      "loop:source:trigger",
      "loop:source:policy-0",
      "loop:target:loop"
    ]));
    expect(layout.nodes.find((node) => node.key === "loop:target:trigger")).toBeUndefined();
    expect(layout.nodes.find((node) => node.key === "loop:target:policy-0")).toBeUndefined();
    expect(layout.nodes.find((node) => node.key === "loop:source:output-event-0-ready")).toBeUndefined();
    expect(targetLoop).toMatchObject({
      kind: "loop",
      width: loopNodeSizes.loop.minWidth,
      height: loopNodeSizes.loop.height,
      loopSummary: {
        loopId: "target",
        label: "target gate loop",
        trigger: "source-gate.ready",
        action: "target-gate"
      }
    });
    expect(targetLoop?.y).toBeGreaterThan(sourceTrigger?.y ?? 0);
    expect(targetLoop?.y).toBe(
      Math.max(
        ...layout.nodes
          .filter((node) => node.loopId === "source" && node.kind !== "loop")
          .map((node) => node.y + node.height)
      ) + loopCanvasLayoutConfig.selectedCompactLoopRowGap
    );
    expect(crossEdge).toMatchObject({
      sourceNodeKey: "loop:source:policy-0",
      targetNodeKey: "loop:target:loop",
      sourceHandleId: "right",
      targetHandleId: "left",
      eventType: "trigger.source-gate.ready",
      label: "ready",
      tone: "cross-loop"
    });
  });

  it("routes cross-loop approval outputs and keeps rework outputs local", () => {
    const config = compositeConfig(["source", "target"]);
    const layout = calculateCompositeLoopCanvasLayout({
      config,
      selectedLoopId: "source",
      recordsByLoopId: compositeRecords(config)
    });

    expect(layout.edges.find((edge) => edge.key === "loop:source:output:0:ready:to:target:loop")).toMatchObject({
      sourceNodeKey: "loop:source:policy-0",
      targetNodeKey: "loop:target:loop",
      sourceHandleId: "right",
      targetHandleId: "left",
      label: "ready",
      tone: "cross-loop"
    });
    expect(layout.nodes.find((node) => node.key === "loop:source:output-event-0-blocked")).toBeDefined();
    expect(layout.edges.find((edge) => edge.key === "loop:source:output:0:blocked:to:target:loop")).toBeUndefined();
  });

  it("renders upstream loops as compact loop nodes above the selected loop", () => {
    const config = compositeConfig(["upstream", "source"], [], "upstream-gate.ready");
    const layout = calculateCompositeLoopCanvasLayout({
      config,
      selectedLoopId: "source",
      recordsByLoopId: compositeRecords(config)
    });
    const sourceTrigger = layout.nodes.find((node) => node.key === "loop:source:trigger");
    const upstreamLoop = layout.nodes.find((node) => node.key === "loop:upstream:loop");
    const crossEdge = layout.edges.find((edge) => edge.key === "loop:upstream:output:0:ready:to:source:loop");

    expect(sourceTrigger).toBeDefined();
    expect(upstreamLoop).toMatchObject({
      kind: "loop",
      loopSummary: {
        loopId: "upstream",
        label: "upstream gate loop"
      }
    });
    expect(upstreamLoop?.y).toBeLessThan(sourceTrigger?.y ?? 0);
    expect((sourceTrigger?.y ?? 0) - ((upstreamLoop?.y ?? 0) + loopNodeSizes.loop.height)).toBe(
      loopCanvasLayoutConfig.selectedCompactLoopRowGap
    );
    expect(layout.nodes.find((node) => node.key === "loop:upstream:policy-0")).toBeUndefined();
    expect(crossEdge).toMatchObject({
      sourceNodeKey: "loop:upstream:loop",
      targetNodeKey: "loop:source:trigger",
      label: "ready",
      tone: "cross-loop"
    });
  });

  it("does not route rework outputs to target loops automatically", () => {
    const config = compositeConfig(["target", "source"]);
    const layout = calculateCompositeLoopCanvasLayout({
      config,
      selectedLoopId: "source",
      recordsByLoopId: compositeRecords(config)
    });

    expect(layout.nodes.find((node) => node.key === "loop:source:output-event-0-blocked")).toBeDefined();
    expect(layout.edges.find((edge) => edge.key === "loop:source:output:0:blocked:to:target:loop")).toBeUndefined();
  });

  it("protects circular derived trigger loop references from recursive layout", () => {
    const config = compositeConfig(["source", "target"], [], "target-gate.done");
    const layout = calculateCompositeLoopCanvasLayout({
      config,
      selectedLoopId: "source",
      recordsByLoopId: compositeRecords(config)
    });

    expect(layout.nodes.filter((node) => node.kind === "trigger")).toHaveLength(1);
    expect(layout.nodes.filter((node) => node.kind === "policy")).toHaveLength(1);
    expect(layout.nodes.filter((node) => node.kind === "loop")).toHaveLength(1);
    expect(layout.edges.filter((edge) => edge.tone === "cross-loop")).toHaveLength(2);
    expect(new Set(layout.nodes.map((node) => node.key)).size).toBe(layout.nodes.length);
  });

  it("orders branching compact loop successors by config order on the downstream row", () => {
    const config = compositeConfig(["source", "target", "downstream"]);
    config.actions.push({
      id: "branch-gate",
      description: "Branch gate",
      outputIds: ["ready", "blocked"],
      agentIds: [],
      humanGate: true
    });
    config.policies.push({
      id: "branch-source",
      source: "event",
      event: "source-gate.blocked",
      action: "branch-gate",
      enabled: true
    });
    const sourceLoop = config.loops.find((loop) => loop.id === "source");
    sourceLoop?.steps.push("branch-source");
    const branchPolicy = policy("branch-start", undefined, "final-gate");
    branchPolicy.trigger = "branch-gate.ready";
    config.policies.push(branchPolicy);
    config.loops.push({ id: "branch", steps: [branchPolicy.id] });
    const layout = calculateCompositeLoopCanvasLayout({
      config,
      selectedLoopId: "source",
      recordsByLoopId: compositeRecords(config)
    });
    const targetLoop = layout.nodes.find((node) => node.key === "loop:target:loop");
    const branchLoop = layout.nodes.find((node) => node.key === "loop:branch:loop");

    expect(targetLoop).toBeDefined();
    expect(branchLoop).toBeDefined();
    expect(targetLoop?.y).toBe(branchLoop?.y);
    expect(targetLoop ? branchLoop?.x : undefined).toBeGreaterThan(targetLoop?.x ?? 0);
    expect(layout.edges.find((edge) => edge.key === "loop:source:output:0:ready:to:target:loop")).toMatchObject({
      label: "ready",
      tone: "cross-loop"
    });
    expect(layout.edges.find((edge) => edge.key === "loop:source:output:1:ready:to:branch:loop")).toMatchObject({
      label: "ready",
      tone: "cross-loop"
    });
  });
});

describe("calculateAllLoopsCanvasLayout", () => {
  it("renders every configured loop row and keeps cross-loop trigger edges", () => {
    const config = compositeConfig(["source", "target", "observer"]);
    const layout = calculateAllLoopsCanvasLayout({
      config,
      recordsByLoopId: compositeRecords(config)
    });
    const sourceTrigger = layout.nodes.find((node) => node.key === "loop:source:trigger");
    const targetTrigger = layout.nodes.find((node) => node.key === "loop:target:trigger");
    const observerTrigger = layout.nodes.find((node) => node.key === "loop:observer:trigger");
    const crossEdge = layout.edges.find((edge) => edge.key === "loop:source:output:0:ready:to:target:trigger");

    expect(sourceTrigger).toBeDefined();
    expect(targetTrigger).toBeDefined();
    expect(observerTrigger).toBeDefined();
    expect(layout.nodes.find((node) => node.key === "loop:source:output-event-0-ready")).toBeUndefined();
    expect(crossEdge).toMatchObject({
      sourceNodeKey: "loop:source:policy-0",
      targetNodeKey: "loop:target:trigger",
      sourceHandleId: "right",
      targetHandleId: "left",
      label: "ready",
      tone: "cross-loop"
    });
  });
});

describe("toLoopReactFlowEdges", () => {
  it("anchors stepped loop edge labels to the longest horizontal segment", () => {
    expect(loopRoutedEdgeLabelAnchor({
      source: { x: 412, y: 75.5 },
      points: [
        { x: 420, y: 75.5 },
        { x: 430, y: 75.5 },
        { x: 430, y: 100 },
        { x: 430, y: 113.5 },
        { x: 630, y: 113.5 }
      ],
      target: { x: 644, y: 113.5 },
      fallback: { x: 785, y: 145 }
    })).toEqual({ x: 530, y: 113.5 });

    expect(loopRoutedEdgeLabelAnchor({
      source: { x: 412, y: 75.5 },
      points: [
        { x: 420, y: 75.5 },
        { x: 430, y: 75.5 },
        { x: 630, y: 75.5 }
      ],
      target: { x: 644, y: 75.5 },
      fallback: { x: 785, y: 126 }
    })).toEqual({ x: 530, y: 75.5 });
  });

  it("falls back to the smart edge center when there is no horizontal label segment", () => {
    expect(loopRoutedEdgeLabelAnchor({
      source: { x: 0, y: 0 },
      points: [{ x: 10, y: 10 }],
      target: { x: 20, y: 20 },
      fallback: { x: 11, y: 12 }
    })).toEqual({ x: 11, y: 12 });
  });

  it("centers return edge labels on the top or bottom return segment", () => {
    const sourceNode = { key: "policy-2", kind: "policy" as const, x: 300, y: 120, width: 140, height: 22, direction: "horizontal" as const };
    const topTargetNode = { key: "policy-1", kind: "policy" as const, x: 120, y: 40, width: 140, height: 22, direction: "horizontal" as const };
    const bottomTargetNode = { ...topTargetNode, y: 220 };
    const baseProps = {
      id: "event-policy-2-1-complete",
      source: "policy-2",
      target: "policy-1",
      selected: false,
      sourceX: 370,
      sourceY: 120,
      targetX: 190,
      targetY: 40
    };

    const topReturnPath = loopReturnEdgePath({
      ...baseProps,
      targetY: topTargetNode.y,
      data: {
        loopEdge: {
          key: "event-policy-2-1-complete",
          sourceNodeKey: "policy-2",
          targetNodeKey: "policy-1",
          sourceHandleId: "top",
          targetHandleId: "top",
          tone: "return"
        },
        sourceNode,
        targetNode: topTargetNode
      }
    });

    expect(topReturnPath.labelY).toBe(topTargetNode.y - 28);
    expect(topReturnPath.startLabelX).toBe(sourceNode.x + sourceNode.width / 2);
    expect(topReturnPath.startLabelY).toBe(sourceNode.y - 4);
    expect(topReturnPath.endLabelX).toBe(topTargetNode.x + topTargetNode.width / 2);
    expect(topReturnPath.endLabelY).toBe(topTargetNode.y - 4);
    expect(loopReturnEdgePath({
      ...baseProps,
      targetY: topTargetNode.y,
      data: {
        loopEdge: {
          key: "event-policy-2-1-complete",
          sourceNodeKey: "policy-2",
          targetNodeKey: "policy-1",
          sourceHandleId: "top",
          targetHandleId: "top",
          tone: "return"
        },
        sourceNode,
        targetNode: topTargetNode
      }
    }).path.startsWith(`M ${sourceNode.x + sourceNode.width / 2},${sourceNode.y}`)).toBe(true);
    expect(loopReturnEdgePath({
      ...baseProps,
      targetY: bottomTargetNode.y + bottomTargetNode.height,
      data: {
        loopEdge: {
          key: "event-policy-2-1-complete",
          sourceNodeKey: "policy-2",
          targetNodeKey: "policy-1",
          sourceHandleId: "top",
          targetHandleId: "bottom",
          tone: "return"
        },
        sourceNode,
        targetNode: bottomTargetNode
      }
    }).labelY).toBe(bottomTargetNode.y + bottomTargetNode.height + 28);
  });

  it("maps loop layout edges to smart ReactFlow edges", () => {
    const [edge] = toLoopReactFlowEdges([{
      key: "event-policy-2-1-implementation.complete",
      sourceNodeKey: "policy-2",
      targetNodeKey: "policy-1",
      sourceHandleId: "top",
      targetHandleId: "top",
      dashed: true,
      tone: "return",
      eventType: "implementation.complete",
      label: "complete"
    }]);

    expect(edge).toMatchObject({
      id: "event-policy-2-1-implementation.complete",
      type: "loopSmart",
      source: "policy-2",
      target: "policy-1",
      sourceHandle: "top",
      targetHandle: "top",
      selectable: false,
      focusable: false,
      reconnectable: false,
      interactionWidth: 16
    });
    expect(edge.type).not.toBe("smoothstep");
    expect(edge.domAttributes).toMatchObject({
      "data-loop-connector": "true",
      "data-dashed": "false",
      "data-loop-edge-tone": "return",
      "data-loop-edge-animated": "false"
    });
    expect(edge.animated).toBe(false);
    expect(edge.data?.loopEdge.eventType).toBe("implementation.complete");
    expect(edge.data?.loopEdge.label).toBe("complete");
    expect(edge.style).toMatchObject({
      stroke: "color-mix(in srgb, var(--secondary) 58%, var(--muted-foreground))",
      strokeWidth: 2,
      opacity: 0.75
    });
    expect(edge.style?.strokeDasharray).toBeUndefined();
    expect(edge.style?.strokeLinecap).toBeUndefined();
    expect(edge.markerEnd).toBeUndefined();
  });

  it("maps every loop edge to SmartStepEdge", () => {
    const edges = toLoopReactFlowEdges([
      {
        key: "policy-policy-0-1-build.complete",
        sourceNodeKey: "policy-0",
        targetNodeKey: "policy-1",
        sourceHandleId: "right",
        targetHandleId: "left"
      },
      {
        key: "policy-output-event-0-done",
        sourceNodeKey: "policy-0",
        targetNodeKey: "output-event-0-done",
        sourceHandleId: "right",
        targetHandleId: "left"
      },
      {
        key: "policy-output-event-0-build.failed",
        sourceNodeKey: "policy-0",
        targetNodeKey: "output-event-0-build.failed",
        sourceHandleId: "right",
        targetHandleId: "left"
      }
    ]);

    expect(edges.map((edge) => edge.type)).toEqual(["loopSmart", "loopSmart", "loopSmart"]);
  });

  it("maps same-loop approval edges to the green-gray output stroke", () => {
    const [edge] = toLoopReactFlowEdges([{
      key: "policy-policy-0-1-build.complete",
      sourceNodeKey: "policy-0",
      targetNodeKey: "policy-1",
      sourceHandleId: "right",
      targetHandleId: "left",
      route: {
        outputId: "complete"
      }
    }]);

    expect(edge.domAttributes).toMatchObject({
      "data-loop-edge-output-slot-kind": "approval"
    });
    expect(edge.style).toMatchObject({
      stroke: "color-mix(in srgb, var(--secondary) 58%, var(--muted-foreground))",
      strokeWidth: 2,
      opacity: 0.75
    });
    expect(edge.style?.strokeDasharray).toBeUndefined();
    expect(edge.style?.strokeLinecap).toBeUndefined();
  });

  it("maps same-loop rework edges to the red-gray output stroke", () => {
    const [edge] = toLoopReactFlowEdges([{
      key: "policy-policy-0-1-build.failed",
      sourceNodeKey: "policy-0",
      targetNodeKey: "policy-1",
      sourceHandleId: "right",
      targetHandleId: "left",
      route: {
        outputId: "failed"
      }
    }]);

    expect(edge.domAttributes).toMatchObject({
      "data-loop-edge-output-slot-kind": "rework"
    });
    expect(edge.style).toMatchObject({
      stroke: "color-mix(in srgb, var(--destructive) 58%, var(--muted-foreground))",
      strokeWidth: 2,
      opacity: 0.75
    });
    expect(edge.style?.strokeDasharray).toBeUndefined();
    expect(edge.style?.strokeLinecap).toBeUndefined();
  });

  it("keeps dashed output-event edges on the muted ghost fallback even for rework outputs", () => {
    const [edge] = toLoopReactFlowEdges([{
      key: "policy-output-event-0-blocked",
      sourceNodeKey: "policy-0",
      targetNodeKey: "output-event-0-blocked",
      sourceHandleId: "right",
      targetHandleId: "left",
      dashed: true,
      route: {
        outputId: "blocked"
      },
      label: "blocked"
    }]);

    expect(edge.domAttributes).toMatchObject({
      "data-dashed": "true",
      "data-loop-edge-output-slot-kind": "rework"
    });
    expect(edge.style).toMatchObject({
      stroke: "color-mix(in srgb, var(--muted-foreground) 35%, transparent)",
      strokeWidth: 2,
      strokeDasharray: "6 5",
      opacity: 0.6
    });
    expect(edge.style?.strokeLinecap).toBeUndefined();
  });

  it("maps cross-loop approval edges to the green-gray dotted output stroke", () => {
    const [edge] = toLoopReactFlowEdges([{
      key: "loop:source:output:0:ready:to:target:trigger",
      sourceNodeKey: "loop:source:policy-0",
      targetNodeKey: "loop:target:trigger",
      sourceHandleId: "right",
      targetHandleId: "left",
      tone: "cross-loop",
      route: {
        outputId: "approved"
      }
    }]);

    expect(edge.domAttributes).toMatchObject({
      "data-loop-edge-tone": "cross-loop",
      "data-loop-edge-output-slot-kind": "approval"
    });
    expect(edge.style).toMatchObject({
      stroke: "color-mix(in srgb, var(--secondary) 58%, var(--muted-foreground))",
      strokeWidth: 2,
      strokeDasharray: "1 5",
      strokeLinecap: "round",
      opacity: 0.75
    });
  });

  it("maps cross-loop rework edges to the red-gray dotted output stroke", () => {
    const [edge] = toLoopReactFlowEdges([{
      key: "loop:source:output:0:changes-requested:to:target:trigger",
      sourceNodeKey: "loop:source:policy-0",
      targetNodeKey: "loop:target:trigger",
      sourceHandleId: "right",
      targetHandleId: "left",
      tone: "cross-loop",
      route: {
        outputId: "changes-requested"
      }
    }]);

    expect(edge.domAttributes).toMatchObject({
      "data-loop-edge-tone": "cross-loop",
      "data-loop-edge-output-slot-kind": "rework"
    });
    expect(edge.style).toMatchObject({
      stroke: "color-mix(in srgb, var(--destructive) 58%, var(--muted-foreground))",
      strokeWidth: 2,
      strokeDasharray: "1 5",
      strokeLinecap: "round",
      opacity: 0.75
    });
  });

  it("renders cross-loop edges as smoothstep paths", () => {
    const path = loopCrossLoopSmoothStepPath({
      id: "loop:source:output:0:ready:to:target:trigger",
      source: "loop:source:policy-0",
      target: "loop:target:trigger",
      selected: false,
      sourceX: 1000,
      sourceY: 76,
      targetX: loopCanvasLayoutConfig.startX,
      targetY: 280,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      data: {
        loopEdge: {
          key: "loop:source:output:0:ready:to:target:trigger",
          sourceNodeKey: "loop:source:policy-0",
          targetNodeKey: "loop:target:trigger",
          tone: "cross-loop"
        }
      }
    });

    expect(path.path).not.toContain("C");
    expect(path.path.match(/Q/g)).toHaveLength(4);
    expect(path.path).toContain("M1000 76L 1040,76Q 1064,76 1064,100");
    expect(path.path).toContain("L 8,256Q 8,280 32,280L72 280");
    expect(path.labelX).toBe(536);
    expect(path.labelY).toBe(178);
  });

  it("keeps cross-loop approval edges on the smoothstep loop-to-loop path", () => {
    const path = loopCrossLoopSmoothStepPath({
      id: "loop:source:output:0:approved:to:target:trigger",
      source: "loop:source:policy-0",
      target: "loop:target:trigger",
      selected: false,
      sourceX: 1000,
      sourceY: 76,
      targetX: loopCanvasLayoutConfig.startX,
      targetY: 280,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      data: {
        loopEdge: {
          key: "loop:source:output:0:approved:to:target:trigger",
          sourceNodeKey: "loop:source:policy-0",
          targetNodeKey: "loop:target:trigger",
          tone: "cross-loop",
          route: { outputId: "approved" }
        }
      }
    });

    expect(path.path.match(/Q/g)).toHaveLength(4);
    expect(path.path).toContain("M1000 76L 1040,76Q");
  });

  it("renders same-row approval outputs as direct right-to-left paths", () => {
    const path = loopApprovalEdgePath({
      sourceX: 433.5,
      sourceY: 75,
      targetX: 652.5,
      targetY: 75
    });

    expect(path).toEqual({
      path: "M 433.5,75 L 652.5,75",
      labelX: 543,
      labelY: 75
    });
  });

  it("marks one loop edge as animated when requested", () => {
    const edges = toLoopReactFlowEdges([
      {
        key: "policy-policy-0-1-build.complete",
        sourceNodeKey: "policy-0",
        targetNodeKey: "policy-1",
        sourceHandleId: "right",
        targetHandleId: "left"
      },
      {
        key: "policy-output-event-0-build.failed",
        sourceNodeKey: "policy-0",
        targetNodeKey: "output-event-0-build.failed",
        sourceHandleId: "right",
        targetHandleId: "left",
        dashed: true
      }
    ], [], undefined, "policy-output-event-0-build.failed");

    expect(edges.map((edge) => edge.animated)).toEqual([false, true]);
    expect(edges[0]?.domAttributes?.["data-loop-edge-animated"]).toBe("false");
    expect(edges[0]?.style?.opacity).toBe(0.75);
    expect(edges[1]).toMatchObject({
      animated: true,
      className: "loop-edge-animated",
      style: {
        opacity: 1
      },
      domAttributes: {
        "data-loop-edge-animated": "true"
      }
    });
  });

});
