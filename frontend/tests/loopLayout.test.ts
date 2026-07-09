import type { ProjectAction, ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import { actionOutputEventTypes } from "@shared/policy-actions";
import { getSmartEdge, smartEdgePresets } from "@tisoap/react-flow-smart-edge";
import { Position, type Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import { toLoopReactFlowEdges } from "../src/workspace/automation/loops/LoopCanvas";
import { loopApprovalEdgePath, loopEdgeDisplayLabel, loopRejectedEdgeLabelPlacement, loopReturnEdgePath, loopToLoopStraightEdgePath } from "../src/workspace/automation/loops/LoopSmartEdge";
import { loopCrossLoopSmoothStepPath } from "../src/workspace/automation/loops/loopCrossLoopSmoothStepPath";
import { loopRoutedEdgeLabelAnchor } from "../src/workspace/automation/loops/loopEdgeLabelGeometry";
import { buildLoopGraph, type LoopStepRecord } from "../src/workspace/automation/loops/loopGraph";
import { calculateAllLoopsCanvasLayout, calculateCompositeLoopCanvasLayout, calculateLoopCanvasLayout, loopCanvasLayoutConfig, loopCanvasNodeAnchorY, loopNodeSizes, loopOutputSourceHandleId, loopActionOutputHandleY, loopActionStackHeight, type LoopLayoutDirection } from "../src/workspace/automation/loops/loopLayout";
import { positionLoopNodes } from "../src/workspace/automation/loops/loopLayoutPositioning";
import { loopOutputTargetsForPolicy } from "../src/workspace/automation/loops/loopOutputTargets";
import { loopSmartEdgeRoutingOptions, loopSmartSmoothStepRadius } from "../src/workspace/automation/loops/loopSmartEdgeRouting";

const action = (id: string, event: string | undefined, action = "build"): ProjectAction => ({
  id,
  key: action,
  event: event ?? "project.updated",
  enabled: true,
  description: `${action} handler`,
  agentId: "agent-1"
});

const graphFor = (records: LoopStepRecord[]) => {
  const recordByEvent = new Map(records.flatMap((record) => {
    const eventType = (record.action as { event?: string } | undefined)?.event;
    return eventType ? [[eventType, record] as const] : [];
  }));

  return buildLoopGraph(records.map((record) => {
    const recordLoopId = record.loopId ?? "test.loop";
    const outputTargets = (record.outputTargets ?? record.outputEvents?.map((eventType) => ({
      outputId: eventType,
      eventType,
      type: "event" as const
    })) ?? []).map((target) => {
      if (target.type === "action") return target;
      const targetRecord = recordByEvent.get(target.eventType);
      return targetRecord
        ? {
          ...target,
          type: "action" as const,
          targetLoopId: targetRecord.loopId ?? recordLoopId,
          targetActionId: targetRecord.actionId
        }
        : target;
    });
    return { ...record, loopId: recordLoopId, outputTargets };
  }));
};

const layoutFor = (actions: ProjectAction[], steps: string[], editingPolicyIndex: number | null = null, direction: LoopLayoutDirection = "horizontal") => {
  const actionById = new Map(actions.map((item) => [item.id, item]));
  const loopId = "test.loop";
  const records: LoopStepRecord[] = steps.map((actionId, index) => ({
    actionId,
    index,
    loopId,
    action: actionById.get(actionId),
    outputEvents: actionById.get(actionId) ? actionOutputEventTypes(actionById.get(actionId)!, [actionById.get(actionId)!]) : undefined
  }));
  const legacyEventByRecordIndex = new Map(records.flatMap((record) => {
    const eventType = (record.action as { event?: string } | undefined)?.event;
    return eventType ? [[record.index, eventType] as const] : [];
  }));
  records.forEach((record) => {
    const outputEvents = record.outputEvents ?? [];
    record.outputTargets = outputEvents.map((eventType) => {
      const targetRecord = records.find((candidate) => legacyEventByRecordIndex.get(candidate.index) === eventType);
      const outputId = eventType;
      return targetRecord
        ? { outputId, eventType, type: "action" as const, targetLoopId: loopId, targetActionId: targetRecord.actionId }
        : { outputId, eventType, type: "event" as const };
    });
  });

  return calculateLoopCanvasLayout({
    loopGraph: graphFor(records),
    editingPolicyIndex,
    direction
  });
};

const compositeConfig = (
  loopIds: string[],
  outputRoutes: ProjectAutomationConfig["outputRoutes"] = [],
  sourceStartEvent = "source-event"
): ProjectAutomationConfig => {
  const upstreamPolicy = action("upstream-start", undefined, "upstream-gate");
  upstreamPolicy.event = "upstream-event";
  delete upstreamPolicy.agentId;
  upstreamPolicy.humanGate = true;
  const sourcePolicy = action("source-start", undefined, "source-gate");
  sourcePolicy.event = sourceStartEvent;
  delete sourcePolicy.agentId;
  sourcePolicy.humanGate = true;
  const targetPolicy = action("target-start", undefined, "target-gate");
  targetPolicy.event = "source-gate.approved";
  delete targetPolicy.agentId;
  targetPolicy.humanGate = true;
  const downstreamPolicy = action("downstream-start", undefined, "final-gate");
  downstreamPolicy.event = "target-gate.approved";
  delete downstreamPolicy.agentId;
  downstreamPolicy.humanGate = true;
  const policyByLoopId = new Map([
    ["upstream", upstreamPolicy],
    ["source", sourcePolicy],
    ["target", targetPolicy],
    ["downstream", downstreamPolicy]
  ]);

  return {
    version: 1,
    actions: [upstreamPolicy, sourcePolicy, targetPolicy, downstreamPolicy],
    outputRoutes: [
      ...(loopIds.includes("source") && loopIds.includes("target")
        ? [{ sourceLoopId: "source", sourceActionId: "source-start", outputId: "approved", targetLoopId: "target", targetActionId: "target-start" }]
        : []),
      ...(loopIds.includes("target") && loopIds.includes("downstream")
        ? [{ sourceLoopId: "target", sourceActionId: "target-start", outputId: "approved", targetLoopId: "downstream", targetActionId: "downstream-start" }]
        : []),
      ...(loopIds.includes("upstream") && loopIds.includes("source") && sourceStartEvent === "upstream-gate.approved"
        ? [{ sourceLoopId: "upstream", sourceActionId: "upstream-start", outputId: "approved", targetLoopId: "source", targetActionId: "source-start" }]
        : []),
      ...(loopIds.includes("target") && loopIds.includes("source") && sourceStartEvent === "target-gate.approved"
        ? [{ sourceLoopId: "target", sourceActionId: "target-start", outputId: "approved", targetLoopId: "source", targetActionId: "source-start" }]
        : []),
      ...outputRoutes
    ],
    humanGateResponses: [],
    loops: loopIds.map((loopId) => {
      const loopAction = policyByLoopId.get(loopId);
      return {
        id: loopId,
        steps: loopAction ? [loopAction.id] : []
      };
    }),
    runtimes: []
  };
};

const compositeRecords = (config: ProjectAutomationConfig) => {
  const actionById = new Map(config.actions.map((item) => [item.id, item]));
  return new Map(config.loops.map((loop) => [loop.id, loop.steps.map((actionId, index) => {
    const action = actionById.get(actionId);
      const outputTargets = action ? loopOutputTargetsForPolicy(config, action, loop.id) : undefined;
    return {
      actionId,
      index,
      loopId: loop.id,
      action,
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
    expect(loopCanvasNodeAnchorY({ kind: "action", height: 99 })).toBe(loopCanvasLayoutConfig.actionAnchorY);
    expect(loopCanvasNodeAnchorY({ kind: "output-event", height: 46 })).toBe(23);
    expect(loopOutputSourceHandleId()).toBe("right");
    expect(loopActionOutputHandleY(-1, 3)).toBe(loopCanvasLayoutConfig.actionAnchorY);
    expect(loopActionOutputHandleY(99, 3)).toBe(loopNodeSizes.action.height - loopCanvasLayoutConfig.edgePad / 2);
  });

  it("positions primary nodes through the extracted dagre layout helper", () => {
    const nodes = positionLoopNodes([
      {
        key: "action-0",
        kind: "action",
        width: loopNodeSizes.action.minWidth,
        height: loopNodeSizes.action.height,
        direction: "horizontal"
      },
      {
        key: "action-1",
        kind: "action",
        width: loopNodeSizes.action.minWidth,
        height: loopNodeSizes.action.height,
        direction: "horizontal"
      }
    ], [{ source: "action-0", target: "action-1", label: "updated" }], "horizontal");

    const sourceNode = nodes.find((node) => node.key === "action-0");
    const actionNode = nodes.find((node) => node.key === "action-1");

    expect(sourceNode).toMatchObject({
      x: loopCanvasLayoutConfig.startX,
      y: loopCanvasLayoutConfig.startY
    });
    expect(actionNode?.x).toBeGreaterThan((sourceNode?.x ?? 0) + loopNodeSizes.action.minWidth);
    expect(actionNode?.y).toBe(sourceNode?.y);
  });

  it("keeps horizontal spacing independent from edge label length", () => {
    const nodeDrafts = [
      {
        key: "action-0",
        kind: "action",
        width: loopNodeSizes.action.minWidth,
        height: loopNodeSizes.action.height,
        direction: "horizontal"
      },
      {
        key: "action-1",
        kind: "action",
        width: loopNodeSizes.action.minWidth,
        height: loopNodeSizes.action.height,
        direction: "horizontal"
      }
    ];
    const shortLabelNodes = positionLoopNodes(nodeDrafts, [{ source: "action-0", target: "action-1", label: "x" }], "horizontal");
    const longLabelNodes = positionLoopNodes(nodeDrafts, [{ source: "action-0", target: "action-1", label: "x".repeat(500) }], "horizontal");

    const shortLabelActionNode = shortLabelNodes.find((node) => node.key === "action-1");
    const longLabelActionNode = longLabelNodes.find((node) => node.key === "action-1");

    expect(longLabelActionNode?.x).toBe(shortLabelActionNode?.x);
    expect(shortLabelActionNode?.x).toBe(loopCanvasLayoutConfig.startX + loopNodeSizes.action.minWidth + loopCanvasLayoutConfig.horizontalEdgeGap);
  });

  it("keeps default smooth smart edge routing for same-row edges and tightens cross-row routing", () => {
    const sameRowOptions = loopSmartEdgeRoutingOptions({ sourceY: 125.5, targetY: 125.5 });
    const crossRowOptions = loopSmartEdgeRoutingOptions({ sourceY: 125.5, targetY: 75.5 });

    expect(sameRowOptions).toMatchObject({
      fallback: smartEdgePresets.smoothstep.fallback,
      generatePath: smartEdgePresets.smoothstep.generatePath
    });
    expect(sameRowOptions.drawEdge).toBe(crossRowOptions.drawEdge);
    expect(crossRowOptions).toMatchObject({
      gridRatio: 5,
      nodePadding: 6,
      generatePath: smartEdgePresets.smoothstep.generatePath
    });
    expect(sameRowOptions.drawEdge({ x: 0, y: 0 }, { x: 40, y: 40 }, [[40, 0]])).toContain(`L ${40 - loopSmartSmoothStepRadius},0Q 40,0 40,${loopSmartSmoothStepRadius}`);
  });

  it("routes dev deployment cross-row forward edges toward the target row first", () => {
    const sourceY = 125.5;
    const targetY = 75.5;
    const nodes = [
      loopRoutingTestNode({ id: "source-anchor", x: 32, y: 64, width: 28, height: 22 }),
      loopRoutingTestNode({ id: "action-0", x: 238, y: 64, width: 174, height: 22 }),
      loopRoutingTestNode({ id: "action-1", x: 597, y: 64, width: 112, height: 22 }),
      loopRoutingTestNode({ id: "action-3", x: 956, y: 64, width: 181, height: 22 }),
      loopRoutingTestNode({ id: "action-6", x: 1315, y: 64, width: 112, height: 22 }),
      loopRoutingTestNode({ id: "action-2", x: 597, y: 114, width: 132, height: 22 }),
      loopRoutingTestNode({ id: "action-8", x: 956, y: 114, width: 118, height: 22 }),
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
      options: smartEdgePresets.smoothstep
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

});

describe("calculateLoopCanvasLayout", () => {
  it("uses selected action outputs as action output events", () => {
    expect(actionOutputEventTypes({ key: "build" }, [{ id: "build", key: "build", agentId: "agent-1" }])).toEqual([
      "build.approved",
      "build.rejected"
    ]);
  });

  it("creates only the first-action ghost for an empty loop", () => {
    const layout = layoutFor([], []);

    expect(layout.nodes.map((node) => node.kind)).toEqual(["first-action-ghost"]);
    expect(layout.nodes.find((node) => node.key === "first-action-ghost")).toMatchObject({
      x: loopCanvasLayoutConfig.startX,
      y: loopCanvasLayoutConfig.startY
    });
    expect(layout.edges).toEqual([]);
  });

  it("renders multiple unhandled outputs as separate output-event nodes", () => {
    const start = action("start", undefined, "build");
    const layout = calculateLoopCanvasLayout({
      loopGraph: graphFor([{
        actionId: start.id,
        index: 0,
        action: start,
        outputEvents: ["build.approved", "build.rejected"]
      }]),
      editingPolicyIndex: null
    });
    const outputEventNodes = layout.nodes.filter((node) => node.kind === "output-event");

    expect(outputEventNodes.map((node) => node.outputEvent?.eventType)).toEqual([
      "build.approved",
      "build.rejected"
    ]);
    expect(outputEventNodes.map((node) => node.key)).toEqual([
      "output-event-0-build.approved",
      "output-event-0-build.rejected"
    ]);
    expect(layout.edges.filter((edge) => edge.sourceNodeKey === "action-0" && edge.targetNodeKey.startsWith("output-event-"))).toHaveLength(2);
  });

  it("does not render output nodes for an agentless action", () => {
    const start = action("manual-gate", undefined, "manual-gate");
    const layout = calculateLoopCanvasLayout({
      loopGraph: graphFor([{
        actionId: start.id,
        index: 0,
        action: start,
        outputEvents: actionOutputEventTypes(start, [{ id: "manual-gate" }])
      }]),
      editingPolicyIndex: null
    });

    expect(layout.nodes.some((node) => node.kind === "output-event")).toBe(false);
    expect(layout.edges.some((edge) => edge.sourceNodeKey === "action-0" && edge.targetNodeKey.startsWith("output-event-"))).toBe(false);
  });

  it("keeps terminal output events beside the source action edge", () => {
    const routeProject = action("route-project", undefined, "route-project");
    const aggregateReview = action("aggregate-review", "route-project.blocked", "aggregate-review");
    const layout = calculateLoopCanvasLayout({
      loopGraph: graphFor([
        {
          actionId: routeProject.id,
          index: 0,
          action: routeProject,
          outputEvents: ["route-project.blocked"]
        },
        {
          actionId: aggregateReview.id,
          index: 1,
          action: aggregateReview,
          outputEvents: [
            "aggregate-review.approved",
            "aggregate-review.changes-requested",
            "aggregate-review.blocked"
          ]
        }
      ]),
      editingPolicyIndex: null
    });
    const sourceNode = layout.nodes.find((node) => node.key === "action-1");
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
    const start = action("start", undefined, "build");
    const layout = calculateLoopCanvasLayout({
      loopGraph: graphFor([{
        actionId: start.id,
        index: 0,
        action: start,
        outputEvents: ["build.failed"],
        outputTargets: [
          { outputId: "failed", eventType: "build.failed", type: "event" },
          { outputId: "summary", eventType: "build.summary", type: "event" }
        ]
      }]),
      editingPolicyIndex: null
    });
    const actionNode = layout.nodes.find((node) => node.key === "action-0");
    const outputEventNode = layout.nodes.find((node) => node.key === "output-event-0-failed");
    const summaryOutputNode = layout.nodes.find((node) => node.key === "output-event-0-summary");

    expect(actionNode?.outputHandleCount).toBe(2);
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
      key: "action-output-event-0-failed",
      sourceNodeKey: "action-0",
      targetNodeKey: "output-event-0-failed",
      sourceHandleId: "bottom",
      targetHandleId: "bottom",
      dashed: true,
      eventType: "build.failed",
      label: "failed"
    }));
    expect(layout.edges).toContainEqual(expect.objectContaining({
      key: "action-output-event-0-summary",
      sourceNodeKey: "action-0",
      targetNodeKey: "output-event-0-summary",
      sourceHandleId: "right",
      targetHandleId: "left",
      dashed: true,
      eventType: "build.summary",
      label: "summary"
    }));
  });

  it("routes approval outputs from the right and same-row rework outputs through bottom handles", () => {
    const start = action("start", undefined, "build");
    const completeHandler = action("complete-handler", "build.approved", "done");
    const failedHandler = action("failed-handler", "build.rejected", "done");
    const layout = layoutFor([start, completeHandler, failedHandler], [
      start.id,
      completeHandler.id,
      failedHandler.id
    ]);

    expect(layout.edges.find((edge) => edge.eventType === "build.approved")).toMatchObject({
      sourceNodeKey: "action-0",
      sourceHandleId: "right",
      targetHandleId: "left",
      label: "approved"
    });
    expect(layout.edges.find((edge) => edge.eventType === "build.rejected")).toMatchObject({
      sourceNodeKey: "action-0",
      sourceHandleId: "bottom",
      targetHandleId: "top",
      label: "rejected"
    });
  });

  it("renders human gate action outputs without requiring agents", () => {
    const start = action("human-review", undefined, "human-review");
    const outputEvents = actionOutputEventTypes(start, [{
      id: "human-review",
      humanGate: true
    }]);
    const layout = calculateLoopCanvasLayout({
      loopGraph: graphFor([{
        actionId: start.id,
        index: 0,
        action: start,
        outputEvents
      }]),
      editingPolicyIndex: null
    });
    const outputEventNodes = layout.nodes.filter((node) => node.kind === "output-event");

    expect(outputEvents).toEqual(["human-review.approved", "human-review.rejected"]);
    expect(outputEventNodes.map((node) => node.outputEvent?.outputId)).toEqual(["human-review.approved", "human-review.rejected"]);
    expect(layout.edges).toContainEqual(expect.objectContaining({
      key: "action-output-event-0-human-review.approved",
      sourceNodeKey: "action-0",
      targetNodeKey: "output-event-0-human-review.approved",
      sourceHandleId: "right",
      targetHandleId: "left",
      eventType: "human-review.approved",
      label: "approved"
    }));
  });

  it("places unhandled done output events after active child actions", () => {
    const start = action("start", undefined, "design");
    const child = action("release", "design.ready", "release");
    const layout = calculateLoopCanvasLayout({
      loopGraph: graphFor([
        {
          actionId: start.id,
          index: 0,
          action: start,
          outputEvents: ["design.ready"],
          outputTargets: [
            { outputId: "ready", eventType: "design.ready", type: "event" },
            { outputId: "done", eventType: "design.done", type: "event" }
          ]
        },
        {
          actionId: child.id,
          index: 1,
          action: child,
          outputEvents: ["release.complete"]
        }
      ]),
      editingPolicyIndex: null
    });
    const sourceNode = layout.nodes.find((node) => node.key === "action-0");
    const childNode = layout.nodes.find((node) => node.key === "action-1");
    const doneOutputNode = layout.nodes.find((node) => node.key === "output-event-0-done");

    expect(doneOutputNode).toBeDefined();
    expect(childNode).toBeDefined();
    expect(sourceNode).toBeDefined();
    expect(loopTestRectsOverlap(doneOutputNode!, childNode!)).toBe(false);
    expect(doneOutputNode!.x).toBe(childNode!.x);
    expect(doneOutputNode!.y).toBe(childNode!.y + childNode!.height + loopNodeSizes.outputEvent.rowGap);
  });

  it("places unhandled output events in the next action column after active actions", () => {
    const first = action("first", undefined, "build");
    const child = action("child", "build.approved", "deploy");
    const layout = layoutFor([first, child], [first.id, child.id]);
    const firstNode = layout.nodes.find((node) => node.key === "action-0");
    const childNode = layout.nodes.find((node) => node.key === "action-1");
    const outputEventNode = layout.nodes.find((node) => node.key === "output-event-0-build.rejected");
    const outputEventEdge = layout.edges.find((edge) => edge.key === "action-output-event-0-build.rejected");
    const childPolicyEdge = layout.edges.find((edge) => edge.key === "action-action-0-1-build.approved");

    expect(layout.nodes.filter((node) => node.kind === "action").map((node) => node.record?.actionId)).toEqual(["first", "child"]);
    expect(childNode?.x).toBeGreaterThan(firstNode?.x ?? 0);
    expect(childNode?.y).toBe(firstNode?.y);
    expect(layout.edges).toContainEqual(expect.objectContaining({
      key: "action-action-0-1-build.approved",
      sourceNodeKey: "action-0",
      targetNodeKey: "action-1",
      sourceHandleId: "right",
      targetHandleId: "left",
      eventType: "build.approved"
    }));
    expect(childPolicyEdge?.label).toBe("approved");
    expect(outputEventNode).toMatchObject({
      kind: "output-event",
      sourceActionId: first.id,
      outputEvent: { eventType: "build.rejected" }
    });
    expect(outputEventEdge).toMatchObject({
      sourceNodeKey: "action-0",
      targetNodeKey: "output-event-0-build.rejected",
      sourceHandleId: "bottom",
      targetHandleId: "top",
      dashed: true,
      eventType: "build.rejected",
      label: "rejected"
    });
    expect(outputEventNode?.x).toBe(childNode?.x);
    expect(outputEventNode?.y).toBe(childNode
      ? childNode.y + loopActionStackHeight() + loopNodeSizes.outputEvent.rowGap
      : undefined);
    expect(layout.nodes.some((node) => node.kind === "output-event" && node.outputEvent?.eventType === "build.complete")).toBe(false);
  });

  it("reserves compact horizontal space for action id end labels", () => {
    const first = action("first", undefined, "route-project");
    const child = action("child", "review-intent.changes-requested", "analyze-intent");
    const layout = calculateLoopCanvasLayout({
      loopGraph: graphFor([
        {
          actionId: first.id,
          index: 0,
          action: first,
          outputEvents: ["review-intent.changes-requested"]
        },
        {
          actionId: child.id,
          index: 1,
          action: child,
          outputEvents: ["analyze-intent.ready"]
        }
      ]),
      editingPolicyIndex: null
    });
    const firstNode = layout.nodes.find((node) => node.key === "action-0");
    const childNode = layout.nodes.find((node) => node.key === "action-1");

    expect(firstNode).toBeDefined();
    expect(childNode).toBeDefined();
    expect(childNode!.x - (firstNode!.x + firstNode!.width)).toBe(loopCanvasLayoutConfig.horizontalEdgeGap);
  });

  it("keeps the primary horizontal action path on the root action baseline and stacks branches compactly below it", () => {
    const first = action("first", undefined, "build");
    const completeChild = action("complete-child", "build.complete", "deploy");
    const failedChild = action("failed-child", "build.failed", "debug");
    const layout = calculateLoopCanvasLayout({
      loopGraph: graphFor([
        {
          actionId: first.id,
          index: 0,
          action: first,
          outputEvents: ["build.complete", "build.failed", "build.blocked"]
        },
        {
          actionId: completeChild.id,
          index: 1,
          action: completeChild,
          outputEvents: ["deploy.complete"]
        },
        {
          actionId: failedChild.id,
          index: 2,
          action: failedChild,
          outputEvents: ["debug.complete"]
        }
      ]),
      editingPolicyIndex: null
    });
    const firstNode = layout.nodes.find((node) => node.key === "action-0");
    const completeChildNode = layout.nodes.find((node) => node.key === "action-1");
    const failedChildNode = layout.nodes.find((node) => node.key === "action-2");
    const outputEventNode = layout.nodes.find((node) => node.key === "output-event-0-build.blocked");

    expect(completeChildNode?.y).toBe(firstNode?.y);
    expect(failedChildNode?.y).toBe(firstNode ? firstNode.y + loopActionStackHeight() + loopCanvasLayoutConfig.branchGap : undefined);
    expect(outputEventNode?.x).toBe(completeChildNode?.x);
    expect(outputEventNode?.y).toBe(failedChildNode
      ? failedChildNode.y + loopActionStackHeight() + loopNodeSizes.outputEvent.rowGap
      : undefined);
  });

  it("keeps routed next actions on the primary lane with unhandled outputs below", () => {
    const createMilestones = action("create-milestones", undefined, "create-milestones");
    createMilestones.event = "technical_plan_approved";
    const challengeMilestones = action("challenge-milestones", "create-milestones.ready", "challenge-milestones");
    const reworkMilestones = action("rework-milestones", "challenge-milestones.changes-requested", "create-milestones");
    const createTaskSpecs = action("create-task-specs", undefined, "create-task-specs");
    createTaskSpecs.event = "challenge-milestones.approved";
    const challengeTaskSpecs = action("challenge-task-specs", "create-task-specs.ready", "challenge-task-specs");
    const reworkTaskSpecs = action("rework-task-specs", "challenge-task-specs.changes-requested", "create-task-specs");
    const layout = calculateLoopCanvasLayout({
      loopGraph: graphFor([
        {
          actionId: createMilestones.id,
          index: 0,
          action: createMilestones,
          outputTargets: [
            { outputId: "ready", eventType: "create-milestones.ready", type: "event" },
            { outputId: "blocked", eventType: "create-milestones.blocked", type: "event" }
          ]
        },
        {
          actionId: challengeMilestones.id,
          index: 1,
          action: challengeMilestones,
          outputTargets: [
            { outputId: "approved", eventType: "challenge-milestones.approved", type: "event" },
            { outputId: "changes-requested", eventType: "challenge-milestones.changes-requested", type: "event" }
          ]
        },
        {
          actionId: reworkMilestones.id,
          index: 2,
          action: reworkMilestones,
          outputTargets: [
            { outputId: "ready", eventType: "create-milestones.ready", type: "event" },
            { outputId: "blocked", eventType: "create-milestones.blocked", type: "event" }
          ]
        },
        {
          actionId: createTaskSpecs.id,
          index: 3,
          action: createTaskSpecs,
          outputTargets: [
            { outputId: "ready", eventType: "create-task-specs.ready", type: "event" },
            { outputId: "blocked", eventType: "create-task-specs.blocked", type: "event" }
          ]
        },
        {
          actionId: challengeTaskSpecs.id,
          index: 4,
          action: challengeTaskSpecs,
          outputTargets: [
            { outputId: "approved", eventType: "challenge-task-specs.approved", type: "event" },
            { outputId: "changes-requested", eventType: "challenge-task-specs.changes-requested", type: "event" }
          ]
        },
        {
          actionId: reworkTaskSpecs.id,
          index: 5,
          action: reworkTaskSpecs,
          outputTargets: [
            { outputId: "ready", eventType: "create-task-specs.ready", type: "event" },
            { outputId: "blocked", eventType: "create-task-specs.blocked", type: "event" }
          ]
        }
      ]),
      editingPolicyIndex: null
    });
    const createMilestonesNode = layout.nodes.find((node) => node.key === "action-0");
    const challengeMilestonesNode = layout.nodes.find((node) => node.key === "action-1");
    const createTaskSpecsNode = layout.nodes.find((node) => node.key === "action-3");
    const blockedOutputNode = layout.nodes.find((node) => node.key === "output-event-0-blocked");

    expect(createMilestonesNode).toBeDefined();
    expect(challengeMilestonesNode).toBeDefined();
    expect(createTaskSpecsNode).toBeDefined();
    expect(blockedOutputNode).toBeDefined();
    expect(blockedOutputNode?.y).toBe(challengeMilestonesNode
      ? challengeMilestonesNode.y + loopActionStackHeight() + loopNodeSizes.outputEvent.rowGap
      : undefined);
    expect(createTaskSpecsNode?.y).toBe(createMilestonesNode?.y);
    expect(createTaskSpecsNode?.x).toBeGreaterThan(challengeMilestonesNode?.x ?? 0);
  });

  it("keeps folded approval edges on right-to-left handles even when they return to an earlier canonical node", () => {
    const createMilestones = action("create-milestones", undefined, "create-milestones");
    createMilestones.event = "technical_plan_approved";
    const challengeMilestones = action("challenge-milestones", "create-milestones.ready", "challenge-milestones");
    const reworkMilestones = action("rework-milestones", "challenge-milestones.changes-requested", "create-milestones");
    const doneMilestones = action("done-milestones", "challenge-task-specs.approved", "done");
    const createTaskSpecs = action("create-task-specs", undefined, "create-task-specs");
    createTaskSpecs.event = "challenge-milestones.approved";
    const challengeTaskSpecs = action("challenge-task-specs", "create-task-specs.ready", "challenge-task-specs");
    const reworkTaskSpecs = action("rework-task-specs", "challenge-task-specs.changes-requested", "create-task-specs");
    const doneTaskSpecs = action(doneMilestones.id, "challenge-task-specs.approved", "done");
    const layout = calculateLoopCanvasLayout({
      loopGraph: graphFor([
        {
          actionId: createMilestones.id,
          index: 0,
          action: createMilestones,
          outputTargets: [
            { outputId: "ready", eventType: "create-milestones.ready", type: "event" },
            { outputId: "blocked", eventType: "create-milestones.blocked", type: "event" }
          ]
        },
        {
          actionId: challengeMilestones.id,
          index: 1,
          action: challengeMilestones,
          outputTargets: [
            { outputId: "approved", eventType: "challenge-milestones.approved", type: "event" },
            { outputId: "changes-requested", eventType: "challenge-milestones.changes-requested", type: "event" }
          ]
        },
        {
          actionId: reworkMilestones.id,
          index: 2,
          action: reworkMilestones,
          outputTargets: [
            { outputId: "ready", eventType: "create-milestones.ready", type: "event" },
            { outputId: "blocked", eventType: "create-milestones.blocked", type: "event" }
          ]
        },
        { actionId: doneMilestones.id, index: 3, action: doneMilestones, outputTargets: [] },
        {
          actionId: createTaskSpecs.id,
          index: 4,
          action: createTaskSpecs,
          outputTargets: [
            { outputId: "ready", eventType: "create-task-specs.ready", type: "event" },
            { outputId: "blocked", eventType: "create-task-specs.blocked", type: "event" }
          ]
        },
        {
          actionId: challengeTaskSpecs.id,
          index: 5,
          action: challengeTaskSpecs,
          outputTargets: [
            { outputId: "approved", eventType: "challenge-task-specs.approved", type: "event" },
            { outputId: "changes-requested", eventType: "challenge-task-specs.changes-requested", type: "event" }
          ]
        },
        {
          actionId: reworkTaskSpecs.id,
          index: 6,
          action: reworkTaskSpecs,
          outputTargets: [
            { outputId: "ready", eventType: "create-task-specs.ready", type: "event" },
            { outputId: "blocked", eventType: "create-task-specs.blocked", type: "event" }
          ]
        },
        { actionId: doneTaskSpecs.id, index: 7, action: doneTaskSpecs, outputTargets: [] }
      ]),
      editingPolicyIndex: null
    });

    expect(layout.edges.find((edge) => edge.eventType === "challenge-task-specs.approved")).toMatchObject({
      sourceNodeKey: "action-5",
      targetNodeKey: "action-3",
      sourceHandleId: "right",
      targetHandleId: "left",
      label: "approved"
    });
  });

  it("keeps return approval edges away from top and bottom handles in implementation review loops", () => {
    const implementTask = action("implement-task", undefined, "implement-task");
    implementTask.event = "task_specs_approved";
    const runTests = action("run-tests", "implement-task.ready", "run-tests");
    const classifyFailure = action("classify-failure", "implement-task.blocked", "classify-failure");
    const reworkImplementTask = action(implementTask.id, "classify-failure.ready", "implement-task");
    const layout = calculateLoopCanvasLayout({
      loopGraph: graphFor([
        {
          actionId: implementTask.id,
          index: 0,
          action: implementTask,
          outputTargets: [
            { outputId: "ready", eventType: "implement-task.ready", type: "event" },
            { outputId: "blocked", eventType: "implement-task.blocked", type: "event" }
          ]
        },
        {
          actionId: runTests.id,
          index: 1,
          action: runTests,
          outputTargets: [
            { outputId: "ready", eventType: "run-tests.ready", type: "event" },
            { outputId: "failed", eventType: "run-tests.failed", type: "event" }
          ]
        },
        {
          actionId: classifyFailure.id,
          index: 2,
          action: classifyFailure,
          outputTargets: [
            { outputId: "ready", eventType: "classify-failure.ready", type: "event" },
            { outputId: "blocked", eventType: "classify-failure.blocked", type: "event" }
          ]
        },
        {
          actionId: reworkImplementTask.id,
          index: 7,
          action: reworkImplementTask,
          outputTargets: [
            { outputId: "ready", eventType: "implement-task.ready", type: "event" },
            { outputId: "blocked", eventType: "implement-task.blocked", type: "event" }
          ]
        }
      ]),
      editingPolicyIndex: null
    });

    expect(layout.edges.find((edge) => edge.eventType === "classify-failure.ready")).toMatchObject({
      sourceNodeKey: "action-2",
      targetNodeKey: "action-0",
      sourceHandleId: "right",
      targetHandleId: "left",
      tone: "return",
      label: "ready"
    });
  });

  it("lays out child event actions below the source action in vertical mode", () => {
    const first = action("first", undefined, "build");
    const child = action("child", "build.approved", "deploy");
    const layout = layoutFor([first, child], [first.id, child.id], null, "vertical");
    const firstNode = layout.nodes.find((node) => node.key === "action-0");
    const childNode = layout.nodes.find((node) => node.key === "action-1");
    const outputEventNode = layout.nodes.find((node) => node.key === "output-event-0-build.rejected");

    expect(layout.direction).toBe("vertical");
    expect(firstNode?.y).toBe(loopCanvasLayoutConfig.startY);
    expect(childNode?.y).toBeGreaterThan(firstNode?.y ?? 0);
    expect(outputEventNode?.x).toBe(childNode ? childNode.x + childNode.width + loopCanvasLayoutConfig.branchGap : undefined);
    expect(outputEventNode?.y).toBe(childNode?.y);
    expect(layout.edges).toContainEqual(expect.objectContaining({
      key: "action-action-0-1-build.approved",
      sourceHandleId: "right",
      targetHandleId: "left"
    }));
  });

  it("links repeated output events directly to existing handler actions", () => {
    const implement = (id: string, event: string | undefined): ProjectAction => ({
      id,
      event: event ?? "plan_approved",
      key: "implement",
      enabled: true,
      description: "Implement",
      agentId: "developer-agent"
    });
    const review: ProjectAction = {
      id: "architect-review",
      event: "implement.completed",
      key: "review",
      enabled: true,
      description: "Review",
      agentId: "architect"
    };
    const records: LoopStepRecord[] = [
      {
        actionId: "developer-implement-initial",
        index: 0,
        action: implement("developer-implement-initial", undefined),
        outputEvents: ["implement.completed", "implement.failed"]
      },
      {
        actionId: review.id,
        index: 1,
        action: review,
        outputEvents: ["review.accepted", "review.rejected"]
      },
      {
        actionId: "developer-implement-initial",
        index: 2,
        action: implement("developer-implement-initial", "review.rejected"),
        outputEvents: ["implement.completed", "implement.failed"]
      }
    ];
    const layout = calculateLoopCanvasLayout({
      loopGraph: graphFor(records),
      editingPolicyIndex: null
    });

    const returnEdge = layout.edges.find((edge) => edge.eventType === "review.rejected");
    const actionNodes = layout.nodes.filter((node) => node.kind === "action");
    const foldedImplementNode = layout.nodes.find((node) => node.key === "action-0");
    const reworkActionNode = layout.nodes.find((node) => node.key === "action-2");
    const reworkOutputEventNodes = layout.nodes.filter((node) => node.kind === "output-event" && node.record?.index === 2);

    expect(actionNodes.map((node) => node.record?.actionId)).toEqual([
      "developer-implement-initial",
      "architect-review"
    ]);
    expect(foldedImplementNode?.records?.map((record) => record.actionId)).toEqual([
      "developer-implement-initial",
      "developer-implement-initial"
    ]);
    expect(reworkActionNode).toBeUndefined();
    expect(returnEdge).toBeDefined();
    expect(returnEdge).toMatchObject({
      sourceNodeKey: "action-1",
      targetNodeKey: "action-0",
      sourceHandleId: "top",
      targetHandleId: "top",
      tone: "return",
      eventType: "review.rejected",
      label: "rejected"
    });
    expect(reworkOutputEventNodes).toHaveLength(0);
  });

  it("folds roadmap rework into the original create-roadmap node", () => {
    const createRoadmap = action("p05.on.project-brief-gate-approved.create-roadmap", undefined, "create-roadmap");
    createRoadmap.event = "project-brief-gate.approved";
    const challengeRoadmap = action("p06.on.roadmap-ready.challenge-roadmap", "create-roadmap.ready", "challenge-roadmap");
    const reworkRoadmap = action(createRoadmap.id, "challenge-roadmap.changes-requested", "create-roadmap");
    const done = action("p08.on.roadmap-approved.done", "challenge-roadmap.approved", "done");
    const records: LoopStepRecord[] = [
      {
        actionId: createRoadmap.id,
        index: 0,
        action: createRoadmap,
        outputTargets: [
          { outputId: "ready", eventType: "create-roadmap.ready", type: "event" },
          { outputId: "blocked", eventType: "create-roadmap.blocked", type: "event" }
        ]
      },
      {
        actionId: challengeRoadmap.id,
        index: 1,
        action: challengeRoadmap,
        outputTargets: [
          { outputId: "approved", eventType: "challenge-roadmap.approved", type: "event" },
          { outputId: "changes-requested", eventType: "challenge-roadmap.changes-requested", type: "event" }
        ]
      },
      {
        actionId: reworkRoadmap.id,
        index: 2,
        action: reworkRoadmap,
        outputTargets: [
          { outputId: "ready", eventType: "create-roadmap.ready", type: "event" },
          { outputId: "blocked", eventType: "create-roadmap.blocked", type: "event" }
        ]
      },
      {
        actionId: done.id,
        index: 3,
        action: done,
        outputTargets: []
      }
    ];
    const layout = calculateLoopCanvasLayout({
      loopGraph: graphFor(records),
      editingPolicyIndex: null
    });
    const actionNodes = layout.nodes.filter((node) => node.kind === "action");
    const returnEdge = layout.edges.find((edge) => edge.eventType === "challenge-roadmap.changes-requested");

    expect(actionNodes.map((node) => node.record?.action?.key)).toEqual([
      "create-roadmap",
      "challenge-roadmap",
      "done"
    ]);
    expect(layout.nodes.find((node) => node.key === "action-2")).toBeUndefined();
    expect(layout.nodes.filter((node) => node.kind === "output-event" && node.record?.index === 2)).toHaveLength(0);
    expect(layout.nodes.find((node) => node.key === "action-0")?.records?.map((record) => record.actionId)).toEqual([
      "p05.on.project-brief-gate-approved.create-roadmap",
      createRoadmap.id
    ]);
    expect(returnEdge).toMatchObject({
      sourceNodeKey: "action-1",
      targetNodeKey: "action-0",
      tone: "return",
      label: "changes-requested"
    });
  });
});

describe("calculateCompositeLoopCanvasLayout", () => {
  it("keeps a selected loop alone when no loop starts from its output event", () => {
    const config = compositeConfig(["source", "observer"]);
    const layout = calculateCompositeLoopCanvasLayout({
      config,
      selectedLoopId: "source",
      recordsByLoopId: compositeRecords(config)
    });

    expect(layout.nodes.map((node) => node.key)).toEqual(expect.arrayContaining([
      "loop:source:action-0",
      "loop:source:output-event-0-approved",
      "loop:source:output-event-0-rejected"
    ]));
    expect(layout.nodes.some((node) => node.key.startsWith("loop:observer:"))).toBe(false);
  });

  it("renders a derived event target loop as a compact loop node below the selected loop", () => {
    const config = compositeConfig(["source", "target"]);
    const layout = calculateCompositeLoopCanvasLayout({
      config,
      selectedLoopId: "source",
      recordsByLoopId: compositeRecords(config)
    });
    const sourceAction = layout.nodes.find((node) => node.key === "loop:source:action-0");
    const targetLoop = layout.nodes.find((node) => node.key === "loop:target:loop");
    const crossEdge = layout.edges.find((edge) => edge.key === "loop:source:output:0:approved:to:target:loop");

    expect(layout.nodes.every((node) => node.key.startsWith("loop:"))).toBe(true);
    expect(new Set(layout.nodes.map((node) => node.key)).size).toBe(layout.nodes.length);
    expect(layout.nodes.map((node) => node.key)).toEqual(expect.arrayContaining([
      "loop:source:action-0",
      "loop:target:loop"
    ]));
    expect(layout.nodes.find((node) => node.key === "loop:target:action-0")).toBeUndefined();
    expect(layout.nodes.find((node) => node.key === "loop:source:output-event-0-approved")).toMatchObject({
      kind: "output-event",
      outputEvent: { outputId: "approved", outputType: "action" }
    });
    expect(targetLoop).toMatchObject({
      kind: "loop",
      width: loopNodeSizes.loop.minWidth,
      height: loopNodeSizes.loop.height,
      loopSummary: {
        loopId: "target"
      }
    });
    expect(targetLoop?.y).toBeGreaterThan(sourceAction?.y ?? 0);
    expect(targetLoop?.y).toBe(
      Math.max(
        ...layout.nodes
          .filter((node) => node.loopId === "source" && node.kind !== "loop")
          .map((node) => node.y + node.height)
      ) + loopCanvasLayoutConfig.selectedCompactLoopRowGap
    );
    expect(crossEdge).toMatchObject({
      sourceNodeKey: "loop:source:action-0",
      targetNodeKey: "loop:target:loop",
      sourceHandleId: "right",
      targetHandleId: "top",
      eventType: "source.source-start.approved",
      label: "approved",
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

    expect(layout.edges.find((edge) => edge.key === "loop:source:output:0:approved:to:target:loop")).toMatchObject({
      sourceNodeKey: "loop:source:action-0",
      targetNodeKey: "loop:target:loop",
      sourceHandleId: "right",
      targetHandleId: "top",
      label: "approved",
      tone: "cross-loop"
    });
    expect(layout.nodes.find((node) => node.key === "loop:source:output-event-0-rejected")).toBeDefined();
    expect(layout.edges.find((edge) => edge.key === "loop:source:output:0:rejected:to:target:loop")).toBeUndefined();
  });

  it("renders upstream loops as compact loop nodes above the selected loop", () => {
    const config = compositeConfig(["upstream", "source"], [], "upstream-gate.approved");
    const layout = calculateCompositeLoopCanvasLayout({
      config,
      selectedLoopId: "source",
      recordsByLoopId: compositeRecords(config)
    });
    const sourceAction = layout.nodes.find((node) => node.key === "loop:source:action-0");
    const upstreamLoop = layout.nodes.find((node) => node.key === "loop:upstream:loop");
    const crossEdge = layout.edges.find((edge) => edge.key === "loop:upstream:output:0:approved:to:source:loop");

    expect(sourceAction).toBeDefined();
    expect(upstreamLoop).toMatchObject({
      kind: "loop",
      loopSummary: {
        loopId: "upstream"
      }
    });
    expect(upstreamLoop?.y).toBeLessThan(sourceAction?.y ?? 0);
    expect((sourceAction?.y ?? 0) - ((upstreamLoop?.y ?? 0) + loopNodeSizes.loop.height)).toBe(
      loopCanvasLayoutConfig.selectedCompactLoopRowGap
    );
    expect(layout.nodes.find((node) => node.key === "loop:upstream:action-0")).toBeUndefined();
    expect(crossEdge).toMatchObject({
      sourceNodeKey: "loop:upstream:loop",
      targetNodeKey: "loop:source:action-0",
      sourceHandleId: "bottom",
      targetHandleId: "left",
      label: "approved",
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

    expect(layout.nodes.find((node) => node.key === "loop:source:output-event-0-rejected")).toBeDefined();
    expect(layout.edges.find((edge) => edge.key === "loop:source:output:0:rejected:to:target:loop")).toBeUndefined();
  });

  it("protects circular event loop references from recursive layout", () => {
    const config = compositeConfig(["source", "target"], [], "target-gate.approved");
    const layout = calculateCompositeLoopCanvasLayout({
      config,
      selectedLoopId: "source",
      recordsByLoopId: compositeRecords(config)
    });

    expect(layout.nodes.some((node) => node.key.includes("input-event"))).toBe(false);
    expect(layout.nodes.filter((node) => node.kind === "action")).toHaveLength(1);
    expect(layout.nodes.filter((node) => node.kind === "loop")).toHaveLength(1);
    expect(layout.edges.filter((edge) => edge.tone === "cross-loop")).toHaveLength(2);
    expect(new Set(layout.nodes.map((node) => node.key)).size).toBe(layout.nodes.length);
  });

  it("stacks branching compact loop successors by config order", () => {
    const config = compositeConfig(["source", "target", "downstream"]);
    config.actions.push({
      id: "branch-gate",
      key: "branch-gate",
      event: "source-gate.rejected",
      enabled: true,
      description: "Branch gate",
      humanGate: true
    });
    const sourceLoop = config.loops.find((loop) => loop.id === "source");
    sourceLoop?.steps.push("branch-gate");
    const branchPolicy = action("branch-start", undefined, "final-gate");
    branchPolicy.event = "branch-gate.approved";
    delete branchPolicy.agentId;
    branchPolicy.humanGate = true;
    config.actions.push(branchPolicy);
    config.loops.push({ id: "branch", steps: [branchPolicy.id] });
    config.outputRoutes.push({
      sourceLoopId: "source",
      sourceActionId: "branch-gate",
      outputId: "approved",
      targetLoopId: "branch",
      targetActionId: branchPolicy.id
    });
    const layout = calculateCompositeLoopCanvasLayout({
      config,
      selectedLoopId: "source",
      recordsByLoopId: compositeRecords(config)
    });
    const targetLoop = layout.nodes.find((node) => node.key === "loop:target:loop");
    const downstreamLoop = layout.nodes.find((node) => node.key === "loop:downstream:loop");
    const branchLoop = layout.nodes.find((node) => node.key === "loop:branch:loop");
    const compactLoopStep = loopNodeSizes.loop.height + loopCanvasLayoutConfig.compactLoopRowGap;

    expect(targetLoop).toBeDefined();
    expect(downstreamLoop).toBeDefined();
    expect(branchLoop).toBeDefined();
    expect(targetLoop?.x).toBe(branchLoop?.x);
    expect(targetLoop?.x).toBe(downstreamLoop?.x);
    expect(downstreamLoop?.y).toBe((targetLoop?.y ?? 0) + compactLoopStep);
    expect(branchLoop?.y).toBe((downstreamLoop?.y ?? 0) + compactLoopStep);
    expect(compactLoopStep).toBe(70);
    expect(layout.edges.find((edge) => edge.key === "loop:source:output:0:approved:to:target:loop")).toMatchObject({
      label: "approved",
      tone: "cross-loop"
    });
    expect(layout.edges.find((edge) => edge.key === "loop:source:output:1:approved:to:branch:loop")).toMatchObject({
      label: "approved",
      tone: "cross-loop"
    });
    expect(layout.edges.find((edge) => edge.key === "loop:target:output:0:approved:to:downstream:loop")).toMatchObject({
      sourceNodeKey: "loop:target:loop",
      targetNodeKey: "loop:downstream:loop",
      sourceHandleId: "bottom",
      targetHandleId: "top",
      label: "approved",
      tone: "cross-loop"
    });
  });
});

describe("calculateAllLoopsCanvasLayout", () => {
  it("renders every configured loop row and keeps cross-loop event edges", () => {
    const config = compositeConfig(["source", "target", "observer"]);
    const layout = calculateAllLoopsCanvasLayout({
      config,
      recordsByLoopId: compositeRecords(config)
    });
    const sourceAction = layout.nodes.find((node) => node.key === "loop:source:action-0");
    const targetAction = layout.nodes.find((node) => node.key === "loop:target:action-0");
    const observerGhost = layout.nodes.find((node) => node.key === "loop:observer:first-action-ghost");
    const crossEdge = layout.edges.find((edge) => edge.key === "loop:source:output:0:approved:to:target:action:target-start");

    expect(sourceAction).toBeDefined();
    expect(targetAction).toBeDefined();
    expect(observerGhost).toMatchObject({ kind: "first-action-ghost" });
    expect(layout.nodes.find((node) => node.key === "loop:source:output-event-0-approved")).toMatchObject({
      kind: "output-event",
      outputEvent: { outputId: "approved", outputType: "action" }
    });
    expect(crossEdge).toMatchObject({
      sourceNodeKey: "loop:source:action-0",
      targetNodeKey: "loop:target:action-0",
      sourceHandleId: "right",
      targetHandleId: "left",
      label: "approved",
      tone: "cross-loop"
    });
  });
});

describe("toLoopReactFlowEdges", () => {
  it("renders compact loop-to-loop edges as one direct segment", () => {
    expect(loopToLoopStraightEdgePath({
      sourceX: 83,
      sourceY: 86,
      targetX: 83,
      targetY: 134
    })).toEqual({
      path: "M 83,86 L 83,134",
      labelX: 83,
      labelY: 110
    });
  });

  it("uses action ids on forward edges and preserves output labels on rework edges", () => {
    const sourceNode = {
      key: "action-0",
      kind: "action" as const,
      x: 72,
      y: 64,
      width: loopNodeSizes.action.minWidth,
      height: loopNodeSizes.action.height,
      direction: "horizontal" as const,
      record: {
        actionId: "create-project-brief",
        index: 0,
        action: action("create-project-brief", undefined)
      }
    };

    expect(loopEdgeDisplayLabel({
      key: "approved",
      sourceNodeKey: "action-0",
      targetNodeKey: "action-1",
      label: "approved",
      route: { outputId: "approved" }
    }, sourceNode)).toEqual({ value: "create-project-brief", kind: "action" });
    expect(loopEdgeDisplayLabel({
      key: "rejected",
      sourceNodeKey: "action-0",
      targetNodeKey: "action-1",
      label: "rejected",
      route: { outputId: "rejected" }
    }, sourceNode)).toEqual({ value: "rejected", kind: "output" });
    expect(loopEdgeDisplayLabel({
      key: "cross-loop",
      sourceNodeKey: "action-0",
      targetNodeKey: "action-1",
      label: "approved",
      tone: "cross-loop",
      route: { outputId: "approved" }
    }, sourceNode)).toBeUndefined();

    expect(loopEdgeDisplayLabel({
      key: "loop-start",
      sourceNodeKey: "loop:upstream:loop",
      targetNodeKey: "loop:source:action-0",
      label: "approved",
      tone: "cross-loop",
      route: { outputId: "approved" }
    }, {
      key: "loop:upstream:loop",
      kind: "loop",
      x: 72,
      y: 64,
      width: loopNodeSizes.loop.minWidth,
      height: loopNodeSizes.loop.height,
      direction: "horizontal",
      loopSummary: { loopId: "upstream.approved.loop" }
    })).toEqual({ value: "upstream.approved.loop", kind: "loop", placement: "start" });

    expect(loopEdgeDisplayLabel({
      key: "loop-end",
      sourceNodeKey: "loop:source:action-0",
      targetNodeKey: "loop:target:loop",
      label: "approved",
      tone: "cross-loop",
      route: { outputId: "approved" }
    }, sourceNode, {
      key: "loop:target:loop",
      kind: "loop",
      x: 72,
      y: 280,
      width: loopNodeSizes.loop.minWidth,
      height: loopNodeSizes.loop.height,
      direction: "horizontal",
      loopSummary: { loopId: "target.approved.loop" }
    })).toEqual({ value: "target.approved.loop", kind: "loop", placement: "end" });
  });

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

  it("places rejected labels at the source end of vertical edges", () => {
    expect(loopRejectedEdgeLabelPlacement({ sourceX: 240, sourceY: 80, sourcePosition: Position.Bottom })).toEqual({
      x: 240,
      y: 84,
      translate: "translate(-50%, 0)"
    });
    expect(loopRejectedEdgeLabelPlacement({ sourceX: 240, sourceY: 80, sourcePosition: Position.Top })).toEqual({
      x: 240,
      y: 76,
      translate: "translate(-50%, -100%)"
    });
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
    const sourceNode = { key: "action-2", kind: "action" as const, x: 300, y: 120, width: 140, height: 22, direction: "horizontal" as const };
    const topTargetNode = { key: "action-1", kind: "action" as const, x: 120, y: 40, width: 140, height: 22, direction: "horizontal" as const };
    const bottomTargetNode = { ...topTargetNode, y: 220 };
    const baseProps = {
      id: "event-action-2-1-complete",
      source: "action-2",
      target: "action-1",
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
          key: "event-action-2-1-complete",
          sourceNodeKey: "action-2",
          targetNodeKey: "action-1",
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
    expect(topReturnPath.startLabelTranslate).toBe("translate(-50%, -100%)");
    expect(topReturnPath.endLabelX).toBe(topTargetNode.x + topTargetNode.width / 2);
    expect(topReturnPath.endLabelY).toBe(topTargetNode.y - 4);
    expect(loopReturnEdgePath({
      ...baseProps,
      targetY: topTargetNode.y,
      data: {
        loopEdge: {
          key: "event-action-2-1-complete",
          sourceNodeKey: "action-2",
          targetNodeKey: "action-1",
          sourceHandleId: "top",
          targetHandleId: "top",
          tone: "return"
        },
        sourceNode,
        targetNode: topTargetNode
      }
    }).path.startsWith(`M ${sourceNode.x + sourceNode.width / 2},${sourceNode.y}`)).toBe(true);
    expect(topReturnPath.path.match(/Q/g)).toHaveLength(2);
    expect(topReturnPath.path).toContain(`Q ${sourceNode.x + sourceNode.width / 2},${topTargetNode.y - 28}`);
    expect(topReturnPath.path).toContain(`Q ${topTargetNode.x + topTargetNode.width / 2},${topTargetNode.y - 28}`);
    const bottomReturnPath = loopReturnEdgePath({
      ...baseProps,
      targetY: bottomTargetNode.y + bottomTargetNode.height,
      data: {
        loopEdge: {
          key: "event-action-2-1-complete",
          sourceNodeKey: "action-2",
          targetNodeKey: "action-1",
          sourceHandleId: "top",
          targetHandleId: "bottom",
          tone: "return"
        },
        sourceNode,
        targetNode: bottomTargetNode
      }
    });

    expect(bottomReturnPath.labelY).toBe(bottomTargetNode.y + bottomTargetNode.height + 28);
    expect(bottomReturnPath.startLabelTranslate).toBe("translate(-50%, -100%)");
  });

  it("maps loop layout edges to smart ReactFlow edges", () => {
    const [edge] = toLoopReactFlowEdges([{
      key: "event-action-2-1-implementation.complete",
      sourceNodeKey: "action-2",
      targetNodeKey: "action-1",
      sourceHandleId: "top",
      targetHandleId: "top",
      dashed: true,
      tone: "return",
      eventType: "implementation.complete",
      label: "complete"
    }]);

    expect(edge).toMatchObject({
      id: "event-action-2-1-implementation.complete",
      type: "loopSmart",
      source: "action-2",
      target: "action-1",
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

  it("maps every loop edge to SmartSmoothStepEdge", () => {
    const edges = toLoopReactFlowEdges([
      {
        key: "action-action-0-1-build.complete",
        sourceNodeKey: "action-0",
        targetNodeKey: "action-1",
        sourceHandleId: "right",
        targetHandleId: "left"
      },
      {
        key: "action-output-event-0-done",
        sourceNodeKey: "action-0",
        targetNodeKey: "output-event-0-done",
        sourceHandleId: "right",
        targetHandleId: "left"
      },
      {
        key: "action-output-event-0-build.failed",
        sourceNodeKey: "action-0",
        targetNodeKey: "output-event-0-build.failed",
        sourceHandleId: "right",
        targetHandleId: "left"
      }
    ]);

    expect(edges.map((edge) => edge.type)).toEqual(["loopSmart", "loopSmart", "loopSmart"]);
  });

  it("maps same-loop approval edges to the green-gray output stroke", () => {
    const [edge] = toLoopReactFlowEdges([{
      key: "action-action-0-1-build.complete",
      sourceNodeKey: "action-0",
      targetNodeKey: "action-1",
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
      key: "action-action-0-1-build.failed",
      sourceNodeKey: "action-0",
      targetNodeKey: "action-1",
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
      key: "action-output-event-0-blocked",
      sourceNodeKey: "action-0",
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
      key: "loop:source:output:0:ready:to:target:action:target-start",
      sourceNodeKey: "loop:source:action-0",
      targetNodeKey: "loop:target:action-0",
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
      key: "loop:source:output:0:changes-requested:to:target:action:target-start",
      sourceNodeKey: "loop:source:action-0",
      targetNodeKey: "loop:target:action-0",
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
      id: "loop:source:output:0:ready:to:target:action:target-start",
      source: "loop:source:action-0",
      target: "loop:target:action-0",
      selected: false,
      sourceX: 1000,
      sourceY: 76,
      targetX: loopCanvasLayoutConfig.startX,
      targetY: 280,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      data: {
        loopEdge: {
          key: "loop:source:output:0:ready:to:target:action:target-start",
          sourceNodeKey: "loop:source:action-0",
          targetNodeKey: "loop:target:action-0",
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
      id: "loop:source:output:0:approved:to:target:action:target-start",
      source: "loop:source:action-0",
      target: "loop:target:action-0",
      selected: false,
      sourceX: 1000,
      sourceY: 76,
      targetX: loopCanvasLayoutConfig.startX,
      targetY: 280,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      data: {
        loopEdge: {
          key: "loop:source:output:0:approved:to:target:action:target-start",
          sourceNodeKey: "loop:source:action-0",
          targetNodeKey: "loop:target:action-0",
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
        key: "action-action-0-1-build.complete",
        sourceNodeKey: "action-0",
        targetNodeKey: "action-1",
        sourceHandleId: "right",
        targetHandleId: "left"
      },
      {
        key: "action-output-event-0-build.failed",
        sourceNodeKey: "action-0",
        targetNodeKey: "output-event-0-build.failed",
        sourceHandleId: "right",
        targetHandleId: "left",
        dashed: true
      }
    ], [], undefined, "action-output-event-0-build.failed");

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
