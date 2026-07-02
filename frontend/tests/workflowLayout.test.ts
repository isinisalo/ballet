import { describe, expect, it } from "vitest";
import type { ProjectPolicy } from "../../shared/api/workspace-contracts";
import { policyOutputEventTypes } from "../../shared/policy-actions";
import { buildWorkflowGraph, type WorkflowStepRecord } from "../src/workspace/automation/workflows/workflowGraph";
import { toWorkflowReactFlowEdges } from "../src/workspace/automation/workflows/WorkflowCanvas";
import { calculateWorkflowCanvasLayout, type WorkflowLayoutDirection } from "../src/workspace/automation/workflows/workflowLayout";

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

  it("lays out child event policies under the source policy output", () => {
    const first = policy("first", undefined, "build");
    const child = policy("child", "codex.build.complete", "deploy");
    const layout = layoutFor([first, child], [first.id, child.id]);
    const firstNode = layout.nodes.find((node) => node.key === "policy-0");
    const childNode = layout.nodes.find((node) => node.key === "policy-1");
    const failedEventAnchor = layout.nodes.find((node) => node.kind === "event-anchor" && node.eventType === "codex.build.failed");
    const failedEventEdge = layout.edges.find((edge) => edge.key === "policy-event-0-codex.build.failed-0");

    expect(layout.nodes.filter((node) => node.kind === "policy").map((node) => node.record?.policyId)).toEqual(["first", "child"]);
    expect(childNode?.x).toBeGreaterThan(firstNode?.x ?? 0);
    expect(layout.edges).toContainEqual(expect.objectContaining({
      key: "policy-policy-0-1-codex.build.complete",
      sourceNodeKey: "policy-0",
      targetNodeKey: "policy-1",
      sourceHandleId: "right",
      targetHandleId: "left"
    }));
    expect(failedEventAnchor).toMatchObject({
      kind: "event-anchor",
      eventType: "codex.build.failed"
    });
    expect(failedEventEdge?.label).toMatchObject({
      kind: "event-ghost",
      eventType: "codex.build.failed",
      interactive: true
    });
    expect(failedEventEdge?.label?.x).toBe(failedEventAnchor ? failedEventAnchor.x + failedEventAnchor.width / 2 : undefined);
  });

  it("lays out child event policies below the source policy in vertical mode", () => {
    const first = policy("first", undefined, "build");
    const child = policy("child", "codex.build.complete", "deploy");
    const layout = layoutFor([first, child], [first.id, child.id], null, "vertical");
    const firstNode = layout.nodes.find((node) => node.key === "policy-0");
    const childNode = layout.nodes.find((node) => node.key === "policy-1");

    expect(layout.direction).toBe("vertical");
    expect(childNode?.y).toBeGreaterThan(firstNode?.y ?? 0);
    expect(layout.edges).toContainEqual(expect.objectContaining({
      key: "policy-policy-0-1-codex.build.complete",
      sourceHandleId: "bottom",
      targetHandleId: "top"
    }));
  });

  it("links repeated output events through ghost events to existing handler policies", () => {
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

    expect(repeatedHandlerEdge).toBeDefined();
    expect(repeatedHandlerEdge).toMatchObject({
      sourceNodeKey: "policy-2",
      targetNodeKey: "policy-1",
      sourceHandleId: "right",
      targetHandleId: "left",
      label: expect.objectContaining({
        kind: "handled-event",
        eventType: "developer.implement.completed",
        interactive: false
      })
    });
    expect(layout.nodes.some((node) => node.kind === "event-anchor" && node.eventType === "developer.implement.completed" && node.record?.index === 2)).toBe(false);
    expect(repeatedHandlerEdge?.label?.x).toBeGreaterThan((layout.nodes.find((node) => node.key === "policy-2")?.x ?? 0));
  });
});

describe("toWorkflowReactFlowEdges", () => {
  it("maps workflow layout edges to smart ReactFlow edges", () => {
    const [edge] = toWorkflowReactFlowEdges([{
      key: "event-policy-2-1-existing.implementation.complete",
      sourceNodeKey: "event-2-existing.implementation.complete-handled",
      targetNodeKey: "policy-1",
      sourceHandleId: "right",
      targetHandleId: "left",
      dashed: true,
      label: {
        kind: "event-ghost",
        eventType: "existing.implementation.complete",
        interactive: true,
        x: 320,
        y: 140
      }
    }]);

    expect(edge).toMatchObject({
      id: "event-policy-2-1-existing.implementation.complete",
      type: "workflowSmart",
      source: "event-2-existing.implementation.complete-handled",
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
      "data-dashed": "true"
    });
    expect(edge.data?.workflowEdge.label).toMatchObject({
      kind: "event-ghost",
      eventType: "existing.implementation.complete",
      interactive: true,
      x: 320,
      y: 140
    });
    expect(edge.style).toMatchObject({
      stroke: "color-mix(in srgb, var(--muted-foreground) 70%, transparent)",
      strokeDasharray: "6 5",
      strokeWidth: 2
    });
  });
});
