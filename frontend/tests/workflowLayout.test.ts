import { describe, expect, it } from "vitest";
import type { ProjectPolicy } from "../../shared/api/workspace-contracts";
import { policyOutputEventTypes } from "../../shared/policy-actions";
import { buildWorkflowGraph, type WorkflowStepRecord } from "../src/workspace/automation/workflows/workflowGraph";
import { toWorkflowReactFlowEdges } from "../src/workspace/automation/workflows/WorkflowCanvas";
import { calculateWorkflowCanvasLayout, workflowCanvasLayoutConfig, workflowPolicyStackHeight, type WorkflowLayoutDirection } from "../src/workspace/automation/workflows/workflowLayout";

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

  it("renders multiple unhandled outputs in one output-events node", () => {
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
    const outputEventsNode = layout.nodes.find((node) => node.key === "output-events-0");

    expect(outputEventsNode).toMatchObject({
      kind: "output-events",
      outputEvents: [
        { eventType: "codex.build.complete" },
        { eventType: "codex.build.failed" },
        { eventType: "codex.build.blocked" }
      ]
    });
    expect(layout.edges.filter((edge) => edge.sourceNodeKey === "policy-0" && edge.targetNodeKey === "output-events-0")).toHaveLength(1);
  });

  it("groups unhandled output events in the next policy column after active policies", () => {
    const first = policy("first", undefined, "build");
    const child = policy("child", "codex.build.complete", "deploy");
    const layout = layoutFor([first, child], [first.id, child.id]);
    const firstNode = layout.nodes.find((node) => node.key === "policy-0");
    const childNode = layout.nodes.find((node) => node.key === "policy-1");
    const outputEventsNode = layout.nodes.find((node) => node.key === "output-events-0");
    const outputEventsEdge = layout.edges.find((edge) => edge.key === "policy-output-events-0");

    expect(layout.nodes.filter((node) => node.kind === "policy").map((node) => node.record?.policyId)).toEqual(["first", "child"]);
    expect(childNode?.x).toBeGreaterThan(firstNode?.x ?? 0);
    expect(childNode?.y).toBe(firstNode?.y);
    expect(layout.edges).toContainEqual(expect.objectContaining({
      key: "policy-policy-0-1-codex.build.complete",
      sourceNodeKey: "policy-0",
      targetNodeKey: "policy-1",
      sourceHandleId: "right",
      targetHandleId: "left",
      eventType: "codex.build.complete"
    }));
    expect(outputEventsNode).toMatchObject({
      kind: "output-events",
      sourcePolicyId: first.id,
      outputEvents: [{ eventType: "codex.build.failed" }]
    });
    expect(outputEventsEdge).toMatchObject({
      sourceNodeKey: "policy-0",
      targetNodeKey: "output-events-0",
      sourceHandleId: "right",
      targetHandleId: "left"
    });
    expect(outputEventsNode?.x).toBe(childNode?.x);
    expect(outputEventsNode?.y).toBe(childNode ? childNode.y + workflowPolicyStackHeight() : undefined);
    expect(layout.nodes.some((node) => node.kind === "output-events" && node.outputEvents?.some((event) => event.eventType === "codex.build.complete"))).toBe(false);
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
    const outputEventsNode = layout.nodes.find((node) => node.key === "output-events-0");

    expect(firstNode?.y).toBe(triggerNode?.y);
    expect(completeChildNode?.y).toBe(firstNode?.y);
    expect(failedChildNode?.y).toBe(firstNode ? firstNode.y + workflowPolicyStackHeight() + workflowCanvasLayoutConfig.branchGap : undefined);
    expect(outputEventsNode?.x).toBe(completeChildNode?.x);
    expect(outputEventsNode?.y).toBe(failedChildNode ? failedChildNode.y + workflowPolicyStackHeight() : undefined);
  });

  it("lays out child event policies below the source policy in vertical mode", () => {
    const first = policy("first", undefined, "build");
    const child = policy("child", "codex.build.complete", "deploy");
    const layout = layoutFor([first, child], [first.id, child.id], null, "vertical");
    const firstNode = layout.nodes.find((node) => node.key === "policy-0");
    const childNode = layout.nodes.find((node) => node.key === "policy-1");
    const outputEventsNode = layout.nodes.find((node) => node.key === "output-events-0");

    expect(layout.direction).toBe("vertical");
    expect(childNode?.y).toBeGreaterThan(firstNode?.y ?? 0);
    expect(outputEventsNode?.x).toBe(childNode ? childNode.x + childNode.width + workflowCanvasLayoutConfig.branchGap : undefined);
    expect(outputEventsNode?.y).toBe(childNode?.y);
    expect(layout.edges).toContainEqual(expect.objectContaining({
      key: "policy-policy-0-1-codex.build.complete",
      sourceHandleId: "bottom",
      targetHandleId: "top"
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
    const reworkOutputEventsNode = layout.nodes.find((node) => node.key === "output-events-2");

    expect(repeatedHandlerEdge).toBeDefined();
    expect(repeatedHandlerEdge).toMatchObject({
      sourceNodeKey: "policy-2",
      targetNodeKey: "policy-1",
      sourceHandleId: "right",
      targetHandleId: "left",
      tone: "return",
      eventType: "developer.implement.completed"
    });
    expect(reworkOutputEventsNode?.outputEvents).toEqual([{ eventType: "developer.implement.failed" }]);
    expect(reworkOutputEventsNode?.outputEvents?.some((event) => event.eventType === "developer.implement.completed")).toBe(false);
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
});
