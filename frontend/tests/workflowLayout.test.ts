import { describe, expect, it } from "vitest";
import type { ProjectPolicy } from "../../shared/api/workspace-contracts";
import { policyOutputEventTypes } from "../../shared/policy-actions";
import { buildWorkflowGraph, type WorkflowStepRecord } from "../src/workspace/automation/workflows/workflowGraph";
import { toWorkflowReactFlowEdges } from "../src/workspace/automation/workflows/WorkflowCanvas";
import { calculateWorkflowCanvasLayout, workflowCanvasLayoutConfig, workflowNodeSizes, workflowPolicyOutputHandleY, workflowPolicyStackHeight, type WorkflowLayoutDirection } from "../src/workspace/automation/workflows/workflowLayout";

const policy = (id: string, event: string | undefined, action = "build"): ProjectPolicy => ({
  id,
  source: event ? "event" : "trigger",
  event,
  trigger: event ? undefined : "project.updated",
  agent: "codex",
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

describe("calculateWorkflowCanvasLayout", () => {
  it("uses selected action outputs as policy output events", () => {
    expect(policyOutputEventTypes({ agent: "codex", action: "build" }, [{ id: "build", outputIds: ["complete", "failed"] }])).toEqual([
      "codex.build.complete",
      "codex.build.failed"
    ]);
  });

  it("creates a trigger and first-policy ghost for an empty workflow", () => {
    const layout = layoutFor([], []);

    expect(layout.nodes.map((node) => node.kind)).toEqual(["trigger", "first-policy-ghost"]);
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
        outputEvents: ["codex.build.complete", "codex.build.failed", "codex.build.blocked"]
      }]),
      editingPolicyIndex: null
    });
    const outputEventNodes = layout.nodes.filter((node) => node.kind === "output-event");

    expect(outputEventNodes.map((node) => node.outputEvent?.eventType)).toEqual([
      "codex.build.complete",
      "codex.build.failed",
      "codex.build.blocked"
    ]);
    expect(outputEventNodes.map((node) => node.key)).toEqual([
      "output-event-0-codex.build.complete",
      "output-event-0-codex.build.failed",
      "output-event-0-codex.build.blocked"
    ]);
    expect(layout.edges.filter((edge) => edge.sourceNodeKey === "policy-0" && edge.targetNodeKey.startsWith("output-event-"))).toHaveLength(3);
  });

  it("renders gate outputs as active terminal nodes before inactive output-event nodes", () => {
    const start = policy("start", undefined, "build");
    const layout = calculateWorkflowCanvasLayout({
      workflowGraph: buildWorkflowGraph([{
        policyId: start.id,
        index: 0,
        policy: start,
        outputEvents: ["codex.build.failed"],
        outputTargets: [
          { outputId: "failed", eventType: "codex.build.failed", type: "event" },
          { outputId: "summary", eventType: "codex.build.summary", type: "gate" }
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
      height: workflowNodeSizes.gateOutput.height
    });
    expect(policyNode?.outputHandleCount).toBe(2);
    expect(gateNode?.width).toBeGreaterThanOrEqual(workflowNodeSizes.gateOutput.minWidth);
    expect(gateNode?.width).toBeLessThanOrEqual(workflowNodeSizes.gateOutput.maxWidth);
    expect(gateNode?.y).toBe(policyNode ? policyNode.y + workflowCanvasLayoutConfig.policyAnchorY - workflowNodeSizes.gateOutput.height / 2 : undefined);
    expect(outputEventNode).toMatchObject({
      kind: "output-event",
      outputEvent: { outputId: "failed", eventType: "codex.build.failed", outputType: "event" }
    });
    expect(outputEventNode?.y).toBe(policyNode
      ? policyNode.y + workflowPolicyOutputHandleY(1, policyNode.outputHandleCount ?? 0) - workflowNodeSizes.outputEvent.height / 2
      : undefined);
    expect(outputEventNode?.y).toBeGreaterThan(gateNode ? gateNode.y + gateNode.height : 0);
    expect(layout.edges).toContainEqual(expect.objectContaining({
      key: "policy-gate-output-0-summary",
      sourceNodeKey: "policy-0",
      targetNodeKey: "gate-output-0-summary",
      sourceHandleId: "right-output-0",
      targetHandleId: "left"
    }));
    expect(layout.edges.some((edge) => edge.sourceNodeKey === gateNode?.key)).toBe(false);
  });

  it("places unhandled output events in the next policy column after active policies", () => {
    const first = policy("first", undefined, "build");
    const child = policy("child", "codex.build.complete", "deploy");
    const layout = layoutFor([first, child], [first.id, child.id]);
    const firstNode = layout.nodes.find((node) => node.key === "policy-0");
    const childNode = layout.nodes.find((node) => node.key === "policy-1");
    const outputEventNode = layout.nodes.find((node) => node.key === "output-event-0-codex.build.failed");
    const outputEventEdge = layout.edges.find((edge) => edge.key === "policy-output-event-0-codex.build.failed");

    expect(layout.nodes.filter((node) => node.kind === "policy").map((node) => node.record?.policyId)).toEqual(["first", "child"]);
    expect(childNode?.x).toBeGreaterThan(firstNode?.x ?? 0);
    expect(childNode?.y).toBe(firstNode?.y);
    expect(layout.edges).toContainEqual(expect.objectContaining({
      key: "policy-policy-0-1-codex.build.complete",
      sourceNodeKey: "policy-0",
      targetNodeKey: "policy-1",
      sourceHandleId: "right-output-0",
      targetHandleId: "left",
      eventType: "codex.build.complete"
    }));
    expect(outputEventNode).toMatchObject({
      kind: "output-event",
      sourcePolicyId: first.id,
      outputEvent: { eventType: "codex.build.failed" }
    });
    expect(outputEventEdge).toMatchObject({
      sourceNodeKey: "policy-0",
      targetNodeKey: "output-event-0-codex.build.failed",
      sourceHandleId: "right-output-1",
      targetHandleId: "left",
      dashed: true
    });
    expect(outputEventNode?.x).toBe(childNode?.x);
    expect(outputEventNode?.y).toBe(childNode
      ? childNode.y + workflowPolicyStackHeight() + workflowNodeSizes.outputEvent.rowGap
      : undefined);
    expect(layout.nodes.some((node) => node.kind === "output-event" && node.outputEvent?.eventType === "codex.build.complete")).toBe(false);
  });

  it("keeps the primary horizontal policy path on the trigger baseline and stacks branches compactly below it", () => {
    const first = policy("first", undefined, "build");
    const completeChild = policy("complete-child", "codex.build.complete", "deploy");
    const failedChild = policy("failed-child", "codex.build.failed", "debug");
    const layout = calculateWorkflowCanvasLayout({
      workflowGraph: buildWorkflowGraph([
        {
          policyId: first.id,
          index: 0,
          policy: first,
          outputEvents: ["codex.build.complete", "codex.build.failed", "codex.build.blocked"]
        },
        {
          policyId: completeChild.id,
          index: 1,
          policy: completeChild,
          outputEvents: ["codex.deploy.complete"]
        },
        {
          policyId: failedChild.id,
          index: 2,
          policy: failedChild,
          outputEvents: ["codex.debug.complete"]
        }
      ]),
      editingPolicyIndex: null
    });
    const triggerNode = layout.nodes.find((node) => node.key === "trigger");
    const firstNode = layout.nodes.find((node) => node.key === "policy-0");
    const completeChildNode = layout.nodes.find((node) => node.key === "policy-1");
    const failedChildNode = layout.nodes.find((node) => node.key === "policy-2");
    const outputEventNode = layout.nodes.find((node) => node.key === "output-event-0-codex.build.blocked");

    expect(firstNode?.y).toBe(triggerNode?.y);
    expect(completeChildNode?.y).toBe(firstNode?.y);
    expect(failedChildNode?.y).toBeGreaterThan(firstNode ? firstNode.y + workflowPolicyStackHeight() + workflowCanvasLayoutConfig.branchGap : 0);
    expect(outputEventNode?.x).toBe(completeChildNode?.x);
    expect(outputEventNode?.y).toBe(failedChildNode
      ? failedChildNode.y + workflowPolicyStackHeight() + workflowNodeSizes.outputEvent.rowGap
      : undefined);
  });

  it("lays out child event policies below the source policy in vertical mode", () => {
    const first = policy("first", undefined, "build");
    const child = policy("child", "codex.build.complete", "deploy");
    const layout = layoutFor([first, child], [first.id, child.id], null, "vertical");
    const triggerNode = layout.nodes.find((node) => node.key === "trigger");
    const firstNode = layout.nodes.find((node) => node.key === "policy-0");
    const childNode = layout.nodes.find((node) => node.key === "policy-1");
    const outputEventNode = layout.nodes.find((node) => node.key === "output-event-0-codex.build.failed");
    const triggerPolicyEdge = layout.edges.find((edge) => edge.key === "trigger-policy-0");

    expect(layout.direction).toBe("vertical");
    expect(triggerNode ? triggerNode.x + triggerNode.width / 2 : undefined).toBe(firstNode ? firstNode.x + firstNode.width / 2 : undefined);
    expect(childNode?.y).toBeGreaterThan(firstNode?.y ?? 0);
    expect(outputEventNode?.x).toBe(childNode ? childNode.x + childNode.width + workflowCanvasLayoutConfig.branchGap : undefined);
    expect(outputEventNode?.y).toBe(childNode?.y);
    expect(triggerPolicyEdge).toMatchObject({
      sourceHandleId: "right",
      targetHandleId: "left"
    });
    expect(layout.edges).toContainEqual(expect.objectContaining({
      key: "policy-policy-0-1-codex.build.complete",
      sourceHandleId: "right-output-0",
      targetHandleId: "left"
    }));
  });

  it("links repeated output events directly to existing handler policies", () => {
    const implement = (id: string, event: string | undefined): ProjectPolicy => ({
      id,
      source: event ? "event" : "trigger",
      event,
      trigger: event ? undefined : "plan_approved",
      agent: "developer",
      action: "implement",
      enabled: true
    });
    const review: ProjectPolicy = {
      id: "architect-review",
      source: "event",
      event: "developer.implement.completed",
      agent: "architect",
      action: "review",
      enabled: true
    };
    const records: WorkflowStepRecord[] = [
      {
        policyId: "developer-implement-initial",
        index: 0,
        policy: implement("developer-implement-initial", undefined),
        outputEvents: ["developer.implement.completed", "developer.implement.failed"]
      },
      {
        policyId: review.id,
        index: 1,
        policy: review,
        outputEvents: ["architect.review.accepted", "architect.review.rejected"]
      },
      {
        policyId: "developer-implement-rework",
        index: 2,
        policy: implement("developer-implement-rework", "architect.review.rejected"),
        outputEvents: ["developer.implement.completed", "developer.implement.failed"]
      }
    ];
    const layout = calculateWorkflowCanvasLayout({
      workflowGraph: buildWorkflowGraph(records),
      editingPolicyIndex: null
    });

    const repeatedHandlerEdge = layout.edges.find((edge) => edge.key === "event-policy-2-1-developer.implement.completed");
    const reworkOutputEventNode = layout.nodes.find((node) => node.key === "output-event-2-developer.implement.failed");

    expect(repeatedHandlerEdge).toBeDefined();
    expect(repeatedHandlerEdge).toMatchObject({
      sourceNodeKey: "policy-2",
      targetNodeKey: "policy-1",
      sourceHandleId: "right-output-0",
      targetHandleId: "left",
      tone: "return",
      eventType: "developer.implement.completed"
    });
    expect(reworkOutputEventNode?.outputEvent).toEqual({
      outputId: "developer.implement.failed",
      eventType: "developer.implement.failed",
      outputType: "event"
    });
    expect(layout.nodes.some((node) => node.kind === "output-event" && node.record?.index === 2 && node.outputEvent?.eventType === "developer.implement.completed")).toBe(false);
  });
});

describe("toWorkflowReactFlowEdges", () => {
  it("maps workflow layout edges to smart ReactFlow edges", () => {
    const [edge] = toWorkflowReactFlowEdges([{
      key: "event-policy-2-1-existing.implementation.complete",
      sourceNodeKey: "policy-2",
      targetNodeKey: "policy-1",
      sourceHandleId: "right",
      targetHandleId: "left",
      dashed: true,
      tone: "return",
      eventType: "existing.implementation.complete"
    }]);

    expect(edge).toMatchObject({
      id: "event-policy-2-1-existing.implementation.complete",
      type: "workflowSmart",
      source: "policy-2",
      target: "policy-1",
      sourceHandle: "right",
      targetHandle: "left",
      selectable: false,
      focusable: false,
      reconnectable: false,
      interactionWidth: 0
    });
    expect(edge.type).not.toBe("smoothstep");
    expect(edge.domAttributes).toMatchObject({
      "data-workflow-connector": "true",
      "data-dashed": "true",
      "data-workflow-edge-tone": "return"
    });
    expect(edge.data?.workflowEdge.eventType).toBe("existing.implementation.complete");
    expect(edge.style).toMatchObject({
      stroke: "color-mix(in srgb, var(--tertiary) 85%, transparent)",
      strokeDasharray: "4 4",
      strokeWidth: 2
    });
    expect(edge.markerEnd).toMatchObject({
      color: "color-mix(in srgb, var(--tertiary) 85%, transparent)"
    });
  });

  it("maps every workflow edge to SmartStepEdge", () => {
    const edges = toWorkflowReactFlowEdges([
      {
        key: "policy-policy-0-1-codex.build.complete",
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
        key: "policy-output-event-0-codex.build.failed",
        sourceNodeKey: "policy-0",
        targetNodeKey: "output-event-0-codex.build.failed",
        sourceHandleId: "right",
        targetHandleId: "left"
      }
    ]);

    expect(edges.map((edge) => edge.type)).toEqual(["workflowSmart", "workflowSmart", "workflowSmart"]);
  });

});
