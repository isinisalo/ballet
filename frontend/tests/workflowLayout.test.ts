import { describe, expect, it } from "vitest";
import { Position, type Node } from "@xyflow/react";
import { getSmartEdge, smartEdgePresets } from "@tisoap/react-flow-smart-edge";
import type { ProjectAutomationConfig, ProjectPolicy } from "@shared/api/workspace-contracts";
import { policyOutputEventTypes } from "@shared/policy-actions";
import { buildWorkflowGraph, type WorkflowStepRecord } from "../src/workspace/automation/workflows/workflowGraph";
import { toWorkflowReactFlowEdges } from "../src/workspace/automation/workflows/WorkflowCanvas";
import { workflowReturnEdgePath } from "../src/workspace/automation/workflows/WorkflowSmartEdge";
import { workflowCrossWorkflowSmoothStepPath } from "../src/workspace/automation/workflows/workflowCrossWorkflowSmoothStepPath";
import { workflowRoutedEdgeLabelAnchor } from "../src/workspace/automation/workflows/workflowEdgeLabelGeometry";
import { workflowSmartEdgeRoutingOptions } from "../src/workspace/automation/workflows/workflowSmartEdgeRouting";
import { calculateCompositeWorkflowCanvasLayout, calculateWorkflowCanvasLayout, workflowCanvasLayoutConfig, workflowCanvasNodeAnchorY, workflowNodeSizes, workflowOutputSourceHandleId, workflowPolicyOutputHandleY, workflowPolicyStackHeight, type WorkflowLayoutDirection } from "../src/workspace/automation/workflows/workflowLayout";
import { positionWorkflowNodes } from "../src/workspace/automation/workflows/workflowLayoutPositioning";
import { workflowOutputTargetsForPolicy } from "../src/workspace/automation/workflows/workflowOutputTargets";

const policy = (id: string, event: string | undefined, action = "build"): ProjectPolicy => ({
  id,
  source: event ? "event" : "trigger",
  event,
  trigger: event ? undefined : "project.updated",
  action,
  enabled: true
});

const layoutFor = (policies: ProjectPolicy[], steps: string[], editingPolicyIndex: number | null = null, direction: WorkflowLayoutDirection = "horizontal") => {
  const policyById = new Map(policies.map((item) => [item.id, item]));
  const records: WorkflowStepRecord[] = steps.map((policyId, index) => ({
    policyId,
    index,
    policy: policyById.get(policyId),
    outputEvents: policyById.get(policyId) ? policyOutputEventTypes(policyById.get(policyId)!, [{ id: policyById.get(policyId)!.action, outputIds: ["complete", "failed"] }]) : undefined
  }));

  return calculateWorkflowCanvasLayout({
    workflowGraph: buildWorkflowGraph(records),
    editingPolicyIndex,
    direction
  });
};

const compositeConfig = (
  workflowIds: string[],
  outputRoutes: ProjectAutomationConfig["outputRoutes"] = []
): ProjectAutomationConfig => {
  const sourcePolicy = policy("source-start", undefined, "build");
  sourcePolicy.trigger = "source-trigger";
  const targetPolicy = policy("target-start", undefined, "deploy");
  targetPolicy.trigger = "target-trigger";
  const policyByWorkflowId = new Map([
    ["source", sourcePolicy],
    ["target", targetPolicy]
  ]);

  return {
    version: 1,
    triggers: [
      { id: "source-trigger", description: "Source trigger" },
      { id: "target-trigger", description: "Target trigger" }
    ],
    actions: [
      { id: "build", description: "Build", outputIds: ["ready", "blocked"], agentIds: ["builder-agent"] },
      { id: "deploy", description: "Deploy", outputIds: ["done"], agentIds: ["deployer-agent"] }
    ],
    outputs: [{ id: "ready" }, { id: "blocked" }, { id: "done" }],
    outputRoutes,
    policies: [sourcePolicy, targetPolicy],
    workflows: workflowIds.map((workflowId) => {
      const workflowPolicy = policyByWorkflowId.get(workflowId);
      return {
        id: workflowId,
        title: workflowId,
        steps: workflowPolicy ? [workflowPolicy.id] : []
      };
    }),
    runtimes: []
  };
};

