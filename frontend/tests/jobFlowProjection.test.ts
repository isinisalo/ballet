import { describe, expect, it } from "vitest";
import type { ProjectJobNode } from "@shared/api/workspace-contracts";
import { jobFlowLayout, projectJobFlow } from "../src/workspace/automation/jobFlowProjection";

describe("Action flow projection", () => {
  it.each(["wide", "narrow"] as const)("produces a deterministic %s layout", (viewport) => {
    const first = jobFlowLayout(viewport, true);
    expect(jobFlowLayout(viewport, true)).toEqual(first);
    expect(first.points.retryCount).toBeDefined();
    expect(first.points.continue).toBeDefined();
    expect(projectJobFlow(jobNode(2)).retryCount).toBe(2);
    expect(first.points.result.y).toBe(first.points.retry.y);
    expect(first.points.escalate.y).toBe(first.points.continue.y);
    expect(first.points.retryCount.x).toBeLessThan(first.points.retry.x);
    expect(first.points.retryCount.x).toBe(viewport === "wide" ? 70 : 72);
    expect(first.points.retryCount.y).toBe(viewport === "wide" ? 430 : 360);
    expect(first.edges.some((edge) => edge.id === "result-continue")).toBe(true);
    expect(first.edges.some((edge) => edge.id === "retry-work")).toBe(true);
    expect(first.edges.find((edge) => edge.id === "retry-work")?.tone).toBe("retry");
    expect(first.edges.find((edge) => edge.id === "retry-work")?.path).toBe(
      viewport === "wide" ? "M190 394 L190 170 L256 170" : "M145 394 L145 170 L166 170",
    );
    expect(first.edges.some((edge) => edge.id === "retry-count")).toBe(false);
    expect(first.edges.some((edge) => edge.id.includes("orchestrator") || edge.id.includes("next"))).toBe(false);
  });

  it("removes the retry return route when maxRetries is zero", () => {
    const projection = projectJobFlow(jobNode(0));
    const layout = jobFlowLayout("wide", projection.retryEnabled);

    expect(projection.retryEnabled).toBe(false);
    expect(projection.retryCount).toBe(0);
    expect(layout.edges.some((edge) => edge.id === "retry-work")).toBe(false);
    expect(layout.edges.some((edge) => edge.id === "retry-escalate")).toBe(true);
    expect(layout.edges.some((edge) => edge.id === "retry-count")).toBe(false);
  });

  it("marks structurally incomplete Work and Validation definitions as ghosts", () => {
    const job = jobNode(1);
    const projection = projectJobFlow({
      ...job,
      workNode: { ...job.workNode, task: "" },
      validationNode: { ...job.validationNode, primaryInstructionId: "" }
    });

    expect(projection.workDefined).toBe(false);
    expect(projection.validationDefined).toBe(false);
    expect(projection.retryEnabled).toBe(true);
  });
});

const jobNode = (maxRetries: number): ProjectJobNode => ({
  id: "job", description: "Action", nodeStyle: "terra", nodeSize: "medium",
  capabilities: { accepts: [], provides: [] }, maxRetries,
  workNode: {
    id: "work", description: "Work", task: "Perform work.", type: "agent", nodeStyle: "sol", nodeSize: "large",
    executionProfileId: "luna-medium", primaryInstructionId: "project:work", skillIds: []
  },
  validationNode: {
    id: "validation", description: "Validation", task: "Verify work.", type: "agent", nodeStyle: "luna", nodeSize: "small",
    executionProfileId: "luna-medium", primaryInstructionId: "project:validation", skillIds: []
  }
});
