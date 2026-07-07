import { describe, expect, it } from "vitest";
import type { ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import { workflowOutputHandlerForOutput } from "../src/workspace/automation/workflows/workflowOutputHandlers";

const config = (): ProjectAutomationConfig => ({
  version: 1,
  triggers: [{ id: "manual-start", description: "Manual start" }],
  actions: [
    { id: "build", description: "Build.", outputIds: ["ready", "blocked"], agentIds: ["agent-1"] },
    { id: "review", description: "Review.", outputIds: ["approved", "changes_requested"], agentIds: ["agent-1"] },
    { id: "done", description: "Done.", outputIds: [], agentIds: [] }
  ],
  outputs: [{ id: "ready" }, { id: "blocked" }, { id: "approved" }, { id: "changes_requested" }],
  outputRoutes: [{
    sourcePolicyId: "review-policy",
    outputId: "approved",
    target: { type: "event", eventType: "external.approved" }
  }, {
    sourcePolicyId: "review-policy",
    outputId: "blocked",
    target: { type: "trigger", trigger: "manual-start", workflowId: "workflow-2" }
  }],
  humanGateResponses: [],
  policies: [
    { id: "start-policy", source: "trigger", trigger: "manual-start", action: "build", enabled: true },
    { id: "review-policy", source: "event", event: "build.ready", action: "review", enabled: true },
    { id: "rework-policy", source: "event", event: "review.changes_requested", action: "build", enabled: true },
    { id: "done-policy", source: "event", event: "external.approved", action: "done", enabled: true }
  ],
  workflows: [{
    id: "workflow-1",
    title: "Workflow",
    steps: ["start-policy", "review-policy", "done-policy"]
  }, {
    id: "return-workflow",
    title: "Return workflow",
    steps: ["rework-policy", "review-policy"]
  }],
  runtimes: []
});

describe("workflowOutputHandlerForOutput", () => {
  it("finds the next event-policy action for an output event", () => {
    expect(workflowOutputHandlerForOutput(config(), "workflow-1", "start-policy", "ready")).toEqual({
      type: "action",
      outputId: "ready",
      eventType: "build.ready",
      policyId: "review-policy",
      stepIndex: 1,
      actionId: "review",
      label: "review"
    });
  });

  it("finds an earlier return handler action for a rework output", () => {
    expect(workflowOutputHandlerForOutput(config(), "return-workflow", "review-policy", "changes_requested")).toEqual({
      type: "action",
      outputId: "changes_requested",
      eventType: "review.changes_requested",
      policyId: "rework-policy",
      stepIndex: 0,
      actionId: "build",
      label: "build"
    });
  });

  it("uses custom output route event types", () => {
    expect(workflowOutputHandlerForOutput(config(), "workflow-1", "review-policy", "approved")).toEqual({
      type: "action",
      outputId: "approved",
      eventType: "external.approved",
      policyId: "done-policy",
      stepIndex: 2,
      actionId: "done",
      label: "done"
    });
  });

  it("returns trigger output routes as read-only trigger targets", () => {
    expect(workflowOutputHandlerForOutput(config(), "workflow-1", "review-policy", "blocked")).toEqual({
      type: "trigger",
      outputId: "blocked",
      eventType: "trigger.manual-start",
      triggerId: "manual-start",
      workflowId: "workflow-2",
      label: "manual-start"
    });
  });

  it("prefers trigger output routes over matching event-policy handlers", () => {
    const current = config();
    current.outputRoutes.push({
      sourcePolicyId: "start-policy",
      outputId: "ready",
      target: { type: "trigger", trigger: "manual-start" }
    });

    expect(workflowOutputHandlerForOutput(current, "workflow-1", "start-policy", "ready")).toEqual({
      type: "trigger",
      outputId: "ready",
      eventType: "trigger.manual-start",
      triggerId: "manual-start",
      workflowId: undefined,
      label: "manual-start"
    });
  });

  it("returns undefined when an output has no workflow handler", () => {
    expect(workflowOutputHandlerForOutput(config(), "workflow-1", "start-policy", "blocked")).toBeUndefined();
  });
});