const compositeRecords = (config: ProjectAutomationConfig) => {
  const policyById = new Map(config.policies.map((item) => [item.id, item]));
  return new Map(config.workflows.map((workflow) => [workflow.id, workflow.steps.map((policyId, index) => {
    const policy = policyById.get(policyId);
    const outputTargets = policy ? workflowOutputTargetsForPolicy(config, policy) : undefined;
    return {
      policyId,
      index,
      workflowId: workflow.id,
      policy,
      outputTargets,
      outputEvents: outputTargets?.map((output) => output.eventType)
    };
  })] as const));
};

const workflowTestRectsOverlap = (
  firstNode: { x: number; y: number; width: number; height: number },
  secondNode: { x: number; y: number; width: number; height: number }
) => firstNode.x < secondNode.x + secondNode.width &&
  firstNode.x + firstNode.width > secondNode.x &&
  firstNode.y < secondNode.y + secondNode.height &&
  firstNode.y + firstNode.height > secondNode.y;

const workflowRoutingTestNode = ({ id, x, y, width, height }: { id: string; x: number; y: number; width: number; height: number }): Node => ({
  id,
  position: { x, y },
  data: {},
  measured: { width, height },
  width,
  height
} as Node);

const firstRoutedPointMovingVertically = (points: number[][], sourceY: number) =>
  points.find((point) => typeof point[1] === "number" && Math.abs(point[1] - sourceY) > 0.5);

describe("workflow layout helper modules", () => {
  it("keeps exported node anchor and output handle calculations stable", () => {
    expect(workflowCanvasNodeAnchorY({ kind: "trigger", height: 99 })).toBe(workflowCanvasLayoutConfig.triggerAnchorY);
    expect(workflowCanvasNodeAnchorY({ kind: "policy", height: 99 })).toBe(workflowCanvasLayoutConfig.policyAnchorY);
    expect(workflowCanvasNodeAnchorY({ kind: "output-event", height: 46 })).toBe(23);
    expect(workflowOutputSourceHandleId()).toBe("right");
    expect(workflowPolicyOutputHandleY(-1, 3)).toBe(workflowCanvasLayoutConfig.policyAnchorY);
    expect(workflowPolicyOutputHandleY(99, 3)).toBe(workflowNodeSizes.policy.height - workflowCanvasLayoutConfig.edgePad / 2);
  });

  it("positions primary nodes through the extracted dagre layout helper", () => {
    const nodes = positionWorkflowNodes([
      {
        key: "trigger",
        kind: "trigger",
        width: workflowNodeSizes.trigger.minWidth,
        height: workflowNodeSizes.trigger.height,
        direction: "horizontal"
      },
      {
        key: "policy-0",
        kind: "policy",
        width: workflowNodeSizes.policy.minWidth,
        height: workflowNodeSizes.policy.height,
        direction: "horizontal"
      }
    ], [{ source: "trigger", target: "policy-0", label: "project.updated" }], "horizontal");

    const triggerNode = nodes.find((node) => node.key === "trigger");
    const policyNode = nodes.find((node) => node.key === "policy-0");

    expect(triggerNode).toMatchObject({
      x: workflowCanvasLayoutConfig.startX,
      y: workflowCanvasLayoutConfig.startY
    });
    expect(policyNode?.x).toBeGreaterThan((triggerNode?.x ?? 0) + workflowNodeSizes.trigger.minWidth);
    expect(policyNode?.y).toBe(triggerNode?.y);
  });

  it("caps horizontal spacing for long edge labels", () => {
    const nodes = positionWorkflowNodes([
      {
        key: "trigger",
        kind: "trigger",
        width: workflowNodeSizes.trigger.minWidth,
        height: workflowNodeSizes.trigger.height,
        direction: "horizontal"
      },
      {
        key: "policy-0",
        kind: "policy",
        width: workflowNodeSizes.policy.minWidth,
        height: workflowNodeSizes.policy.height,
        direction: "horizontal"
      }
    ], [{ source: "trigger", target: "policy-0", label: "x".repeat(500) }], "horizontal");

    const policyNode = nodes.find((node) => node.key === "policy-0");

    expect(policyNode?.x).toBeLessThan(300);
  });

  it("keeps default smart edge routing for same-row edges and tightens cross-row routing", () => {
    expect(workflowSmartEdgeRoutingOptions({ sourceY: 125.5, targetY: 125.5 })).toBe(smartEdgePresets.step);
    expect(workflowSmartEdgeRoutingOptions({ sourceY: 125.5, targetY: 75.5 })).toMatchObject({
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
      workflowRoutingTestNode({ id: "trigger", x: 32, y: 64, width: 28, height: 22 }),
      workflowRoutingTestNode({ id: "policy-0", x: 238, y: 64, width: 174, height: 22 }),
      workflowRoutingTestNode({ id: "policy-1", x: 597, y: 64, width: 112, height: 22 }),
      workflowRoutingTestNode({ id: "policy-3", x: 956, y: 64, width: 181, height: 22 }),
      workflowRoutingTestNode({ id: "policy-6", x: 1315, y: 64, width: 112, height: 22 }),
      workflowRoutingTestNode({ id: "policy-2", x: 597, y: 114, width: 132, height: 22 }),
      workflowRoutingTestNode({ id: "policy-8", x: 956, y: 114, width: 118, height: 22 }),
      workflowRoutingTestNode({ id: "output-event-8-ready", x: 1315, y: 114, width: 76, height: 22 }),
      workflowRoutingTestNode({ id: "output-event-8-blocked", x: 1315, y: 160, width: 76, height: 22 })
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
      options: workflowSmartEdgeRoutingOptions({ sourceY, targetY })
    });

    expect(defaultRoute).not.toBeInstanceOf(Error);
    expect(directedRoute).not.toBeInstanceOf(Error);
    expect(defaultRoute instanceof Error ? undefined : firstRoutedPointMovingVertically(defaultRoute.points, sourceY)?.[1]).toBeGreaterThan(sourceY);
    expect(directedRoute instanceof Error ? undefined : firstRoutedPointMovingVertically(directedRoute.points, sourceY)?.[1]).toBeLessThan(sourceY);
  });
});

