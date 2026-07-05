import { describe, expect, it } from "vitest";
import type { ProjectPolicy } from "../../shared/api/workspace-contracts";
import { policyOutputEventTypes } from "../../shared/policy-actions";
import { buildWorkflowGraph, type WorkflowStepRecord } from "../src/workspace/automation/workflows/workflowGraph";
import { toWorkflowReactFlowEdges } from "../src/workspace/automation/workflows/WorkflowCanvas";
import { calculateWorkflowCanvasLayout, workflowCanvasLayoutConfig, workflowNodeSizes, workflowPolicyStackHeight, type WorkflowLayoutDirection } from "../src/workspace/automation/workflows/workflowLayout";

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

const workflowTestRectsOverlap = (
  firstNode: { x: number; y: number; width: number; height: number },
  secondNode: { x: number; y: number; width: number; height: number }
) => firstNode.x < secondNode.x + secondNode.width &&
  firstNode.x + firstNode.width > secondNode.x &&
  firstNode.y < secondNode.y + secondNode.height &&
  firstNode.y + firstNode.height > secondNode.y;

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

  it("renders gate outputs as active terminal nodes before inactive output-event nodes", () => {
    const start = policy("start", undefined, "build");
    const layout = calculateWorkflowCanvasLayout({
      workflowGraph: buildWorkflowGraph([{
        policyId: start.id,
        index: 0,
        policy: start,
        outputEvents: ["build.failed"],
        outputTargets: [
          { outputId: "failed", eventType: "build.failed", type: "event" },
          { outputId: "summary", eventType: "build.summary", type: "gate" }
        ]
      }]),
      editingPolicyIndex: null
    });
    const gateNode = layout.nodes.find((node) => node.key === "gate-output-0-summary");
    const policyNode = layout.nodes.find((node) => node.key === "policy-0");
    const outputEventNode = layout.nodes.find((node) => node.key === "output-event-0-failed");

    expect(gateNode).toMatchObject({
      kind: "gate-output",
      gateOutput: { outputId: "summary", outputType: "gate" },
      height: workflowNodeSizes.gateOutput.height,
      width: workflowNodeSizes.gateOutput.minWidth
    });
    expect(policyNode?.outputHandleCount).toBe(2);
    expect(gateNode?.width).toBeGreaterThanOrEqual(workflowNodeSizes.gateOutput.minWidth);
    expect(gateNode?.width).toBeLessThanOrEqual(workflowNodeSizes.gateOutput.maxWidth);
    expect(gateNode?.y).toBe(policyNode ? policyNode.y + workflowCanvasLayoutConfig.policyAnchorY - workflowNodeSizes.gateOutput.height / 2 : undefined);
    expect(outputEventNode).toMatchObject({
      kind: "output-event",
      outputEvent: { outputId: "failed", eventType: "build.failed", outputType: "event" },
      width: workflowNodeSizes.outputEvent.minWidth
    });
    expect(outputEventNode?.y).toBe(gateNode
      ? gateNode.y + gateNode.height + workflowNodeSizes.outputEvent.rowGap
      : undefined);
    expect(outputEventNode?.y).toBeGreaterThan(gateNode ? gateNode.y + gateNode.height : 0);
    expect(layout.edges).toContainEqual(expect.objectContaining({
      key: "policy-gate-output-0-summary",
      sourceNodeKey: "policy-0",
      targetNodeKey: "gate-output-0-summary",
      sourceHandleId: "right",
      targetHandleId: "left",
      eventType: "build.summary",
      label: "summary"
    }));
    expect(layout.edges.some((edge) => edge.sourceNodeKey === gateNode?.key)).toBe(false);
  });

  it("keeps gate outputs from overlapping active child policies in the next column", () => {
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
            { outputId: "done", eventType: "design.done", type: "gate" }
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
    const gateNode = layout.nodes.find((node) => node.key === "gate-output-0-done");

    expect(gateNode).toBeDefined();
    expect(childNode).toBeDefined();
    expect(sourceNode).toBeDefined();
    expect(workflowTestRectsOverlap(gateNode!, childNode!)).toBe(false);
    expect(gateNode!.x).toBe(childNode!.x);
    expect(gateNode!.y).toBe(childNode!.y + childNode!.height + workflowNodeSizes.outputEvent.rowGap);
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

    const repeatedHandlerEdge = layout.edges.find((edge) => edge.key === "event-policy-2-1-implement.completed");
    const reworkOutputEventNodes = layout.nodes.filter((node) => node.kind === "output-event" && node.record?.index === 2);

    expect(repeatedHandlerEdge).toBeDefined();
    expect(repeatedHandlerEdge).toMatchObject({
      sourceNodeKey: "policy-2",
      targetNodeKey: "policy-1",
      sourceHandleId: "right",
      targetHandleId: "left",
      tone: "return",
      eventType: "implement.completed",
      label: "completed"
    });
    expect(reworkOutputEventNodes).toHaveLength(0);
  });
});

describe("toWorkflowReactFlowEdges", () => {
  it("maps workflow layout edges to smart ReactFlow edges", () => {
    const [edge] = toWorkflowReactFlowEdges([{
      key: "event-policy-2-1-implementation.complete",
      sourceNodeKey: "policy-2",
      targetNodeKey: "policy-1",
      sourceHandleId: "right",
      targetHandleId: "left",
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
      sourceHandle: "right",
      targetHandle: "left",
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
        key: "policy-gate-output-0-done",
        sourceNodeKey: "policy-0",
        targetNodeKey: "gate-output-0-done",
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
    ], undefined, "policy-output-event-0-build.failed");

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
