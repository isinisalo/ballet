import type { ProjectAutomationConfig } from "@shared/api/workspace-contracts";
import { workflowIdFromTrigger } from "@shared/policy-actions";
import { describe, expect, it } from "vitest";
import { workflowOutputHandlerForOutput } from "../src/workspace/automation/workflows/workflowOutputHandlers";

const workflowId = workflowIdFromTrigger("manual-start");
const returnWorkflowId = workflowIdFromTrigger("manual-rework");

const config = (): ProjectAutomationConfig => ({
  version: 1,
  actions: [
    { id: "build", description: "Build.", outputIds: ["ready", "blocked"], agentIds: ["agent-1"] },
    { id: "review", description: "Review.", outputIds: ["approved", "changes-requested"], agentIds: ["agent-1"] },
    { id: "human-review", description: "Human review.", outputIds: ["approved", "changes-requested"], agentIds: [], humanGate: true },
    { id: "done", description: "Done.", outputIds: [], agentIds: [] }
  ],
  outputs: [{ id: "ready" }, { id: "blocked" }, { id: "approved" }, { id: "changes-requested" }],
  outputRoutes: [{
    sourcePolicyId: "review-policy",
    outputId: "approved",
    target: { type: "event", eventType: "external.approved" }
  }],
  humanGateResponses: [],
  policies: [
    { id: "start-policy", source: "trigger", trigger: "manual-start", action: "build", enabled: true },
    { id: "review-policy", source: "event", event: "build.ready", action: "review", enabled: true },
    { id: "human-review-policy", source: "event", event: "review.approved", action: "human-review", enabled: true },
    { id: "return-start-policy", source: "trigger", trigger: "manual-rework", action: "build", enabled: true },
    { id: "rework-policy", source: "event", event: "review.changes-requested", action: "build", enabled: true },
    { id: "done-policy", source: "event", event: "external.approved", action: "done", enabled: true }
  ],
  workflows: [{
    id: workflowId,
    steps: ["start-policy", "review-policy", "done-policy"]
  }, {
    id: returnWorkflowId,
    steps: ["return-start-policy", "rework-policy", "review-policy"]
  }],
  runtimes: []
});

describe("workflowOutputHandlerForOutput", () => {
  it("finds the next event-policy action for an output event", () => {
    expect(workflowOutputHandlerForOutput(config(), workflowId, "start-policy", "ready")).toEqual({
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
    expect(workflowOutputHandlerForOutput(config(), returnWorkflowId, "review-policy", "changes-requested")).toEqual({
      type: "action",
      outputId: "changes-requested",
      eventType: "review.changes-requested",
      policyId: "rework-policy",
      stepIndex: 1,
      actionId: "build",
      label: "build"
    });
  });

  it("uses custom output route event types", () => {
    expect(workflowOutputHandlerForOutput(config(), workflowId, "review-policy", "approved")).toEqual({
      type: "action",
      outputId: "approved",
      eventType: "external.approved",
      policyId: "done-policy",
      stepIndex: 2,
      actionId: "done",
      label: "done"
    });
  });

  it("returns derived human gate approval outputs as read-only trigger targets", () => {
    expect(workflowOutputHandlerForOutput(config(), workflowId, "human-review-policy", "approved")).toEqual({
      type: "trigger",
      outputId: "approved",
      eventType: "trigger.human-review.approved",
      triggerId: "human-review.approved",
      workflowId: undefined,
      label: "human-review.approved"
    });
  });

  it("returns undefined when an output has no workflow handler", () => {
    expect(workflowOutputHandlerForOutput(config(), workflowId, "start-policy", "blocked")).toBeUndefined();
  });
});