describe("calculateWorkflowCanvasLayout", () => {
  it("uses selected action outputs as policy output events", () => {
    expect(policyOutputEventTypes({ action: "build" }, [{ id: "build", outputIds: ["complete", "failed"] }])).toEqual([
      "build.complete",
      "build.failed"
    ]);
  });

  it("creates a trigger and first-policy ghost for an empty workflow", () => {
    const layout = layoutFor([], []);
    const triggerNode = layout.nodes.find((node) => node.key === "trigger");

    expect(layout.nodes.map((node) => node.kind)).toEqual(["trigger", "first-policy-ghost"]);
    expect(triggerNode).toMatchObject({
      width: workflowNodeSizes.trigger.minWidth,
      height: workflowNodeSizes.trigger.height
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
    const layout = calculateWorkflowCanvasLayout({
      workflowGraph: buildWorkflowGraph([{
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
    const layout = calculateWorkflowCanvasLayout({
      workflowGraph: buildWorkflowGraph([{
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
    const layout = calculateWorkflowCanvasLayout({
      workflowGraph: buildWorkflowGraph([
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
            "aggregate-review.changes_requested",
            "aggregate-review.blocked"
          ]
        }
      ]),
      editingPolicyIndex: null
    });
    const sourceNode = layout.nodes.find((node) => node.key === "policy-1");
    const outputEventNodes = [
      layout.nodes.find((node) => node.key === "output-event-1-aggregate-review.approved"),
      layout.nodes.find((node) => node.key === "output-event-1-aggregate-review.changes_requested"),
      layout.nodes.find((node) => node.key === "output-event-1-aggregate-review.blocked")
    ];

    expect(sourceNode).toBeDefined();
    expect(outputEventNodes.every(Boolean)).toBe(true);
    outputEventNodes.forEach((node) => expect(node?.x).toBeGreaterThan(sourceNode?.x ?? 0));
    const outputEventStep = workflowNodeSizes.outputEvent.height + workflowNodeSizes.outputEvent.rowGap;
    expect(outputEventNodes.map((node) => node?.y)).toEqual([
      sourceNode ? sourceNode.y : undefined,
      sourceNode ? sourceNode.y + outputEventStep : undefined,
      sourceNode ? sourceNode.y + outputEventStep * 2 : undefined
    ]);
  });

  it("renders every output target as an output-event node", () => {
    const start = policy("start", undefined, "build");
    const layout = calculateWorkflowCanvasLayout({
      workflowGraph: buildWorkflowGraph([{
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
      width: workflowNodeSizes.outputEvent.minWidth
    });
    expect(summaryOutputNode).toMatchObject({
      kind: "output-event",
      outputEvent: { outputId: "summary", eventType: "build.summary", outputType: "event" },
      width: workflowNodeSizes.outputEvent.minWidth
    });
    expect(summaryOutputNode?.y).toBe(outputEventNode
      ? outputEventNode.y + workflowNodeSizes.outputEvent.height + workflowNodeSizes.outputEvent.rowGap
      : undefined);
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

  it("places unhandled done output events after active child policies", () => {
    const start = policy("start", undefined, "design");
    const child = policy("release", "design.ready", "release");
    const layout = calculateWorkflowCanvasLayout({
      workflowGraph: buildWorkflowGraph([
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
    expect(workflowTestRectsOverlap(doneOutputNode!, childNode!)).toBe(false);
    expect(doneOutputNode!.x).toBe(childNode!.x);
    expect(doneOutputNode!.y).toBe(childNode!.y + childNode!.height + workflowNodeSizes.outputEvent.rowGap);
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
      sourceHandleId: "right",
      targetHandleId: "left",
      dashed: true,
      eventType: "build.failed",
      label: "failed"
    });
    expect(outputEventNode?.x).toBe(childNode?.x);
    expect(outputEventNode?.y).toBe(childNode
      ? childNode.y + workflowPolicyStackHeight() + workflowNodeSizes.outputEvent.rowGap
      : undefined);
    expect(layout.nodes.some((node) => node.kind === "output-event" && node.outputEvent?.eventType === "build.complete")).toBe(false);
  });

  it("reserves horizontal space for incoming policy edge labels", () => {
    const first = policy("first", undefined, "route-project");
    const child = policy("child", "review-intent.changes_requested", "analyze-intent");
    const layout = calculateWorkflowCanvasLayout({
      workflowGraph: buildWorkflowGraph([
        {
          policyId: first.id,
          index: 0,
          policy: first,
          outputEvents: ["review-intent.changes_requested"]
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
    const layout = calculateWorkflowCanvasLayout({
      workflowGraph: buildWorkflowGraph([
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
    expect(failedChildNode?.y).toBe(firstNode ? firstNode.y + workflowPolicyStackHeight() + workflowCanvasLayoutConfig.branchGap : undefined);
    expect(outputEventNode?.x).toBe(completeChildNode?.x);
    expect(outputEventNode?.y).toBe(failedChildNode
      ? failedChildNode.y + workflowPolicyStackHeight() + workflowNodeSizes.outputEvent.rowGap
      : undefined);
  });

  it("reserves clearance below output ghost nodes before the next horizontal lane", () => {
    const createMilestones = policy("create-milestones", undefined, "create-milestones");
    createMilestones.trigger = "technical_plan_approved";
    const challengeMilestones = policy("challenge-milestones", "create-milestones.ready", "challenge-milestones");
    const reworkMilestones = policy("rework-milestones", "challenge-milestones.changes_requested", "create-milestones");
    const createTaskSpecs = policy("create-task-specs", undefined, "create-task-specs");
    createTaskSpecs.trigger = "milestones_approved";
    const challengeTaskSpecs = policy("challenge-task-specs", "create-task-specs.ready", "challenge-task-specs");
    const reworkTaskSpecs = policy("rework-task-specs", "challenge-task-specs.changes_requested", "create-task-specs");
    const layout = calculateWorkflowCanvasLayout({
      workflowGraph: buildWorkflowGraph([
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
            { outputId: "changes_requested", eventType: "challenge-milestones.changes_requested", type: "event" }
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
            { outputId: "changes_requested", eventType: "challenge-task-specs.changes_requested", type: "event" }
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
      ? challengeMilestonesNode.y + workflowPolicyStackHeight() + workflowNodeSizes.outputEvent.rowGap
      : undefined);
    expect(createTaskSpecsNode?.y).toBe(createMilestonesNode
      ? createMilestonesNode.y +
        workflowPolicyStackHeight() +
        workflowNodeSizes.outputEvent.rowGap +
        workflowNodeSizes.outputEvent.height +
        workflowCanvasLayoutConfig.outputEventLaneClearance +
        workflowCanvasLayoutConfig.branchGap
      : undefined);
    expect(createTaskSpecsNode && blockedOutputNode
      ? createTaskSpecsNode.y - (blockedOutputNode.y + blockedOutputNode.height)
      : undefined).toBe(workflowCanvasLayoutConfig.outputEventLaneClearance + workflowCanvasLayoutConfig.branchGap);
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
    expect(outputEventNode?.x).toBe(childNode ? childNode.x + childNode.width + workflowCanvasLayoutConfig.branchGap : undefined);
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
    const records: WorkflowStepRecord[] = [
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
    const layout = calculateWorkflowCanvasLayout({
      workflowGraph: buildWorkflowGraph(records),
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
    const createRoadmap = policy("p05.on.project-brief-approved.create-roadmap", undefined, "create-roadmap");
    createRoadmap.trigger = "project_brief_approved";
    const challengeRoadmap = policy("p06.on.roadmap-ready.challenge-roadmap", "create-roadmap.ready", "challenge-roadmap");
    const reworkRoadmap = policy("p07.on.roadmap-rework.create-roadmap", "challenge-roadmap.changes_requested", "create-roadmap");
    const done = policy("p08.on.roadmap-approved.done", "challenge-roadmap.approved", "done");
    const records: WorkflowStepRecord[] = [
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
          { outputId: "changes_requested", eventType: "challenge-roadmap.changes_requested", type: "event" }
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
    const layout = calculateWorkflowCanvasLayout({
      workflowGraph: buildWorkflowGraph(records),
      editingPolicyIndex: null
    });
    const policyNodes = layout.nodes.filter((node) => node.kind === "policy");
    const returnEdge = layout.edges.find((edge) => edge.eventType === "challenge-roadmap.changes_requested");

    expect(policyNodes.map((node) => node.record?.policy?.action)).toEqual([
      "create-roadmap",
      "challenge-roadmap",
      "done"
    ]);
    expect(layout.nodes.find((node) => node.key === "policy-2")).toBeUndefined();
    expect(layout.nodes.filter((node) => node.kind === "output-event" && node.record?.index === 2)).toHaveLength(0);
    expect(layout.nodes.find((node) => node.key === "policy-0")?.records?.map((record) => record.policyId)).toEqual([
      "p05.on.project-brief-approved.create-roadmap",
      "p07.on.roadmap-rework.create-roadmap"
    ]);
    expect(returnEdge).toMatchObject({
      sourceNodeKey: "policy-1",
      targetNodeKey: "policy-0",
      tone: "return",
      label: "changes_requested"
    });
  });
});

describe("calculateCompositeWorkflowCanvasLayout", () => {
  it("keeps a selected workflow alone when outputRoutes is empty", () => {
    const config = compositeConfig(["source", "target"]);
    const layout = calculateCompositeWorkflowCanvasLayout({
      config,
      selectedWorkflowId: "source",
      recordsByWorkflowId: compositeRecords(config)
    });

    expect(layout.nodes.map((node) => node.key)).toEqual(expect.arrayContaining([
      "workflow:source:trigger",
      "workflow:source:policy-0",
      "workflow:source:output-event-0-ready",
      "workflow:source:output-event-0-blocked"
    ]));
    expect(layout.nodes.some((node) => node.key.startsWith("workflow:target:"))).toBe(false);
  });

  it("renders a trigger-routed target workflow below the selected workflow with namespaced keys", () => {
    const config = compositeConfig(["source", "target"], [{
      sourcePolicyId: "source-start",
      outputId: "ready",
      target: { type: "trigger", trigger: "target-trigger" }
    }]);
    const layout = calculateCompositeWorkflowCanvasLayout({
      config,
      selectedWorkflowId: "source",
      recordsByWorkflowId: compositeRecords(config)
    });
    const sourceTrigger = layout.nodes.find((node) => node.key === "workflow:source:trigger");
    const targetTrigger = layout.nodes.find((node) => node.key === "workflow:target:trigger");
    const crossEdge = layout.edges.find((edge) => edge.key === "workflow:source:output:0:ready:to:target:trigger");

    expect(layout.nodes.every((node) => node.key.startsWith("workflow:"))).toBe(true);
    expect(new Set(layout.nodes.map((node) => node.key)).size).toBe(layout.nodes.length);
    expect(layout.nodes.map((node) => node.key)).toEqual(expect.arrayContaining([
      "workflow:source:trigger",
      "workflow:source:policy-0",
      "workflow:target:trigger",
      "workflow:target:policy-0"
    ]));
    expect(layout.nodes.find((node) => node.key === "workflow:source:output-event-0-ready")).toBeUndefined();
    expect(sourceTrigger?.x).toBe(targetTrigger?.x);
    expect(targetTrigger?.y).toBeGreaterThan(sourceTrigger?.y ?? 0);
    expect(crossEdge).toMatchObject({
      sourceNodeKey: "workflow:source:policy-0",
      targetNodeKey: "workflow:target:trigger",
      sourceHandleId: "right",
      targetHandleId: "left",
      eventType: "trigger.target-trigger",
      label: "ready",
      tone: "cross-workflow"
    });
  });

  it("renders a trigger-routed target workflow above the selected workflow when config order is above", () => {
    const config = compositeConfig(["target", "source"], [{
      sourcePolicyId: "source-start",
      outputId: "ready",
      target: { type: "trigger", trigger: "target-trigger", workflowId: "target" }
    }]);
    const layout = calculateCompositeWorkflowCanvasLayout({
      config,
      selectedWorkflowId: "source",
      recordsByWorkflowId: compositeRecords(config)
    });
    const sourceTrigger = layout.nodes.find((node) => node.key === "workflow:source:trigger");
    const targetTrigger = layout.nodes.find((node) => node.key === "workflow:target:trigger");

    expect(sourceTrigger).toBeDefined();
    expect(targetTrigger).toBeDefined();
    expect(sourceTrigger?.x).toBe(targetTrigger?.x);
    expect(targetTrigger?.y).toBeLessThan(sourceTrigger?.y ?? 0);
  });

  it("protects circular trigger-routed workflow references from recursive layout", () => {
    const config = compositeConfig(["source", "target"], [
      {
        sourcePolicyId: "source-start",
        outputId: "ready",
        target: { type: "trigger", trigger: "target-trigger" }
      },
      {
        sourcePolicyId: "target-start",
        outputId: "done",
        target: { type: "trigger", trigger: "source-trigger" }
      }
    ]);
    const layout = calculateCompositeWorkflowCanvasLayout({
      config,
      selectedWorkflowId: "source",
      recordsByWorkflowId: compositeRecords(config)
    });

    expect(layout.nodes.filter((node) => node.kind === "trigger")).toHaveLength(2);
    expect(layout.nodes.filter((node) => node.kind === "policy")).toHaveLength(2);
    expect(layout.edges.filter((edge) => edge.targetNodeKey.endsWith(":trigger"))).toHaveLength(2);
    expect(new Set(layout.nodes.map((node) => node.key)).size).toBe(layout.nodes.length);
  });
});

describe("toWorkflowReactFlowEdges", () => {
  it("anchors stepped workflow edge labels to the longest horizontal segment", () => {
    expect(workflowRoutedEdgeLabelAnchor({
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

    expect(workflowRoutedEdgeLabelAnchor({
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
    expect(workflowRoutedEdgeLabelAnchor({
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

    const topReturnPath = workflowReturnEdgePath({
      ...baseProps,
      targetY: topTargetNode.y,
      data: {
        workflowEdge: {
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
    expect(workflowReturnEdgePath({
      ...baseProps,
      targetY: topTargetNode.y,
      data: {
        workflowEdge: {
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
    expect(workflowReturnEdgePath({
      ...baseProps,
      targetY: bottomTargetNode.y + bottomTargetNode.height,
      data: {
        workflowEdge: {
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

  it("maps workflow layout edges to smart ReactFlow edges", () => {
    const [edge] = toWorkflowReactFlowEdges([{
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
      type: "workflowSmart",
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
      "data-workflow-connector": "true",
      "data-dashed": "false",
      "data-workflow-edge-tone": "return",
      "data-workflow-edge-animated": "false"
    });
    expect(edge.animated).toBe(false);
    expect(edge.data?.workflowEdge.eventType).toBe("implementation.complete");
    expect(edge.data?.workflowEdge.label).toBe("complete");
    expect(edge.style).toMatchObject({
      stroke: "color-mix(in srgb, var(--tertiary) 85%, transparent)",
      strokeWidth: 2
    });
    expect(edge.style?.strokeDasharray).toBeUndefined();
    expect(edge.markerEnd).toBeUndefined();
  });

  it("maps every workflow edge to SmartStepEdge", () => {
    const edges = toWorkflowReactFlowEdges([
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

    expect(edges.map((edge) => edge.type)).toEqual(["workflowSmart", "workflowSmart", "workflowSmart"]);
  });

  it("maps cross-workflow edges to the workflow highlight stroke", () => {
    const [edge] = toWorkflowReactFlowEdges([{
      key: "workflow:source:output:0:ready:to:target:trigger",
      sourceNodeKey: "workflow:source:policy-0",
      targetNodeKey: "workflow:target:trigger",
      sourceHandleId: "right",
      targetHandleId: "left",
      tone: "cross-workflow"
    }]);

    expect(edge.domAttributes).toMatchObject({
      "data-workflow-edge-tone": "cross-workflow"
    });
    expect(edge.style).toMatchObject({
      stroke: "color-mix(in srgb, var(--secondary) 72%, transparent)",
      strokeWidth: 2
    });
  });

  it("renders cross-workflow edges as smoothstep paths", () => {
    const path = workflowCrossWorkflowSmoothStepPath({
      id: "workflow:source:output:0:ready:to:target:trigger",
      source: "workflow:source:policy-0",
      target: "workflow:target:trigger",
      selected: false,
      sourceX: 1000,
      sourceY: 76,
      targetX: 32,
      targetY: 280,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      data: {
        workflowEdge: {
          key: "workflow:source:output:0:ready:to:target:trigger",
          sourceNodeKey: "workflow:source:policy-0",
          targetNodeKey: "workflow:target:trigger",
          tone: "cross-workflow"
        }
      }
    });

    expect(path.path).not.toContain("C");
    expect(path.path.match(/Q/g)).toHaveLength(4);
    expect(path.path).toContain("M1000 76L 1040,76Q 1064,76 1064,100");
    expect(path.path).toContain("L -32,256Q -32,280 -8,280L32 280");
    expect(path.labelX).toBe(516);
    expect(path.labelY).toBe(178);
  });

  it("marks one workflow edge as animated when requested", () => {
    const edges = toWorkflowReactFlowEdges([
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
    expect(edges[0]?.domAttributes?.["data-workflow-edge-animated"]).toBe("false");
    expect(edges[1]).toMatchObject({
      animated: true,
      className: "workflow-edge-animated",
      domAttributes: {
        "data-workflow-edge-animated": "true"
      }
    });
  });

});
