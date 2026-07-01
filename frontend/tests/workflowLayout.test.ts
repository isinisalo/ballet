import { describe, expect, it } from "vitest";
import type { ProjectPolicy } from "../../shared/api/workspace-contracts";
import { policyOutputEventTypes } from "../../shared/policy-actions";
import { buildWorkflowGraph, type WorkflowStepRecord } from "../src/workspace/automation/workflows/workflowGraph";
import { calculateWorkflowCanvasLayout, workflowConnectorPath } from "../src/workspace/automation/workflows/workflowLayout";

const policy = (id: string, event: string | undefined, action = "build"): ProjectPolicy => ({
  id,
  source: event ? "event" : "trigger",
  event,
  trigger: event ? undefined : "project.updated",
  agent: "codex",
  action,
  enabled: true
});

const layoutFor = (policies: ProjectPolicy[], steps: string[], editingPolicyIndex: number | null = null) => {
  const policyById = new Map(policies.map((item) => [item.id, item]));
  const records: WorkflowStepRecord[] = steps.map((policyId, index) => ({
    policyId,
    index,
    policy: policyById.get(policyId),
    outputEvents: policyById.get(policyId) ? policyOutputEventTypes(policyById.get(policyId)!, [{ id: policyById.get(policyId)!.action, outputIds: ["complete", "failed"] }]) : undefined
  }));

  return calculateWorkflowCanvasLayout({
    workflowGraph: buildWorkflowGraph(records),
    editingPolicyIndex
  });
};

describe("workflowConnectorPath", () => {
  it("draws a straight connector when points are horizontally aligned", () => {
    expect(workflowConnectorPath({ key: "edge", from: { x: 10, y: 20 }, to: { x: 80, y: 21 } })).toBe("M 10 20 H 80");
  });

  it("draws a stepped connector when vertical movement is needed", () => {
    expect(workflowConnectorPath({ key: "edge", from: { x: 10, y: 20 }, to: { x: 80, y: 100 } })).toBe("M 10 20 H 45 V 100 H 80");
  });
});

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
      expect.objectContaining({ key: "trigger-first-policy", dashed: true })
    ]);
  });

  it("lays out child event policies under the source policy output", () => {
    const first = policy("first", undefined, "build");
    const child = policy("child", "codex.build.complete", "deploy");
    const layout = layoutFor([first, child], [first.id, child.id]);

    expect(layout.nodes.filter((node) => node.kind === "policy").map((node) => node.record?.policyId)).toEqual(["first", "child"]);
    expect(layout.edges.some((edge) => edge.key === "policy-policy-0-1-codex.build.complete")).toBe(true);
    expect(layout.nodes.some((node) => node.kind === "event-ghost" && node.eventType === "codex.build.failed")).toBe(true);
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

    const handledEventNode = layout.nodes.find((node) =>
      node.kind === "handled-event-ghost" &&
      node.eventType === "developer.implement.completed" &&
      node.record?.index === 2
    );
    const repeatedHandlerEdge = layout.edges.find((edge) => edge.key === "event-policy-2-1-developer.implement.completed");
    const policyToGhostEdge = layout.edges.find((edge) => edge.key === "policy-handled-event-2-developer.implement.completed");

    expect(handledEventNode).toBeDefined();
    expect(policyToGhostEdge).toBeDefined();
    expect(repeatedHandlerEdge).toBeDefined();
    expect(repeatedHandlerEdge?.waypoints?.length).toBeGreaterThan(0);
    expect(layout.nodes.some((node) => node.kind === "event-ghost" && node.eventType === "developer.implement.completed" && node.record?.index === 2)).toBe(false);
  });
});
