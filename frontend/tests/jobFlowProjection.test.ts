import { describe, expect, it } from "vitest";
import type { ProjectJobNode } from "@shared/api/workspace-contracts";
import { jobFlowLayout, projectJobFlow } from "../src/workspace/automation/jobFlowProjection";

describe("Job flow projection", () => {
  it.each(["wide", "narrow"] as const)("produces a deterministic %s layout", (viewport) => {
    const first = jobFlowLayout(viewport, true);
    expect(jobFlowLayout(viewport, true)).toEqual(first);
    expect(first.points.orchestrator).toBeDefined();
    expect(first.edges.some((edge) => edge.id === "retry-work")).toBe(true);
  });

  it("removes the retry return route when maxRetries is zero", () => {
    const projection = projectJobFlow(jobNode(0));
    const layout = jobFlowLayout("wide", projection.retryEnabled);

    expect(projection.retryLabel).toBe("0 retries");
    expect(layout.edges.some((edge) => edge.id === "retry-work")).toBe(false);
    expect(layout.edges.some((edge) => edge.id === "retry-escalate")).toBe(true);
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
    expect(projection.retryLabel).toBe("1 retry");
  });
});

const jobNode = (maxRetries: number): ProjectJobNode => ({
  id: "job", description: "Job", nodeStyle: "terra", nodeSize: "medium",
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
