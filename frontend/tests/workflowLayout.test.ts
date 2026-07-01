import { describe, expect, it } from "vitest";
import type { ProjectPolicy } from "../../shared/api/workspace-contracts";
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
    policy: policyById.get(policyId)
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
});
